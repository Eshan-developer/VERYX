const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

const eventSchema = new mongoose.Schema(
    {
        eventId: { type: String, required: true, index: true },
        streamId: { type: String, required: true, index: true },
        eventType: { type: String, required: true, trim: true },
        payload: { type: mongoose.Schema.Types.Mixed, default: {} },
        version: { type: Number, required: true },
        meta: {
            auditHash: { type: String, required: true },
            timestamp: { type: Date, required: true, index: true },
            user: { type: String, default: 'system' }
        }
    },
    {
        collection: 'events',
        versionKey: false
    }
);

eventSchema.index({ streamId: 1, version: 1 }, { unique: true });

const EventModel = mongoose.models.Event || mongoose.model('Event', eventSchema);

const ensureDatabaseConnection = async (mongoUri) => {
    if (!mongoUri) {
        throw new Error('MONGODB_URI is not set.');
    }

    if (mongoose.connection.readyState === 1) {
        return;
    }

    await mongoose.connect(mongoUri, { connectTimeoutMS: 10000 });
    console.log('[DATABASE] MongoDB Atlas connected');
};

const normalizeEvent = (doc) => {
    const raw = typeof doc?.toObject === 'function' ? doc.toObject() : doc;
    return {
        eventId: raw.eventId,
        streamId: raw.streamId,
        version: raw.version,
        eventType: raw.eventType,
        payload: raw.payload || {},
        meta: {
            timestamp: new Date(raw.meta?.timestamp).toISOString(),
            user: raw.meta?.user || 'system',
            auditHash: raw.meta?.auditHash
        }
    };
};

class EventStore {
    async connect(mongoUri) {
        await ensureDatabaseConnection(mongoUri);
    }

    // 1. APPEND EVENT (Write Only)
    async append(streamId, eventType, payload, user) {
        const safePayload = payload || {};
        const streamVersion = (await EventModel.countDocuments({ streamId })) + 1;

        const timestamp = new Date();
        const isoTimestamp = timestamp.toISOString();
        const hashInput = JSON.stringify({ streamId, eventType, payload: safePayload, timestamp: isoTimestamp });
        const auditHash = crypto.createHash('sha256').update(hashInput).digest('hex');

        const newEvent = await EventModel.create({
            eventId: uuidv4(),
            streamId,
            version: streamVersion,
            eventType,
            payload: safePayload,
            meta: {
                timestamp,
                user: user || 'system',
                auditHash
            }
        });

        console.log(`[EVENT STORE] Appended: ${eventType} | ID: ${streamId}`);
        return normalizeEvent(newEvent);
    }

    // 2. READ ALL (For Replay)
    async getAllEvents() {
        const events = await EventModel.find().sort({ 'meta.timestamp': 1 });
        return events.map(normalizeEvent);
    }
}

module.exports = new EventStore();
