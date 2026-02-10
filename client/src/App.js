import React, { useState, useEffect } from 'react';
import './App.css';

const API_URL = 'https://psychic-waddle-q7jw959jqxx7cxw5v-5000.app.github.dev';

function App() {
  const [activeTab, setActiveTab] = useState('governance');
  const [portfolios, setPortfolios] = useState([]);
  const [workforce, setWorkforce] = useState([]);
  const [events, setEvents] = useState([]);

  const [projectForm, setProjectForm] = useState({ name: '', budget: '', score: '' });
  const [staffForm, setStaffForm] = useState({ name: '', skill: '' });

  const fetchData = async () => {
    try {
      const res = await fetch(`${API_URL}/api/query/state`);
      const data = await res.json();
      if (data.portfolios) setPortfolios(data.portfolios);
      if (data.workforce) setWorkforce(data.workforce);

      const auditRes = await fetch(`${API_URL}/api/query/audit-log`);
      const auditData = await auditRes.json();
      setEvents(auditData.reverse());
    } catch (err) {
      console.error('Sync Error', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const executeCommand = async (path, body) => {
    await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    fetchData();
  };

  return (
    <div className="veryx-layout">
      <aside className="sidebar">
        <div className="logo">
          VERYX<span>OS</span>
        </div>
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
        </nav>
        <div className="sidebar-footer">
          <p>User: Admin_01</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-bar">
          <h2>{activeTab.toUpperCase()} / CONTROL CENTER</h2>
          <div className="top-actions">
            <div className="system-health">
              SYSTEM STATUS: <span className="green">ONLINE</span>
            </div>
            <button className="btn-replay">Deterministic Replay</button>
          </div>
        </header>

        <section className="workspace">
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
                            user: 'MANAGER'
                          })
                        }
                      >
                        Approve Gate
                      </button>
                    )}
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
        </section>
      </main>

      <aside className="audit-sidebar">
        <h3>EVENT SPINE</h3>
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
  );
}

export default App;
