/**
 * PHASE 2: PROJECTION ENGINE
 * Implements Section 4.1: Portfolio Scoring & Stage-Gate Approvals
 */

class ProjectionEngine {
    constructor() {
        this.currentState = {
            portfolios: []
        };
    }

    run(events) {
        // RESET STATE (Deterministic Replay)
        this.currentState.portfolios = [];

        events.forEach(event => {
            
            // 1. Create Portfolio (with Score & Initial Status)
            if (event.eventType === 'PORTFOLIO_CREATED') {
                this.currentState.portfolios.push({
                    id: event.streamId,
                    name: event.payload.name,
                    budget: event.payload.budget,
                    score: event.payload.score || 0, // Section 4.1: Scoring
                    status: 'PENDING_APPROVAL',      // Section 4.1: Stage-Gate
                    balance: event.payload.budget,
                    updatedAt: event.meta.timestamp
                });
            }

            // 2. Stage-Gate Approval (Section 4.1)
            if (event.eventType === 'STAGE_GATE_APPROVED') {
                const portfolio = this.currentState.portfolios.find(p => p.id === event.streamId);
                if (portfolio) {
                    portfolio.status = 'APPROVED';
                    portfolio.updatedAt = event.meta.timestamp;
                }
            }
        });

        return this.currentState;
    }
}

module.exports = new ProjectionEngine();