import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'https://psychic-waddle-q7jw959jqxx7cxw5v-5000.app.github.dev';

function App() {
  const [activeTab, setActiveTab] = useState('governance');
  const [portfolios, setPortfolios] = useState([]);
  const [workforce, setWorkforce] = useState([]);
  const [events, setEvents] = useState([]);
  const [assets, setAssets] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [acuBalance, setAcuBalance] = useState(100);
  const [esgSummary, setEsgSummary] = useState({ scope1: 0, scope2: 0, scope3: 0 });
  const [systemIntegrity, setSystemIntegrity] = useState('VERIFIED');
  const [notification, setNotification] = useState(null);

  const [projectForm, setProjectForm] = useState({ name: '', budget: '', score: '' });
  const [staffForm, setStaffForm] = useState({ name: '', skill: '' });
  const [assetForm, setAssetForm] = useState({ name: '', kind: '', portfolioId: '' });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const notify = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/query/state`);
      if (!res.ok) throw new Error('Failed to fetch state');
      const data = await res.json();
      if (data.portfolios) setPortfolios(data.portfolios);
      if (data.workforce) setWorkforce(data.workforce);
      if (data.assets) setAssets(data.assets);
      if (data.evidencePacks) setEvidence(data.evidencePacks);
      if (data.esgSummary) setEsgSummary(data.esgSummary);
      if (data.systemIntegrity) setSystemIntegrity(data.systemIntegrity);
      if (typeof data.acuBalance === 'number') setAcuBalance(data.acuBalance);

      const auditRes = await fetch(`${API_URL}/api/query/audit-log`);
      if (!auditRes.ok) throw new Error('Failed to fetch audit log');
      const auditData = await auditRes.json();
      setEvents(auditData.reverse());

      const integrityRes = await fetch(`${API_URL}/api/system/integrity`);
      if (integrityRes.ok) {
        const integrityData = await integrityRes.json();
        if (integrityData.systemIntegrity) setSystemIntegrity(integrityData.systemIntegrity);
      }
    } catch (err) {
      console.error('Sync Error', err);
      setError('System Offline. Please try again later.');
      notify('error', 'System Offline');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const executeCommand = async (path, body) => {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('Command failed');
      setError(null);
      notify('success', 'Command executed');
      fetchData();
    } catch (err) {
      console.error('Command Error', err);
      setError('System Offline. Please try again later.');
      notify('error', 'Command failed');
    }
  };

  const requestAI = async (requestType, prompt) => {
    try {
      const res = await fetch(`${API_URL}/api/command/request-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType, prompt, user: 'ADMIN' })
      });

      if (!res.ok) {
        if (res.status === 403) {
          alert('ACU balance is zero. AI commands are blocked.');
        }
        setError('System Offline. Please try again later.');
        notify('error', 'AI command blocked');
        return;
      }

      setError(null);
      notify('success', 'AI command executed');
      fetchData();
    } catch (err) {
      console.error('AI Request Error', err);
      setError('System Offline. Please try again later.');
      notify('error', 'AI command failed');
    }
  };

  const generateEvidence = async (portfolioId) => {
    try {
      const res = await fetch(`${API_URL}/api/command/generate-evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioId, user: 'ADMIN', userRole: 'ADMIN' })
      });

      if (!res.ok) {
        if (res.status === 403) {
          alert('Evidence export requires APPROVED status.');
        }
        setError('System Offline. Please try again later.');
        notify('error', 'Evidence generation blocked');
        return;
      }

      setError(null);
      notify('success', 'Evidence generated');
      fetchData();
    } catch (err) {
      console.error('Evidence Error', err);
      setError('System Offline. Please try again later.');
      notify('error', 'Evidence generation failed');
    }
  };

  const runReplay = async () => {
    try {
      const res = await fetch(`${API_URL}/api/system/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!res.ok) {
        throw new Error('Failed to replay events');
      }

      await res.json();
      setError(null);
      notify('success', 'Replay completed');
      fetchData();
    } catch (err) {
      console.error('Replay Error', err);
      setError('System Offline. Please try again later.');
      notify('error', 'Replay failed');
    }
  };

  const downloadEvidence = async (hash, format) => {
    try {
      const res = await fetch(`${API_URL}/api/query/evidence/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash, format, userRole: 'ADMIN' })
      });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
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
      notify('error', 'Download failed');
    }
  };

  return (
    <div className="veryx-shell">
      <header className="top-bar">
        <div className="top-left">
          <div className="logo">
            VERYX<span>OS</span>
          </div>
        </div>
        <div className="top-center">
          <h2></h2>
        </div>
        <div className="top-right">
          <div className="system-health">
            <span className="dot-indicator" />
            SYSTEM STATUS:{' '}
            <span className={error ? 'bad' : 'green'}>{error ? 'OFFLINE' : 'ONLINE'}</span>
            {loading && <span> | SYNCING...</span>}
          </div>
          <button className="btn-replay" onClick={runReplay}>Deterministic Replay</button>
          <div className="event-spine-label">EVENT SPINE</div>
        </div>
      </header>

      <div className="veryx-layout">
        <aside className="sidebar">
          <nav>
            <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
              📊 Overview
            </button>
            <button className={activeTab === 'governance' ? 'active' : ''} onClick={() => setActiveTab('governance')}>
              🏛️ Governance
            </button>
            <button className={activeTab === 'finance' ? 'active' : ''} onClick={() => setActiveTab('finance')}>
              💰 Finance
            </button>
            <button className={activeTab === 'workforce' ? 'active' : ''} onClick={() => setActiveTab('workforce')}>
              👥 Workforce
            </button>
            <button className={activeTab === 'ai' ? 'active' : ''} onClick={() => setActiveTab('ai')}>
              🧠 AI Intelligence
            </button>
          <button className={activeTab === 'operations' ? 'active' : ''} onClick={() => setActiveTab('operations')}>
            ⚙️ Operations
          </button>
          <button className={activeTab === 'evidence' ? 'active' : ''} onClick={() => setActiveTab('evidence')}>
            📜 Evidence Vault
          </button>
          <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
            ⚙️ Settings
          </button>
        </nav>
          <div className="sidebar-footer">
            <p>User: Admin_01</p>
          </div>
        </aside>

        <main className="main-content">
          <section className="workspace">
          {error && (
            <div className="action-card">
              <strong>System Offline</strong>
              <p>{error}</p>
            </div>
          )}
          {activeTab === 'overview' && (
            <div className="tab-view animate-fade">
              <div className="overview-grid">
                <div className="data-card">
                  <h4>Total Portfolios</h4>
                  <p className="metric">{portfolios.length}</p>
                </div>
                <div className="data-card">
                  <h4>Approved Portfolios</h4>
                  <p className="metric">{portfolios.filter((p) => p.status === 'APPROVED').length}</p>
                </div>
                <div className="data-card">
                  <h4>Workforce Size</h4>
                  <p className="metric">{workforce.length}</p>
                </div>
                <div className="data-card">
                  <h4>Event Spine Entries</h4>
                  <p className="metric">{events.length}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'governance' && (
            <div className="tab-view animate-fade">
              <div className="action-card">
                <h3>New Initiative</h3>
                <div className="input-row">
                  <input
                    placeholder="Name"
                    value={projectForm.name}
                    onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  />
                  <input
                    placeholder="Budget"
                    type="number"
                    value={projectForm.budget}
                    onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })}
                  />
                  <input
                    placeholder="Score"
                    type="number"
                    value={projectForm.score}
                    onChange={(e) => setProjectForm({ ...projectForm, score: e.target.value })}
                  />
                  <button
                    onClick={() => executeCommand('/api/command/create-portfolio', { ...projectForm, user: 'ADMIN' })}
                  >
                    Create
                  </button>
                </div>
              </div>
              <div className="data-card">
                <h4>Carbon/ESG</h4>
                <p className="metric">
                  S1 {esgSummary.scope1} | S2 {esgSummary.scope2} | S3 {esgSummary.scope3}
                </p>
              </div>
              <div className="grid">
                {portfolios.map((p) => (
                  <div key={p.id} className="data-card">
                    <h4>{p.name}</h4>
                    <p>ID: {p.id.substring(0, 8)}</p>
                    <div className={`status-tag ${p.status}`}>{p.status}</div>
                    {p.status === 'PENDING_APPROVAL' && (
                      <button
                        className="btn-action"
                        onClick={() =>
                          executeCommand('/api/command/approve-portfolio', {
                            portfolioId: p.id,
                            user: 'MANAGER',
                            userRole: 'MANAGER'
                          })
                        }
                      >
                        Approve Gate
                      </button>
                    )}
                    <button
                      className="btn-action"
                      disabled={p.status !== 'APPROVED'}
                      onClick={() => generateEvidence(p.id)}
                    >
                      Generate Court-Grade Evidence
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'finance' && (
            <div className="tab-view animate-fade">
              <div className="grid">
                {portfolios
                  .filter((p) => p.status === 'APPROVED')
                  .map((p) => (
                    <div key={p.id} className="finance-card">
                      <header>
                        <h4>{p.name}</h4>
                        <span className={p.cpi < 1 ? 'bad' : 'good'}>CPI: {p.cpi}</span>
                      </header>
                      <div className="stats">
                        <div>
                          <small>Balance</small>
                          <strong>${p.balance}</strong>
                        </div>
                        <div className="progress-container">
                          <div className="progress-fill" style={{ width: `${(p.balance / p.initialBudget) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeTab === 'workforce' && (
            <div className="tab-view animate-fade">
              <div className="action-card">
                <h3>Onboard Resource</h3>
                <div className="input-row staff-input-row">
                  <input
                    placeholder="Staff Name"
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                  />
                  <input
                    placeholder="Role"
                    value={staffForm.skill}
                    onChange={(e) => setStaffForm({ ...staffForm, skill: e.target.value })}
                  />
                  <button onClick={() => executeCommand('/api/command/add-resource', { ...staffForm, user: 'HR' })}>Add</button>
                </div>
              </div>
              <table className="staff-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Skill</th>
                    <th>Utilization</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workforce.map((w) => (
                    <tr key={w.id}>
                      <td>{w.name}</td>
                      <td>{w.skill}</td>
                      <td>
                        <div className="util-bar">
                          <div className="util-fill" style={{ width: `${w.utilization}%` }} />
                        </div>
                        {w.utilization}%
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            const h = prompt('Hours?');
                            if (h) executeCommand('/api/command/log-timesheet', { resourceId: w.id, hours: h, user: 'USER' });
                          }}
                        >
                          Log Time
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="tab-view animate-fade">
              <div className="ai-header">
                <div>
                  <h3>AI Intelligence</h3>
                  <p className="muted">Operational AI command center</p>
                </div>
                <div className="stat-pill">Current ACU Balance: {acuBalance}</div>
              </div>

              <div className="action-panel">
                <button
                  className="btn-action-lg"
                  disabled={acuBalance <= 0}
                  onClick={() => requestAI('Reasoning/Forecasting', 'Run portfolio forecasting.')}
                >
                  <span className="btn-icon">◎</span>
                  Run Portfolio Forecasting (OpenAI)
                </button>
                <button
                  className="btn-action-lg"
                  disabled={acuBalance <= 0}
                  onClick={() => requestAI('Vision/Docs', 'Analyze assets with vision and docs.')}
                >
                  <span className="btn-icon">◈</span>
                  Analyze Assets Vision (Gemini)
                </button>
              </div>

              <div className="activity-panel">
                <div className="panel-title">Recent AI Actions</div>
                <div className="panel-placeholder">
                  AI results and evidence trails will appear here.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'operations' && (
            <div className="tab-view animate-fade">
              <div className="action-card">
                <h3>Register Asset</h3>
                <div className="input-row">
                  <input
                    placeholder="Asset Name"
                    value={assetForm.name}
                    onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
                  />
                  <input
                    placeholder="Asset Type"
                    value={assetForm.kind}
                    onChange={(e) => setAssetForm({ ...assetForm, kind: e.target.value })}
                  />
                  <input
                    placeholder="Portfolio ID"
                    value={assetForm.portfolioId}
                    onChange={(e) => setAssetForm({ ...assetForm, portfolioId: e.target.value })}
                  />
                  <button
                    onClick={() =>
                      executeCommand('/api/command/register-asset', { ...assetForm, user: 'OPS' })
                    }
                  >
                    Register
                  </button>
                </div>
              </div>
              <div className="grid">
                {assets.map((asset) => (
                  <div key={asset.id} className="data-card">
                    <h4>{asset.name}</h4>
                    <p>Type: {asset.kind}</p>
                    <p>Portfolio: {asset.portfolioId ? asset.portfolioId.substring(0, 8) : 'N/A'}</p>
                    <div className="status-tag">{asset.status}</div>
                    <button
                      className="btn-action"
                      onClick={() => {
                        const summary = prompt('Work order summary?');
                        if (summary) {
                          executeCommand('/api/command/issue-work-order', { assetId: asset.id, summary, user: 'OPS' });
                        }
                      }}
                    >
                      Issue Work Order
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'evidence' && (
            <div className="tab-view animate-fade watermark">
              <div className="grid">
                {evidence.map((pack) => (
                  <div key={pack.id} className="data-card certificate-style">
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
              </div>
            </div>
          )}
          </section>
        </main>

        <aside className="audit-sidebar">
          <div className="spine-title">EVENT SPINE</div>
          <div className="event-list">
            {events.map((e, i) => (
              <div key={i} className="event-item">
                <div className="dot" />
                <div className="event-info">
                  <strong>{e.eventType}</strong>
                  <p>Hash: {e.meta.auditHash.substring(0, 12)}...</p>
                  <small>{new Date(e.meta.timestamp).toLocaleTimeString()}</small>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
