class ProjectionEngine {
    constructor() {
        this.currentState = { portfolios: [], workforce: [] };
    }

    run(events) {
        this.currentState.portfolios = [];
        this.currentState.workforce = [];

        events.forEach(event => {
            // 1. Create Portfolio (Existing)
            if (event.eventType === 'PORTFOLIO_CREATED') {
                this.currentState.portfolios.push({
                    id: event.streamId,
                    name: event.payload.name,
                    balance: event.payload.budget,
                    status: 'PENDING_APPROVAL',
                    score: event.payload.score || 0
                });
            }

            // 2. Stage-Gate Approval (Existing)
            if (event.eventType === 'STAGE_GATE_APPROVED') {
                const p = this.currentState.portfolios.find(p => p.id === event.streamId);
                if (p) p.status = 'APPROVED';
            }

            // 3. Resource Added (Section 4.4)
            if (event.eventType === 'RESOURCE_ADDED') {
                this.currentState.workforce.push({
                    id: event.streamId,
                    name: event.payload.name,
                    skill: event.payload.skill,
                    utilization: 0,
                    totalHours: 0
                });
            }

            // 4. Timesheet Logged (Section 4.4)
            if (event.eventType === 'TIMESHEET_LOGGED') {
                const worker = this.currentState.workforce.find(w => w.id === event.streamId);
                if (worker) {
                    worker.totalHours += parseInt(event.payload.hours);
                    // Utilization formula: (Worked Hours / 40) * 100 for a standard week
                    worker.utilization = ((worker.totalHours / 40) * 100).toFixed(0);
                }
            }
        });

        return this.currentState;
    }
}

module.exports = new ProjectionEngine();