import React, { useState, useEffect } from 'react';
import './App.css';

// Update API_URL to use the full GitHub proxy URL without a trailing slash
const API_URL = "https://psychic-waddle-q7jw959jqxx7cxw5v-5000.app.github.dev"; // Replace with your actual GitHub proxy URL

function App() {
  const [portfolios, setPortfolios] = useState([]);
  const [events, setEvents] = useState([]);
  const [newProject, setNewProject] = useState({ name: '', budget: '', score: '' });
  const [workforce, setWorkforce] = useState([]);
  const [newStaff, setNewStaff] = useState({ name: '', skill: '' });
  const [expense, setExpense] = useState({ id: '', amount: '', desc: '' });

  const fetchState = async () => {
    try {
      const res = await fetch(`${API_URL}/api/query/state`);
      const data = await res.json();
      if (data) {
        if (data.portfolios) setPortfolios(data.portfolios);
        if (data.workforce) setWorkforce(data.workforce);
      }
    } catch (err) { console.error(err); }
  };

  const fetchAuditLog = async () => {
    try {
      const res = await fetch(`${API_URL}/api/query/audit-log`);
      const data = await res.json();
      if (Array.isArray(data)) setEvents(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    fetchState(); fetchAuditLog();
    const interval = setInterval(() => { fetchState(); fetchAuditLog(); }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if (!newProject.name || !newProject.budget) return;
    await fetch(`${API_URL}/api/command/create-portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newProject.name,
        budget: parseInt(newProject.budget),
        score: parseInt(newProject.score) || 0,
        user: 'admin@veryx.com'
      })
    });
    setNewProject({ name: '', budget: '', score: '' });
  };

  const handleApprove = async (id) => {
    await fetch(`${API_URL}/api/command/approve-portfolio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolioId: id, user: 'manager@veryx.com' })
    });
  };

  const handleAddStaff = async () => {
    await fetch(`${API_URL}/api/command/add-resource`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newStaff, user: 'hr@veryx.com' })
    });
    setNewStaff({ name: '', skill: '' });
};

const handleTimesheet = async (id) => {
    const hours = prompt("Enter hours worked:");
    if (!hours) return;
    await fetch(`${API_URL}/api/command/log-timesheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: id, hours: parseInt(hours), user: 'staff@veryx.com' })
    });
};

  return (
    <div className="App">
      <header className="header">
        <h1>VERYX ENTERPRISE OS</h1>
        <span className="status">Phase 2: Governance & Control</span>
      </header>

      <div className="container">
        <div className="card">
          <h2>Create Portfolio</h2>
          <input placeholder="Project Name" value={newProject.name} onChange={(e) => setNewProject({...newProject, name: e.target.value})} />
          <input placeholder="Budget ($)" type="number" value={newProject.budget} onChange={(e) => setNewProject({...newProject, budget: e.target.value})} />
          <input placeholder="Portfolio Score (1-10)" type="number" value={newProject.score} onChange={(e) => setNewProject({...newProject, score: e.target.value})} />
          <button onClick={handleCreate}>Execute Command</button>
        </div>

        <div className="card">
          <h2>Live Portfolios (Stage-Gate)</h2>
          <ul>
            {portfolios.map(p => (
              <li key={p.id}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                   <span><strong>{p.name}</strong> (Score: {p.score})</span>
                   <span className={`badge ${p.status}`}>{p.status}</span>
                </div>
                {p.status === 'PENDING_APPROVAL' && (
                  <button className="btn-approve" onClick={() => handleApprove(p.id)}>Approve Stage-Gate</button>
                )}
                <div>
                  <h3>Portfolio Balance: {p.balance}</h3>
                  <h3 className={p.cpi > 1 ? 'green' : 'red'}>CPI: {p.cpi}</h3>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="card dark">
          <h2>Audit Log</h2>
          <div className="log-window">
            {events.reverse().map((e, i) => (
              <div key={i} className="log-entry">
                <span className="time">{new Date(e.meta.timestamp).toLocaleTimeString()}</span>
                <span className="type">{e.eventType}</span>
                <br/><span className="hash">Hash: {e.meta.auditHash.substring(0, 10)}...</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Workforce (Utilization)</h2>
          <div className="add-box">
            <input placeholder="Staff Name" value={newStaff.name} onChange={(e)=>setNewStaff({...newStaff, name:e.target.value})} />
            <button onClick={handleAddStaff}>Add Staff</button>
          </div>
          <ul>
            {workforce.map(w => (
              <li key={w.id} onClick={() => handleTimesheet(w.id)} style={{cursor:'pointer'}}>
                <strong>{w.name}</strong> ({w.skill})
                <div className="progress-bar">
                   <div className="progress" style={{width: `${w.utilization}%`}}></div>
                </div>
                <small>{w.utilization}% Utilized</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;