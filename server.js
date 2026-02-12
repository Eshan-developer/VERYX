const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const eventStore = require('./src/core/event-store');
const projectionEngine = require('./src/core/projection-engine');
const { runAIRequest } = require('./src/core/ai-orchestrator');

const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

const connectToDatabase = async () => {
    if (!MONGODB_URI) {
        throw new Error('MONGODB_URI is not set.');
    }

    await mongoose.connect(MONGODB_URI);
    console.log('[DATABASE] MongoDB Atlas connected');
};

const app = express();
app.use(bodyParser.json({ limit: '1mb' }));

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
}));

app.options('*', cors());

const asyncHandler = (handler) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
};

const requireRole = (allowedRoles) => (req, res, next) => {
    const role = req.body && req.body.userRole;
    if (!role || !allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
    }
    return next();
};

app.get('/', (req, res) => {
    res.send('VERYX Enterprise OS - Core Active');
});

app.post('/api/command/create-portfolio', asyncHandler(async (req, res) => {
    const { name, budget, score, user } = req.body;
    const streamId = uuidv4();

    await eventStore.append(streamId, 'PORTFOLIO_CREATED', {
        name,
        budget: Number(budget) || 0,
        score: Number(score) || 0
    }, user);

    res.json({ success: true, id: streamId });
}));

app.post('/api/command/approve-portfolio', requireRole(['MANAGER', 'ADMIN']), asyncHandler(async (req, res) => {
    const { portfolioId, user } = req.body;
    await eventStore.append(portfolioId, 'STAGE_GATE_APPROVED', { decision: 'PROCEED' }, user);
    res.json({ success: true, message: 'Portfolio Approved' });
}));

app.post('/api/command/log-expense', asyncHandler(async (req, res) => {
    const { portfolioId, amount, description, user } = req.body;

    await eventStore.append(portfolioId, 'EXPENSE_LOGGED', {
        amount: Number(amount) || 0,
        description: description || ''
    }, user);

    res.json({ success: true, message: 'Expense Logged' });
}));

app.post('/api/command/add-resource', asyncHandler(async (req, res) => {
    const { name, skill, user } = req.body;
    const streamId = uuidv4();

    await eventStore.append(streamId, 'RESOURCE_ADDED', {
        name,
        skill
    }, user);

    res.json({ success: true, id: streamId });
}));

app.post('/api/command/log-timesheet', asyncHandler(async (req, res) => {
    const { resourceId, hours, user } = req.body;
    await eventStore.append(resourceId, 'TIMESHEET_LOGGED', { hours: Number(hours) || 0 }, user);
    res.json({ success: true });
}));

app.post('/api/command/register-asset', asyncHandler(async (req, res) => {
    const { name, kind, portfolioId, user } = req.body;
    const streamId = uuidv4();

    await eventStore.append(streamId, 'ASSET_REGISTERED', {
        name,
        kind,
        portfolioId
    }, user);

    res.json({ success: true, id: streamId });
}));

app.post('/api/command/issue-work-order', asyncHandler(async (req, res) => {
    const { assetId, summary, user } = req.body;
    await eventStore.append(assetId, 'WORK_ORDER_ISSUED', { summary }, user);
    res.json({ success: true });
}));

app.post('/api/command/generate-evidence', requireRole(['MANAGER', 'ADMIN']), asyncHandler(async (req, res) => {
    const { portfolioId, user } = req.body;
    const allEvents = await eventStore.getAllEvents();
    const state = projectionEngine.run(allEvents);
    const portfolio = state.portfolios.find((p) => p.id === portfolioId);

    if (!portfolio || portfolio.status !== 'APPROVED') {
        return res.status(403).json({ success: false, message: 'Evidence export requires APPROVED status' });
    }

    const sourceEvent = [...allEvents].reverse().find((event) => event.streamId === portfolioId);
    if (!sourceEvent) {
        return res.status(404).json({ success: false, message: 'No source event found for portfolio' });
    }

    const packId = uuidv4();
    const packEvent = await eventStore.append(packId, 'EVIDENCE_PACK_GENERATED', {
        portfolioId,
        eventId: sourceEvent.eventId,
        versionHash: sourceEvent.meta.auditHash,
        userId: sourceEvent.meta.user,
        timestamp: sourceEvent.meta.timestamp,
        watermark: 'WATERMARKED'
    }, user);

    return res.json({ success: true, id: packEvent.eventId, hash: packEvent.meta.auditHash });
}));

app.post('/api/command/request-ai', asyncHandler(async (req, res) => {
    const { requestType, prompt, user } = req.body;
    const allEvents = await eventStore.getAllEvents();
    const state = projectionEngine.run(allEvents);

    if (state.acuBalance <= 0) {
        return res.status(403).json({
            success: false,
            message: 'ACU balance is zero. Further AI commands are not allowed.'
        });
    }

    const acuEvent = await eventStore.append('ACU_LEDGER', 'ACU_DEDUCTED', { amount: 10 }, user);
    const aiResult = await runAIRequest({ requestType, prompt, user, requestId: acuEvent.eventId });

    return res.json({ success: true, data: aiResult });
}));

app.get('/api/query/state', asyncHandler(async (req, res) => {
    const allEvents = await eventStore.getAllEvents();
    const state = projectionEngine.run(allEvents);
    res.json(state);
}));

app.get('/api/query/audit-log', asyncHandler(async (req, res) => {
    const allEvents = await eventStore.getAllEvents();
    res.json(allEvents);
}));

app.post('/api/query/evidence/export', requireRole(['MANAGER', 'ADMIN']), asyncHandler(async (req, res) => {
    const { hash, format } = req.body;
    const exportFormat = String(format || 'json').toLowerCase();

    const allEvents = await eventStore.getAllEvents();
    const evidenceEvent = allEvents.find((event) =>
        (event.eventType === 'EVIDENCE_PACK_GENERATED' || event.eventType === 'GENERATE_EVIDENCE') &&
        event.meta.auditHash === hash
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

        const text = lines.join(' | ');
        const escapedText = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

        const stream = `BT /F1 10 Tf 50 760 Td (${escapedText}) Tj ET`;
        const pdf = [
            '%PDF-1.4',
            '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
            '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
            '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
            `4 0 obj << /Length ${stream.length} >> stream`,
            stream,
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

        const pdfBuffer = Buffer.from(pdf, 'utf8');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="evidence-${payload.id}.pdf"`);
        return res.send(pdfBuffer);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="evidence-${payload.id}.json"`);
    return res.json(payload);
}));

app.get('/api/system/integrity', asyncHandler(async (req, res) => {
    const allEvents = await eventStore.getAllEvents();
    const integrity = projectionEngine.verifyChain(allEvents);
    res.json({ success: true, systemIntegrity: integrity });
}));

app.post('/api/system/replay', asyncHandler(async (req, res) => {
    const allEvents = await eventStore.getAllEvents();
    const state = projectionEngine.run(allEvents);
    res.json({ success: true, state, eventCount: allEvents.length });
}));

app.use((err, req, res, next) => {
    console.error('[ERROR]', err);
    if (res.headersSent) {
        return next(err);
    }
    return res.status(500).json({ success: false, message: 'Internal server error' });
});

const startServer = async () => {
    try {
        await connectToDatabase();
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`VERYX Server running on Port ${PORT}`);
            console.log('[SYSTEM] Event Sourcing Mode: ACTIVE');
        });
    } catch (error) {
        console.error('[BOOT] Failed to start server:', error.message);
        process.exit(1);
    }
};

startServer();
