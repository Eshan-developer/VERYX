import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const API_URL = 'https://veryx-backend.onrender.com';

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatCurrency = (value) => {
  const numeric = toNumber(value, 0);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(numeric);
};

function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [portfolios, setPortfolios] = useState([]);
  const [workforce, setWorkforce] = useState([]);
  const [events, setEvents] = useState([]);
  const [assets, setAssets] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [aiResults, setAiResults] = useState([]);
  const [acuBalance, setAcuBalance] = useState(100);
  const [esgSummary, setEsgSummary] = useState({ scope1: 0, scope2: 0, scope3: 0 });
  const [systemIntegrity, setSystemIntegrity] = useState('VERIFIED');
  const [notification, setNotification] = useState(null);
  const [evidenceGenerated, setEvidenceGenerated] = useState({});
  const [evidenceBusy, setEvidenceBusy] = useState(false);
  const [evidenceBusyId, setEvidenceBusyId] = useState(null);

  const evidenceLockRef = useRef(false);
  const notificationTimeoutRef = useRef(null);

  const [projectForm, setProjectForm] = useState({ name: '', budget: '', score: '' });
  const [staffForm, setStaffForm] = useState({ name: '', skill: '' });
  const [assetForm, setAssetForm] = useState({ name: '', kind: '', portfolioId: '' });
  const [expenseForm, setExpenseForm] = useState({ portfolioId: '', amount: '', description: '' });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.title = 'VERYX ENTERPRISE OS';
  }, []);

  const notify = useCallback((type, message) => {
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
      notificationTimeoutRef.current = null;
    }

    setNotification({ type, message });
    notificationTimeoutRef.current = setTimeout(() => {
      setNotification(null);
      notificationTimeoutRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
    };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const [stateRes, auditRes, integrityRes] = await Promise.all([
        fetch(`${API_URL}/api/query/state`),
        fetch(`${API_URL}/api/query/audit-log`),
        fetch(`${API_URL}/api/system/integrity`)
      ]);

      if (!stateRes.ok) {
        throw new Error('Failed to fetch state.');
      }

      if (!auditRes.ok) {
        throw new Error('Failed to fetch audit log.');
      }

      const [stateData, auditData] = await Promise.all([stateRes.json(), auditRes.json()]);

      const nextPortfolios = Array.isArray(stateData.portfolios) ? stateData.portfolios : [];
      const nextWorkforce = Array.isArray(stateData.workforce) ? stateData.workforce : [];
      const nextAssets = Array.isArray(stateData.assets) ? stateData.assets : [];
      const nextEvidence = Array.isArray(stateData.evidencePacks) ? stateData.evidencePacks : [];
      const nextExpenses = Array.isArray(stateData.expenses) ? stateData.expenses : [];
      const nextAiResults = Array.isArray(stateData.aiResults) ? stateData.aiResults : [];
      const nextEvents = Array.isArray(auditData) ? [...auditData].reverse() : [];

      setPortfolios(nextPortfolios);
      setWorkforce(nextWorkforce);
      setAssets(nextAssets);
      setEvidence(nextEvidence);
      setExpenses(nextExpenses);
      setAiResults(nextAiResults);
      setEvents(nextEvents);

      if (stateData.esgSummary) {
        setEsgSummary(stateData.esgSummary);
      }

      if (typeof stateData.acuBalance === 'number') {
        setAcuBalance(stateData.acuBalance);
      }

      const generatedMap = {};
      nextEvidence.forEach((pack) => {
        if (pack.portfolioId) {
          generatedMap[pack.portfolioId] = true;
        }
      });
      setEvidenceGenerated(generatedMap);

      if (integrityRes.ok) {
        const integrityData = await integrityRes.json();
        setSystemIntegrity(integrityData.systemIntegrity || stateData.systemIntegrity || 'UNKNOWN');
      } else {
        setSystemIntegrity(stateData.systemIntegrity || 'UNKNOWN');
      }

      setError(null);
    } catch (err) {
      console.error('Sync Error', err);
      setError('System Offline. Please try again later.');
      notify('error', 'System Offline');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, [fetchData]);

  const executeCommand = useCallback(async (path, body, successMessage = 'Command executed') => {
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Command failed.');
      }

      await fetchData();
      setError(null);
      notify('success', successMessage);
      return true;
    } catch (err) {
      console.error('Command Error', err);
      setError('System Offline. Please try again later.');
      notify('error', err.message || 'Command failed');
      return false;
    }
  }, [fetchData, notify]);

  const createPortfolio = useCallback(async () => {
    const budget = toNumber(projectForm.budget);
    const score = toNumber(projectForm.score);

    if (!projectForm.name.trim() || budget <= 0) {
      notify('error', 'Provide a project name and a positive budget.');
      return;
    }

    const ok = await executeCommand('/api/command/create-portfolio', {
      name: projectForm.name.trim(),
      budget,
      score,
      user: 'ADMIN'
    }, 'Initiative created');

    if (ok) {
      setProjectForm({ name: '', budget: '', score: '' });
    }
  }, [executeCommand, notify, projectForm.budget, projectForm.name, projectForm.score]);

  const approvePortfolio = useCallback(async (portfolioId) => {
    await executeCommand('/api/command/approve-portfolio', {
      portfolioId,
      user: 'MANAGER',
      userRole: 'MANAGER'
    }, 'Stage gate approved');
  }, [executeCommand]);

  const logExpense = useCallback(async () => {
    const amount = toNumber(expenseForm.amount);

    if (!expenseForm.portfolioId || amount <= 0 || !expenseForm.description.trim()) {
      notify('error', 'Select a portfolio, amount, and description.');
      return;
    }

    const ok = await executeCommand('/api/command/log-expense', {
      portfolioId: expenseForm.portfolioId,
      amount,
      description: expenseForm.description.trim(),
      user: 'FINANCE'
    }, 'Expense logged');

    if (ok) {
      setExpenseForm({ portfolioId: '', amount: '', description: '' });
    }
  }, [executeCommand, expenseForm.amount, expenseForm.description, expenseForm.portfolioId, notify]);

  const addResource = useCallback(async () => {
    if (!staffForm.name.trim() || !staffForm.skill.trim()) {
      notify('error', 'Provide staff name and role.');
      return;
    }

    const ok = await executeCommand('/api/command/add-resource', {
      name: staffForm.name.trim(),
      skill: staffForm.skill.trim(),
      user: 'HR'
    }, 'Resource added');

    if (ok) {
      setStaffForm({ name: '', skill: '' });
    }
  }, [executeCommand, notify, staffForm.name, staffForm.skill]);

  const logTimesheet = useCallback(async (resourceId) => {
    const entry = window.prompt('Hours?');

    if (!entry) {
      return;
    }

    const hours = toNumber(entry);
    if (hours <= 0) {
      notify('error', 'Hours must be greater than zero.');
      return;
    }

    await executeCommand('/api/command/log-timesheet', {
      resourceId,
      hours,
      user: 'USER'
    }, 'Timesheet logged');
  }, [executeCommand, notify]);

  const registerAsset = useCallback(async () => {
    if (!assetForm.name.trim() || !assetForm.kind.trim() || !assetForm.portfolioId) {
      notify('error', 'Provide asset name, type, and portfolio.');
      return;
    }

    const ok = await executeCommand('/api/command/register-asset', {
      name: assetForm.name.trim(),
      kind: assetForm.kind.trim(),
      portfolioId: assetForm.portfolioId,
      user: 'OPS'
    }, 'Asset registered');

    if (ok) {
      setAssetForm({ name: '', kind: '', portfolioId: '' });
    }
  }, [assetForm.kind, assetForm.name, assetForm.portfolioId, executeCommand, notify]);

  const issueWorkOrder = useCallback(async (assetId) => {
    const summary = window.prompt('Work order summary?');

    if (!summary || !summary.trim()) {
      return;
    }

    await executeCommand('/api/command/issue-work-order', {
      assetId,
      summary: summary.trim(),
      user: 'OPS'
    }, 'Work order issued');
  }, [executeCommand]);

  const requestAI = useCallback(async (requestType, prompt) => {
    try {
      const response = await fetch(`${API_URL}/api/command/request-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType, prompt, user: 'ADMIN' })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'AI command failed.');
      }

      await fetchData();
      setError(null);
      notify('success', 'AI command executed');
    } catch (err) {
      console.error('AI Request Error', err);
      setError('System Offline. Please try again later.');
      notify('error', err.message || 'AI command failed');
    }
  }, [fetchData, notify]);

  const generateEvidence = useCallback(async (portfolioId) => {
    try {
      if (evidenceLockRef.current) {
        return;
      }

      evidenceLockRef.current = true;
      setEvidenceBusy(true);
      setEvidenceBusyId(portfolioId);

      const response = await fetch(`${API_URL}/api/command/generate-evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioId, user: 'ADMIN', userRole: 'ADMIN' })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Evidence generation failed.');
      }

      await fetchData();
      setError(null);
      notify('success', 'Evidence generated');
    } catch (err) {
      console.error('Evidence Error', err);
      setError('System Offline. Please try again later.');
      notify('error', err.message || 'Evidence generation failed');
    } finally {
      setEvidenceBusy(false);
      setEvidenceBusyId(null);
      evidenceLockRef.current = false;
    }
  }, [fetchData, notify]);

  const runReplay = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/system/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error('Replay failed.');
      }

      await fetchData();
      setError(null);
      notify('success', 'Replay completed');
    } catch (err) {
      console.error('Replay Error', err);
      setError('System Offline. Please try again later.');
      notify('error', err.message || 'Replay failed');
    }
  }, [fetchData, notify]);

  const reverifyIntegrity = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/system/integrity`);
      if (!response.ok) {
        throw new Error('Integrity check failed.');
      }

      const payload = await response.json();
      if (payload.systemIntegrity) {
        setSystemIntegrity(payload.systemIntegrity);
      }

      setError(null);
      notify('success', 'Integrity check complete');
    } catch (err) {
      console.error('Integrity Error', err);
      notify('error', err.message || 'Integrity check failed');
    }
  }, [notify]);

  const downloadEvidence = useCallback(async (hash, format) => {
    try {
      const response = await fetch(`${API_URL}/api/query/evidence/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, format, userRole: 'ADMIN' })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || 'Download failed.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `evidence-${hash}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setError(null);
      notify('success', `Downloaded ${format.toUpperCase()}`);
    } catch (err) {
      console.error('Download Error', err);
      setError('System Offline. Please try again later.');
      notify('error', err.message || 'Download failed');
    }
  }, [notify]);

  const approvedPortfolios = useMemo(
    () => portfolios.filter((portfolio) => portfolio.status === 'APPROVED'),
    [portfolios]
  );

  const acuDeductionCount = useMemo(
    () => events.filter((event) => event.eventType === 'ACU_DEDUCTED').length,
    [events]
  );

  const latestAcuDeductionEvent = useMemo(
    () => events.find((event) => event.eventType === 'ACU_DEDUCTED'),
    [events]
  );

  return (
    <div className="veryx-shell itr-theme">
      <header className="top-bar">
        <div className="top-left">
          <div className="logo">
            VERYX<span>OS</span>
          </div>
        </div>
        <div className="top-center">
          <h2>Integrated Trust Runtime</h2>
        </div>
        <div className="top-right">
          <div className="system-health">
            <span className="dot-indicator" />
            SYSTEM STATUS:
            <span className={error ? 'bad' : 'good'}>{error ? 'OFFLINE' : 'ONLINE'}</span>
            {loading && <span> | SYNCING...</span>}
          </div>
          <button className="btn-replay" onClick={runReplay}>Deterministic Replay</button>
          <div className="event-spine-label">EVENT SPINE</div>
        </div>
      </header>

      <div className="veryx-layout">
        <aside className="sidebar itr-sidebar">
          <nav>
            <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
              Overview
            </button>
            <button className={activeTab === 'governance' ? 'active' : ''} onClick={() => setActiveTab('governance')}>
              Governance
            </button>
            <button className={activeTab === 'finance' ? 'active' : ''} onClick={() => setActiveTab('finance')}>
              Finance
            </button>
            <button className={activeTab === 'workforce' ? 'active' : ''} onClick={() => setActiveTab('workforce')}>
              Workforce
            </button>
            <button className={activeTab === 'ai' ? 'active' : ''} onClick={() => setActiveTab('ai')}>
              AI Intelligence
            </button>
            <button className={activeTab === 'operations' ? 'active' : ''} onClick={() => setActiveTab('operations')}>
              Operations
            </button>
            <button className={activeTab === 'evidence' ? 'active' : ''} onClick={() => setActiveTab('evidence')}>
              Evidence Vault
            </button>
            <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
              Settings
            </button>
          </nav>
          <div className="sidebar-footer">
            <p>User: Admin_01</p>
            <p>Role: Enterprise Control</p>
          </div>
        </aside>

        <main className="main-content">
          {notification && (
            <div className={`toast ${notification.type}`}>
              {notification.message}
            </div>
          )}

          <section className="workspace">
            {error && (
              <div className="action-card itr-card">
                <strong>System Offline</strong>
                <p>{error}</p>
              </div>
            )}

            {activeTab === 'overview' && (
              <div className="tab-view animate-fade">
                <div className="overview-grid">
                  <div className="data-card itr-card">
                    <h4>Total Portfolios</h4>
                    <p className="metric">{portfolios.length}</p>
                  </div>
                  <div className="data-card itr-card">
                    <h4>Approved Portfolios</h4>
                    <p className="metric">{approvedPortfolios.length}</p>
                  </div>
                  <div className="data-card itr-card">
                    <h4>Workforce Size</h4>
                    <p className="metric">{workforce.length}</p>
                  </div>
                  <div className="data-card itr-card">
                    <h4>Active Assets</h4>
                    <p className="metric">{assets.length}</p>
                  </div>
                  <div className="data-card itr-card">
                    <h4>Evidence Packs</h4>
                    <p className="metric">{evidence.length}</p>
                  </div>
                  <div className="data-card itr-card">
                    <h4>Current ACU Balance</h4>
                    <p className="metric">{acuBalance}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'governance' && (
              <div className="tab-view animate-fade">
                <div className="action-card itr-card">
                  <h3>New Initiative</h3>
                  <div className="input-row">
                    <input
                      placeholder="Name"
                      value={projectForm.name}
                      onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}
                    />
                    <input
                      placeholder="Budget"
                      type="number"
                      value={projectForm.budget}
                      onChange={(event) => setProjectForm({ ...projectForm, budget: event.target.value })}
                    />
                    <input
                      placeholder="Score"
                      type="number"
                      value={projectForm.score}
                      onChange={(event) => setProjectForm({ ...projectForm, score: event.target.value })}
                    />
                    <button onClick={createPortfolio}>Create</button>
                  </div>
                </div>

                <div className="data-card itr-card">
                  <h4>Carbon / ESG</h4>
                  <p className="metric">
                    S1 {toNumber(esgSummary.scope1)} | S2 {toNumber(esgSummary.scope2)} | S3 {toNumber(esgSummary.scope3)}
                  </p>
                </div>

                <div className="grid">
                  {portfolios.map((portfolio) => (
                    <div key={portfolio.id} className="data-card itr-card">
                      <h4>{portfolio.name}</h4>
                      <p>ID: {portfolio.id.substring(0, 8)}</p>
                      <p>Score: {toNumber(portfolio.score)}</p>
                      <div className={`status-tag ${portfolio.status}`}>{portfolio.status}</div>

                      {portfolio.status === 'PENDING_APPROVAL' && (
                        <button className="btn-action" onClick={() => approvePortfolio(portfolio.id)}>
                          Approve Gate
                        </button>
                      )}

                      <button
                        className="btn-action"
                        disabled={
                          portfolio.status !== 'APPROVED' ||
                          (evidenceBusy && evidenceBusyId === portfolio.id) ||
                          evidenceGenerated[portfolio.id]
                        }
                        aria-disabled={portfolio.status !== 'APPROVED' || (evidenceBusy && evidenceBusyId === portfolio.id)}
                        onClick={() => generateEvidence(portfolio.id)}
                      >
                        {evidenceGenerated[portfolio.id]
                          ? 'Evidence Generated'
                          : evidenceBusy && evidenceBusyId === portfolio.id
                          ? 'Generating Evidence...'
                          : 'Generate Court-Grade Evidence'}
                      </button>
                    </div>
                  ))}

                  {portfolios.length === 0 && (
                    <div className="data-card itr-card empty-state">
                      No initiatives yet. Create one to begin governance workflows.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'finance' && (
              <div className="tab-view animate-fade">
                <div className="action-card itr-card">
                  <h3>Log Expense</h3>
                  <div className="input-row finance-input-row">
                    <select
                      value={expenseForm.portfolioId}
                      onChange={(event) => setExpenseForm({ ...expenseForm, portfolioId: event.target.value })}
                    >
                      <option value="">Select portfolio</option>
                      {approvedPortfolios.map((portfolio) => (
                        <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
                      ))}
                    </select>
                    <input
                      placeholder="Amount"
                      type="number"
                      value={expenseForm.amount}
                      onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
                    />
                    <input
                      placeholder="Description"
                      value={expenseForm.description}
                      onChange={(event) => setExpenseForm({ ...expenseForm, description: event.target.value })}
                    />
                    <button onClick={logExpense}>Log</button>
                  </div>
                </div>

                <div className="grid">
                  {approvedPortfolios.map((portfolio) => {
                    const balance = toNumber(portfolio.balance);
                    const initialBudget = toNumber(portfolio.initialBudget, 1);
                    const progress = Math.max(0, Math.min(100, (balance / initialBudget) * 100));
                    const cpi = toNumber(portfolio.cpi, 0);

                    return (
                      <div key={portfolio.id} className="finance-card itr-card">
                        <header>
                          <h4>{portfolio.name}</h4>
                          <span className={cpi < 1 ? 'bad' : 'good'}>CPI: {cpi.toFixed(2)}</span>
                        </header>
                        <div className="stats">
                          <div>
                            <small>Balance</small>
                            <strong>{formatCurrency(balance)}</strong>
                          </div>
                          <div>
                            <small>Initial Budget</small>
                            <strong>{formatCurrency(initialBudget)}</strong>
                          </div>
                          <div className="progress-container itr-progress-track">
                            <div className="progress-fill itr-progress-fill" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {approvedPortfolios.length === 0 && (
                    <div className="finance-card itr-card empty-state">
                      Approve a portfolio to track CPI and balance in Finance.
                    </div>
                  )}
                </div>

                <div className="data-card itr-card">
                  <h4>Recent Expenses</h4>
                  <table className="staff-table itr-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Portfolio</th>
                        <th>Description</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.slice().reverse().map((expense) => {
                        const portfolio = portfolios.find((item) => item.id === expense.portfolioId);
                        return (
                          <tr key={expense.id}>
                            <td>{new Date(expense.timestamp).toLocaleString()}</td>
                            <td>{portfolio ? portfolio.name : expense.portfolioId?.substring(0, 8)}</td>
                            <td>{expense.description}</td>
                            <td>{formatCurrency(expense.amount)}</td>
                          </tr>
                        );
                      })}
                      {expenses.length === 0 && (
                        <tr>
                          <td colSpan={4} className="table-empty">No expenses logged yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'workforce' && (
              <div className="tab-view animate-fade">
                <div className="action-card itr-card">
                  <h3>Onboard Resource</h3>
                  <div className="input-row staff-input-row">
                    <input
                      placeholder="Staff Name"
                      value={staffForm.name}
                      onChange={(event) => setStaffForm({ ...staffForm, name: event.target.value })}
                    />
                    <input
                      placeholder="Role"
                      value={staffForm.skill}
                      onChange={(event) => setStaffForm({ ...staffForm, skill: event.target.value })}
                    />
                    <button onClick={addResource}>Add</button>
                  </div>
                </div>

                <table className="staff-table itr-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Skill</th>
                      <th>Total Hours</th>
                      <th>Utilization</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workforce.map((member) => {
                      const utilization = Math.max(0, Math.min(100, toNumber(member.utilization)));
                      return (
                        <tr key={member.id}>
                          <td>{member.name}</td>
                          <td>{member.skill}</td>
                          <td>{toNumber(member.totalHours)}</td>
                          <td>
                            <div className="util-bar itr-progress-track">
                              <div className="util-fill itr-progress-fill" style={{ width: `${utilization}%` }} />
                            </div>
                            {utilization}%
                          </td>
                          <td>
                            <button onClick={() => logTimesheet(member.id)}>Log Time</button>
                          </td>
                        </tr>
                      );
                    })}
                    {workforce.length === 0 && (
                      <tr>
                        <td colSpan={5} className="table-empty">No staff records yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="tab-view animate-fade">
                <div className="ai-header itr-card">
                  <div>
                    <h3>AI Intelligence</h3>
                    <p className="muted">Operational AI command center with ACU usage ledger.</p>
                  </div>
                  <div className="ai-stats">
                    <div className="stat-pill">ACU Balance: {acuBalance}</div>
                    <div className="stat-pill">ACU Deductions: {acuDeductionCount}</div>
                  </div>
                </div>

                <div className="action-panel">
                  <button
                    className="btn-action-lg"
                    disabled={acuBalance <= 0}
                    onClick={() => requestAI('Reasoning/Forecasting', 'Run portfolio forecasting.')}
                  >
                    <span className="btn-icon">A</span>
                    Run Portfolio Forecasting (OpenAI)
                  </button>
                  <button
                    className="btn-action-lg"
                    disabled={acuBalance <= 0}
                    onClick={() => requestAI('Vision/Docs', 'Analyze assets with vision and docs.')}
                  >
                    <span className="btn-icon">G</span>
                    Analyze Assets Vision (Gemini)
                  </button>
                </div>

                <div className="activity-panel itr-card">
                  <div className="panel-title">Recent AI Actions</div>
                  <table className="staff-table itr-table">
                    <thead>
                      <tr>
                        <th>Timestamp</th>
                        <th>Request</th>
                        <th>Provider</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiResults
                        .slice()
                        .reverse()
                        .map((result) => (
                          <tr key={result.id}>
                            <td>{new Date(result.timestamp).toLocaleString()}</td>
                            <td>{result.requestType}</td>
                            <td>{result.provider}</td>
                            <td>{result.result}</td>
                          </tr>
                        ))}
                      {aiResults.length === 0 && (
                        <tr>
                          <td colSpan={4} className="table-empty">No AI actions recorded yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="data-card itr-card">
                  <h4>ACU Deduction Ledger</h4>
                  <p>Total ACU spent: {acuDeductionCount * 10}</p>
                  <p>
                    Last deduction:
                    {' '}
                    {latestAcuDeductionEvent
                      ? new Date(latestAcuDeductionEvent.meta.timestamp).toLocaleString()
                      : 'No deductions yet'}
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'operations' && (
              <div className="tab-view animate-fade">
                <div className="action-card itr-card">
                  <h3>Register Asset</h3>
                  <div className="input-row">
                    <input
                      placeholder="Asset Name"
                      value={assetForm.name}
                      onChange={(event) => setAssetForm({ ...assetForm, name: event.target.value })}
                    />
                    <input
                      placeholder="Asset Type"
                      value={assetForm.kind}
                      onChange={(event) => setAssetForm({ ...assetForm, kind: event.target.value })}
                    />
                    <select
                      value={assetForm.portfolioId}
                      onChange={(event) => setAssetForm({ ...assetForm, portfolioId: event.target.value })}
                    >
                      <option value="">Select portfolio</option>
                      {portfolios.map((portfolio) => (
                        <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
                      ))}
                    </select>
                    <button onClick={registerAsset}>Register</button>
                  </div>
                </div>

                <div className="grid">
                  {assets.map((asset) => (
                    <div key={asset.id} className="data-card itr-card">
                      <h4>{asset.name}</h4>
                      <p>Type: {asset.kind}</p>
                      <p>Portfolio: {asset.portfolioId ? asset.portfolioId.substring(0, 8) : 'N/A'}</p>
                      <p>Work Orders: {toNumber(asset.workOrderCount)}</p>
                      <div className={`status-tag ${asset.status}`}>{asset.status}</div>
                      <p>
                        Last Work Order:
                        {' '}
                        {asset.lastWorkOrder
                          ? `${asset.lastWorkOrder.summary} (${new Date(asset.lastWorkOrder.timestamp).toLocaleString()})`
                          : 'None'}
                      </p>
                      <button className="btn-action" onClick={() => issueWorkOrder(asset.id)}>Issue Work Order</button>
                    </div>
                  ))}

                  {assets.length === 0 && (
                    <div className="data-card itr-card empty-state">
                      No assets registered yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'evidence' && (
              <div className="tab-view animate-fade watermark">
                <div className="grid">
                  {evidence.map((pack) => (
                    <div key={pack.id} className="data-card itr-card certificate-style">
                      <h4>Certificate of Evidence</h4>
                      <p><strong>Portfolio:</strong> {pack.portfolioId ? pack.portfolioId.substring(0, 8) : 'N/A'}</p>
                      <p><strong>Audit Hash:</strong> {pack.id}</p>
                      <p><strong>Timestamp:</strong> {new Date(pack.timestamp).toLocaleString()}</p>
                      <p><strong>Status:</strong> {pack.status}</p>
                      <div className="status-tag APPROVED">VERIFIED</div>
                      <div className="download-row">
                        <button className="btn-action" onClick={() => downloadEvidence(pack.id, 'pdf')}>Download PDF</button>
                        <button className="btn-action" onClick={() => downloadEvidence(pack.id, 'json')}>Download JSON</button>
                      </div>
                    </div>
                  ))}

                  {evidence.length === 0 && (
                    <div className="data-card itr-card empty-state">
                      No evidence packs available yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="tab-view animate-fade settings-grid">
                <div className="data-card itr-card">
                  <h3>Integrity Check</h3>
                  <p className={`metric ${systemIntegrity === 'VERIFIED' ? 'good' : 'bad'}`}>
                    {systemIntegrity}
                  </p>
                  <button className="btn-action" onClick={reverifyIntegrity}>Re-Verify</button>
                </div>

                <div className="data-card itr-card">
                  <h3>System Totals</h3>
                  <p>Events: {events.length}</p>
                  <p>Evidence Packs: {evidence.length}</p>
                  <p>Assets: {assets.length}</p>
                  <p>Workforce: {workforce.length}</p>
                </div>

                <div className="data-card itr-card settings-wide">
                  <h3>API Connection URL</h3>
                  <p>{API_URL}</p>
                </div>
              </div>
            )}
          </section>
        </main>

        <aside className="audit-sidebar">
          <div className="spine-title">EVENT SPINE</div>
          <div className="event-list">
            {events.map((event) => (
              <div key={event.eventId} className="event-item">
                <div className="dot" />
                <div className="event-info">
                  <strong>{event.eventType}</strong>
                  <p>Hash: {event.meta.auditHash.substring(0, 12)}...</p>
                  <small>{new Date(event.meta.timestamp).toLocaleTimeString()}</small>
                </div>
              </div>
            ))}

            {events.length === 0 && (
              <p className="muted">No event history available.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
