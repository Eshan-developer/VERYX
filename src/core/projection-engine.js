const crypto = require('crypto');

class ProjectionEngine {
    constructor() {
        this.currentState = {
            portfolios: [],
            workforce: [],
            assets: [],
            evidencePacks: [],
            expenses: [],
            aiResults: [],
            esgSummary: { scope1: 0, scope2: 0, scope3: 0 },
            systemIntegrity: 'VERIFIED',
            acuBalance: 100
        };
    }

    verifyChain(events) {
        let integrity = 'VERIFIED';
        for (const event of events) {
            const hashInput = `${event.streamId}-${event.eventType}-${JSON.stringify(event.payload)}-${event.meta.timestamp}`;
            const expectedHash = crypto.createHash('sha256').update(hashInput).digest('hex');
            if (expectedHash !== event.meta.auditHash) {
                integrity = 'COMPROMISED';
                break;
            }
        }
        return integrity;
    }

    run(events) {
        const portfoliosById = new Map();
        const workforceById = new Map();
        const assetsById = new Map();

        this.currentState.evidencePacks = [];
        this.currentState.expenses = [];
        this.currentState.aiResults = [];
        this.currentState.esgSummary = { scope1: 0, scope2: 0, scope3: 0 };
        this.currentState.acuBalance = 100;

        for (const event of events) {
            // 0. ACU Ledger (Section 6)
            if (event.eventType === 'ACU_DEDUCTED') {
                const nextBalance = this.currentState.acuBalance - 10;
                this.currentState.acuBalance = nextBalance < 0 ? 0 : nextBalance;
            }

            // 1. Create Portfolio (Existing)
            if (event.eventType === 'PORTFOLIO_CREATED') {
                portfoliosById.set(event.streamId, {
                    id: event.streamId,
                    name: event.payload.name,
                    balance: event.payload.budget,
                    initialBudget: event.payload.budget,
                    status: 'PENDING_APPROVAL',
                    score: event.payload.score || 0,
                    cpi: 1,
                    esg: { scope1: 0, scope2: 0, scope3: 0 }
                });
            }

            // 2. Stage-Gate Approval (Existing)
            if (event.eventType === 'STAGE_GATE_APPROVED') {
                const p = portfoliosById.get(event.streamId);
                if (p) p.status = 'APPROVED';
            }

            // 2.1 Expense Logged (Section 4.3)
            if (event.eventType === 'EXPENSE_LOGGED') {
                const p = portfoliosById.get(event.streamId);
                const amount = parseInt(event.payload.amount);
                if (p) {
                    p.balance -= amount;
                    if (p.balance < 0) p.balance = 0;
                    const budgetBase = p.initialBudget || 1;
                    p.cpi = (p.balance / budgetBase).toFixed(2);
                }
                this.currentState.expenses.push({
                    id: event.eventId,
                    portfolioId: event.streamId,
                    amount,
                    description: event.payload.description,
                    timestamp: event.meta.timestamp
                });
            }

            // 3. Resource Added (Section 4.4)
            if (event.eventType === 'RESOURCE_ADDED') {
                workforceById.set(event.streamId, {
                    id: event.streamId,
                    name: event.payload.name,
                    skill: event.payload.skill,
                    utilization: 0,
                    totalHours: 0
                });
            }

            // 4. Timesheet Logged (Section 4.4)
            if (event.eventType === 'TIMESHEET_LOGGED') {
                const worker = workforceById.get(event.streamId);
                if (worker) {
                    worker.totalHours += parseInt(event.payload.hours);
                    // Utilization formula: (Worked Hours / 40) * 100 for a standard week
                    worker.utilization = ((worker.totalHours / 40) * 100).toFixed(0);
                }
            }

            // 5. Asset Registered (Section 4.8)
            if (event.eventType === 'ASSET_REGISTERED') {
                assetsById.set(event.streamId, {
                    id: event.streamId,
                    name: event.payload.name,
                    kind: event.payload.kind,
                    portfolioId: event.payload.portfolioId,
                    status: 'ACTIVE',
                    workOrderCount: 0,
                    lastWorkOrder: null
                });
            }

            // 6. Work Order Issued (Section 4.8)
            if (event.eventType === 'WORK_ORDER_ISSUED') {
                const asset = assetsById.get(event.streamId);
                if (asset) {
                    asset.workOrderCount += 1;
                    asset.lastWorkOrder = {
                        summary: event.payload.summary,
                        timestamp: event.meta.timestamp
                    };
                    asset.status = 'WORK_ORDER_ISSUED';
                }
            }

            // 7. Evidence Pack Generated (Section 9)
            if (event.eventType === 'EVIDENCE_PACK_GENERATED') {
                this.currentState.evidencePacks.push({
                    id: event.meta.auditHash,
                    portfolioId: event.payload.portfolioId,
                    timestamp: event.meta.timestamp,
                    status: 'IMMUTABLE',
                    eventId: event.payload.eventId,
                    versionHash: event.payload.versionHash,
                    userId: event.payload.userId,
                    watermark: event.payload.watermark,
                    createdAt: event.meta.timestamp
                });
            }

            // 8. Generate Evidence (Alias Event)
            if (event.eventType === 'GENERATE_EVIDENCE') {
                this.currentState.evidencePacks.push({
                    id: event.meta.auditHash,
                    portfolioId: event.payload.portfolioId,
                    timestamp: event.meta.timestamp,
                    status: 'IMMUTABLE',
                    eventId: event.payload.eventId,
                    versionHash: event.payload.versionHash,
                    userId: event.payload.userId,
                    watermark: event.payload.watermark,
                    createdAt: event.meta.timestamp
                });
            }

            // 9. AI Task Completed (Section 7)
            if (event.eventType === 'AI_COMPLETED') {
                this.currentState.aiResults.push({
                    id: event.eventId,
                    requestType: event.payload.requestType,
                    provider: event.payload.provider,
                    result: event.payload.result,
                    timestamp: event.meta.timestamp
                });
            }
            // 10. ESG Reported (Section 4.7)
            if (event.eventType === 'ESG_REPORTED') {
                const scope1 = parseFloat(event.payload.scope1 || 0);
                const scope2 = parseFloat(event.payload.scope2 || 0);
                const scope3 = parseFloat(event.payload.scope3 || 0);
                this.currentState.esgSummary.scope1 += scope1;
                this.currentState.esgSummary.scope2 += scope2;
                this.currentState.esgSummary.scope3 += scope3;

                const p = portfoliosById.get(event.streamId);
                if (p) {
                    p.esg = { scope1, scope2, scope3 };
                }
            }
        }

        this.currentState.portfolios = Array.from(portfoliosById.values());
        this.currentState.workforce = Array.from(workforceById.values());
        this.currentState.assets = Array.from(assetsById.values());
        this.currentState.systemIntegrity = this.verifyChain(events);

        return this.currentState;
    }
}

module.exports = new ProjectionEngine();
