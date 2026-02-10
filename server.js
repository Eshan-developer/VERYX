const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Import Core Modules
const eventStore = require('./src/core/event-store');
const projectionEngine = require('./src/core/projection-engine');

const app = express();
app.use(bodyParser.json());

// GLOBAL CORS CONFIG
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.options('*', cors());

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
app.post('/api/command/approve-portfolio', (req, res) => {
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

// START SERVER
const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`VERYX Server running on Port ${PORT}`);
    console.log(`[SYSTEM] Event Sourcing Mode: ACTIVE`);
});