const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Import Core Modules
const eventStore = require('./src/core/event-store');
const projectionEngine = require('./src/core/projection-engine');
const { runAIRequest } = require('./src/core/ai-orchestrator');

const app = express();
app.use(bodyParser.json());

// GLOBAL CORS CONFIG
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

app.options('*', cors());

// SIMPLE ROLE CHECK (Section 5.2)
const requireRole = (allowedRoles) => (req, res, next) => {
    const role = req.body && req.body.userRole;
    if (!role || !allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    next();
};

// ROOT ROUTE
app.get('/', (req, res) => {
    res.send('VERYX Enterprise OS - Core Active');
});

// ==========================
// COMMAND GATEWAY (Write)
// ==========================

// 1. Create Portfolio Command (Scoring added)
app.post('/api/command/create-portfolio', (req, res) => {
    const { name, budget, score, user } = req.body;
    const streamId = uuidv4();
    eventStore.append(streamId, 'PORTFOLIO_CREATED', { name, budget, score }, user);
    res.json({ success: true, id: streamId });
});

// 2. Stage-Gate Approval Command (Section 4.1)
app.post('/api/command/approve-portfolio', requireRole(['MANAGER', 'ADMIN']), (req, res) => {
    const { portfolioId, user } = req.body;
    eventStore.append(portfolioId, 'STAGE_GATE_APPROVED', { decision: 'PROCEED' }, user);
    res.json({ success: true, message: "Portfolio Approved" });
});

// ==========================
// QUERY GATEWAY (Read)
// ==========================

app.get('/api/query/state', (req, res) => {
    const allEvents = eventStore.getAllEvents();
    const state = projectionEngine.run(allEvents);
    res.json(state);
});

app.get('/api/query/audit-log', (req, res) => {
    res.json(eventStore.getAllEvents());
});

// SYSTEM INTEGRITY CHECK
app.get('/api/system/integrity', (req, res) => {
    const allEvents = eventStore.getAllEvents();
    const integrity = projectionEngine.verifyChain(allEvents);
    res.json({ success: true, systemIntegrity: integrity });
});

// Evidence Export (JSON/PDF)
app.post('/api/query/evidence/export', requireRole(['MANAGER', 'ADMIN']), (req, res) => {
    const { hash, format } = req.body;
    const exportFormat = (format || 'json').toLowerCase();
    const allEvents = eventStore.getAllEvents();
    const evidenceEvent = allEvents.find(e =>
        (e.eventType === 'EVIDENCE_PACK_GENERATED' || e.eventType === 'GENERATE_EVIDENCE') &&
        e.meta.auditHash === hash
    );

    if (!evidenceEvent) {
        return res.status(404).json({ success: false, message: 'Evidence pack not found' });
    }

    const payload = {
        id: evidenceEvent.meta.auditHash,
        portfolioId: evidenceEvent.payload.portfolioId,
        timestamp: evidenceEvent.meta.timestamp,
        status: 'IMMUTABLE',
        eventId: evidenceEvent.payload.eventId,
        versionHash: evidenceEvent.payload.versionHash,
        userId: evidenceEvent.payload.userId,
        watermark: evidenceEvent.payload.watermark
    };

    if (exportFormat === 'pdf') {
        const lines = [
            'VERYXOS EVIDENCE CERTIFICATE',
            '----------------------------------------',
            `AUDIT HASH: ${payload.id}`,
            `PORTFOLIO ID: ${payload.portfolioId}`,
            `TIMESTAMP: ${payload.timestamp}`,
            `STATUS: ${payload.status}`,
            `VERSION HASH: ${payload.versionHash}`,
            `USER ID: ${payload.userId}`,
            'WATERMARK: VERYX AUDITED'
        ];

        const text = lines.join('\n');
        const pdfBody = [
            '%PDF-1.4',
            '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
            '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
            '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
            `4 0 obj << /Length ${text.length + 91} >> stream`,
            'BT',
            '/F1 12 Tf',
            '72 720 Td',
            `( ${text.replace(/\(/g, '\\(').replace(/\)/g, '\\)')} ) Tj`,
            'ET',
            'endstream endobj',
            '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
            'xref',
            '0 6',
            '0000000000 65535 f ',
            '0000000010 00000 n ',
            '0000000060 00000 n ',
            '0000000117 00000 n ',
            '0000000241 00000 n ',
            '0000000400 00000 n ',
            'trailer << /Size 6 /Root 1 0 R >>',
            'startxref',
            '470',
            '%%EOF'
        ].join('\n');

        const pdfBuffer = Buffer.from(pdfBody, 'utf8');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="evidence-${payload.id}.pdf"`);
        return res.send(pdfBuffer);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="evidence-${payload.id}.json"`);
    return res.json(payload);
});

// Legacy Evidence Export (GET) - no access control
// SYSTEM REPLAY (Deterministic)
app.post('/api/system/replay', (req, res) => {
    const allEvents = eventStore.getAllEvents();
    const state = projectionEngine.run(allEvents);
    res.json({ success: true, state, eventCount: allEvents.length });
});

// 8. Register Asset Command (Section 4.8)
app.post('/api/command/register-asset', (req, res) => {
    const { name, kind, portfolioId, user } = req.body;
    const streamId = uuidv4();
    eventStore.append(streamId, 'ASSET_REGISTERED', { name, kind, portfolioId }, user);
    res.json({ success: true, id: streamId });
});

// 9. Issue Work Order Command (Section 4.8)
app.post('/api/command/issue-work-order', (req, res) => {
    const { assetId, summary, user } = req.body;
    eventStore.append(assetId, 'WORK_ORDER_ISSUED', { summary }, user);
    res.json({ success: true });
});

// 10. Generate Evidence Command (Section 9)
app.post('/api/command/generate-evidence', requireRole(['MANAGER', 'ADMIN']), (req, res) => {
    const { portfolioId, user } = req.body;
    const allEvents = eventStore.getAllEvents();
    const state = projectionEngine.run(allEvents);
    const portfolio = state.portfolios.find(p => p.id === portfolioId);

    if (!portfolio || portfolio.status !== 'APPROVED') {
        return res.status(403).json({ success: false, message: 'Evidence export requires APPROVED status' });
    }

    const sourceEvent = [...allEvents].reverse().find(e => e.streamId === portfolioId);
    if (!sourceEvent) {
        return res.status(404).json({ success: false, message: 'No source event found for portfolio' });
    }

    const packId = uuidv4();
    const packEvent = eventStore.append(packId, 'EVIDENCE_PACK_GENERATED', {
        portfolioId,
        eventId: sourceEvent.eventId,
        versionHash: sourceEvent.meta.auditHash,
        userId: sourceEvent.meta.user,
        timestamp: sourceEvent.meta.timestamp,
        watermark: 'WATERMARKED'
    }, user);

    res.json({ success: true, id: packEvent.eventId, hash: packEvent.meta.auditHash });
});

// 7. Request AI Command (Section 6 & 7)
app.post('/api/command/request-ai', (req, res) => {
    const { requestType, prompt, user } = req.body;
    const allEvents = eventStore.getAllEvents();
    const state = projectionEngine.run(allEvents);

    if (state.acuBalance <= 0) {
        return res.status(403).json({ success: false, message: 'ACU balance is zero. Further AI commands are not allowed.' });
    }

    const acuEvent = eventStore.append('ACU_LEDGER', 'ACU_DEDUCTED', { amount: 10 }, user);
    const aiResult = runAIRequest({ requestType, prompt, user, requestId: acuEvent.eventId });

    return res.json({ success: true, data: aiResult });
});

// START SERVER
const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`VERYX Server running on Port ${PORT}`);
    console.log(`[SYSTEM] Event Sourcing Mode: ACTIVE`);
});

// 4. Log Expense Command (Section 4.3)
app.post('/api/command/log-expense', (req, res) => {
    const { portfolioId, amount, description, user } = req.body;
    
    // Append Expense Event
    eventStore.append(portfolioId, 'EXPENSE_LOGGED', { 
        amount: parseInt(amount), 
        description 
    }, user);

    res.json({ success: true, message: "Expense Logged" });
});

// 5. Add Resource Command (Section 4.4)
app.post('/api/command/add-resource', (req, res) => {
    const { name, skill, user } = req.body;
    const streamId = uuidv4();
    eventStore.append(streamId, 'RESOURCE_ADDED', { name, skill }, user);
    res.json({ success: true, id: streamId });
});

// 6. Log Timesheet Command (Section 4.4)
app.post('/api/command/log-timesheet', (req, res) => {
    const { resourceId, hours, user } = req.body;
    eventStore.append(resourceId, 'TIMESHEET_LOGGED', { hours }, user);
    res.json({ success: true });
});
