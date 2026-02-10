const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

// PHASE 1: IMMUTABLE EVENT STORE
// Saves events to a local JSON file to mimic an Append-Only Log

const DB_PATH = path.join(__dirname, '../../data/events.json');

class EventStore {
    constructor() {
        // Initialize DB file if it doesn't exist
        if (!fs.existsSync(DB_PATH)) {
            fs.writeFileSync(DB_PATH, JSON.stringify([]));
        }
    }

    // 1. APPEND EVENT (Write Only)
    append(streamId, eventType, payload, user) {
        // Read current history
        const currentData = JSON.parse(fs.readFileSync(DB_PATH));

        // Stringify payload before hashing
        const hashInput = `${streamId}-${eventType}-${JSON.stringify(payload)}-${new Date().toISOString()}`;
        const auditHash = crypto.createHash('sha256').update(hashInput).digest('hex');

        const newEvent = {
            eventId: uuidv4(),
            streamId: streamId,
            version: currentData.length + 1,
            eventType: eventType,
            payload: payload,
            meta: {
                timestamp: new Date().toISOString(),
                user: user || 'system',
                auditHash: auditHash
            }
        };

        // Save to File (Immutable Log)
        currentData.push(newEvent);
        fs.writeFileSync(DB_PATH, JSON.stringify(currentData, null, 2));
        
        console.log(`[EVENT STORE] Appended: ${eventType} | ID: ${streamId}`);
        return newEvent;
    }

    // 2. READ ALL (For Replay)
    getAllEvents() {
        if (!fs.existsSync(DB_PATH)) return [];
        return JSON.parse(fs.readFileSync(DB_PATH));
    }
}

module.exports = new EventStore();
