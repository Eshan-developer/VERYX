const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

// Import Core Modules
const eventStore = require('./src/core/event-store');
const projectionEngine = require('./src/core/projection-engine');

const app = express();
app.use(bodyParser.json());

// COMPLETE CORS FIX
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
})); // Add missing semicolon

// DEBUG LOGGING: This will tell us if the frontend is actually hitting the backend
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} request to: ${req.url}`);
    next();
}); // Corrected misplaced closing parenthesis

// Global OPTIONS handler
app.options('*', cors());

// ROOT ROUTE
app.get('/', (req, res) => {
    res.send('VERYX Enterprise OS - Core Active');
});

// COMMANDS
app.post('/api/command/create-portfolio', (req, res) => {
    const { name, budget, user } = req.body;
    console.log(`[COMMAND] Creating portfolio: ${name} with budget ${budget}`);
    const streamId = uuidv4();
    eventStore.append(streamId, 'PORTFOLIO_CREATED', { name, budget }, user);
    res.json({ success: true, id: streamId });
});

// QUERIES
app.get('/api/query/state', (req, res) => {
    const allEvents = eventStore.getAllEvents();
    const state = projectionEngine.run(allEvents);
    res.json(state);
});

app.get('/api/query/audit-log', (req, res) => {
    res.json(eventStore.getAllEvents());
});

const PORT = 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${PORT}`);
    console.log(`[SYSTEM] Event Sourcing Mode: ACTIVE`);
});