const { v4: uuidv4 } = require('uuid');
const eventStore = require('./event-store');

const selectProvider = (requestType) => {
    if (!requestType) return 'OpenAI';

    const normalized = requestType.toLowerCase();
    if (normalized.includes('reasoning') || normalized.includes('forecasting')) return 'OpenAI';
    if (normalized.includes('vision') || normalized.includes('docs')) return 'Gemini';

    return 'OpenAI';
};

const createMockResult = (provider, requestType, prompt) => {
    const safePrompt = prompt ? String(prompt).slice(0, 160) : 'No prompt provided';
    return `${provider} mock result for ${requestType || 'AI'}: ${safePrompt}`;
};

const runAIRequest = ({ requestType, prompt, user, requestId }) => {
    const provider = selectProvider(requestType);
    const result = createMockResult(provider, requestType, prompt);
    const streamId = requestId || uuidv4();

    eventStore.append(streamId, 'AI_COMPLETED', {
        requestType: requestType || 'AI',
        provider,
        result
    }, user);

    return { requestId: streamId, provider, result };
};

module.exports = { runAIRequest };
