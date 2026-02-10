// PHASE 1: PROJECTION ENGINE
// Replays events to build "Current State" (Deterministic)

class ProjectionEngine {
    constructor() {
        this.currentState = {
            portfolios: [],
            systemLog: []
        };
    }

    run(events) {
        // RESET STATE (The "Replay" logic)
        this.currentState.portfolios = [];
        this.currentState.systemLog = [];

        console.log(`[PROJECTION] Replaying ${events.length} events...`);

        // PROCESS EVENTS CHRONOLOGICALLY
        events.forEach(event => {
            
            // 1. Portfolio Created
            if (event.eventType === 'PORTFOLIO_CREATED') {
                this.currentState.portfolios.push({
                    id: event.streamId,
                    name: event.payload.name,
                    budget: event.payload.budget,
                    balance: event.payload.budget,
                    status: 'ACTIVE'
                });
            }

            // 2. Budget Allocated (Money Spent)
            if (event.eventType === 'FUNDS_ALLOCATED') {
                const portfolio = this.currentState.portfolios.find(p => p.id === event.streamId);
                if (portfolio) {
                    portfolio.balance -= event.payload.amount;
                }
            }
        });

        return this.currentState;
    }
}

module.exports = new ProjectionEngine();