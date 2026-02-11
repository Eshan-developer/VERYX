const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// PHASE 1: IMMUTABLE EVENT STORE
// Saves events to a local JSON file to mimic an Append-Only Log

const DB_PATH = path.join(__dirname, '../../data/events.json');
const DB_DIR = path.dirname(DB_PATH);

class EventStore {
    constructor() {
        this.ensureStoreFile();
    }

    ensureStoreFile() {
        fs.mkdirSync(DB_DIR, { recursive: true });
        try {
            fs.accessSync(DB_PATH, fs.constants.F_OK);
        } catch (err) {
            if (err && err.code === 'ENOENT') {
                fs.writeFileSync(DB_PATH, '[]', 'utf8');
                return;
            }
            throw err;
        }
    }

    readEvents() {
        this.ensureStoreFile();
        try {
            const raw = fs.readFileSync(DB_PATH, 'utf8').trim();
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            if (err instanceof SyntaxError) return [];
            throw err;
        }
    }

    writeEvents(events) {
        const payload = JSON.stringify(events, null, 2);
        const tempPath = `${DB_PATH}.tmp`;
        fs.writeFileSync(tempPath, payload, 'utf8');
        fs.renameSync(tempPath, DB_PATH);
    }

    // 1. APPEND EVENT (Write Only)
    append(streamId, eventType, payload, user) {
        const currentData = this.readEvents();
        const streamVersion = currentData.filter((event) => event.streamId === streamId).length + 1;

        const timestamp = new Date().toISOString();
        const hashInput = JSON.stringify({ streamId, eventType, payload, timestamp });
        const auditHash = crypto.createHash('sha256').update(hashInput).digest('hex');

        const newEvent = {
            eventId: uuidv4(),
            streamId: streamId,
            version: streamVersion,
            eventType: eventType,
            payload: payload || {},
            meta: {
                timestamp: timestamp,
                user: user || 'system',
                auditHash: auditHash
            }
        };

        currentData.push(newEvent);
        this.writeEvents(currentData);

        console.log(`[EVENT STORE] Appended: ${eventType} | ID: ${streamId}`);
        return newEvent;
    }

    // 2. READ ALL (For Replay)
    getAllEvents() {
        return this.readEvents();
    }
}

module.exports = new EventStore();
