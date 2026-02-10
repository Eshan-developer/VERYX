import React, { useState, useEffect } from 'react';
import './App.css';

// VERYX PHASE 1: CORE UI
// Shows Event Sourcing in Action

// 🔴 PASTE YOUR PORT 5000 LINK HERE (Do not add a trailing slash / at the end)
// Example: const API_URL = "https://psychic-waddle-5000.github.dev";
const API_URL = "https://psychic-waddle-q7jw959jqxx7cxw5v-5000.app.github.dev//"; 

function App() {
  const [portfolios, setPortfolios] = useState([]);
  const [events, setEvents] = useState([]);
  const [newProject, setNewProject] = useState({ name: '', budget: '' });

  // 1. FETCH CURRENT STATE (Read Model)
  const fetchState = async () => {
    try {
      const res = await fetch(`${API_URL}/api/query/state`);
      const data = await res.json();
      // Safety Check: Ensure data is valid
      if (data && data.portfolios) {
        setPortfolios(data.portfolios);
      }
    } catch (err) {
      console.error("Backend Connection Failed:", err);
    }
  };

  // 2. FETCH AUDIT LOG (Event Store)
  const fetchAuditLog = async () => {
    try {
      const res = await fetch(`${API_URL}/api/query/audit-log`);
      const data = await res.json();
      // Safety Check: Ensure data is an array
      if (Array.isArray(data)) {
        setEvents(data);
      } else {
        console.error("Data is not an array:", data);
        setEvents([]); // Prevent crash
      }
    } catch (err) {
      console.error("Audit Log Fetch Failed:", err);
      setEvents([]);
    }
  };

  useEffect(() => {
    fetchState();
    fetchAuditLog();
    const interval = setInterval(() => { fetchState(); fetchAuditLog(); }, 2000);
    return () => clearInterval(interval);
  }, []);

  // 3. CREATE COMMAND (Write Model)
  const handleCreate = async () => {
    if (!newProject.name || !newProject.budget) return;
    
    try {
      await fetch(`${API_URL}/api/command/create-portfolio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProject.name,
          budget: parseInt(newProject.budget),
          user: 'admin@veryx.com'
        })
      });
      setNewProject({ name: '', budget: '' });
      fetchState();
      fetchAuditLog();
    } catch (err) {
      alert("Failed to send command. Is backend running?");
    }
  };

  return (
    <div className="App">
      <header className="header">
        <h1>VERYX ENTERPRISE OS</h1>
        <span className="status">Mode: Event Sourced (Active)</span>
      </header>

      <div className="container">
        {/* LEFT: COMMAND PANEL */}
        <div className="card">
          <h2>Create Portfolio (Command)</h2>
          <input 
            placeholder="Project Name" 
            value={newProject.name}
            onChange={(e) => setNewProject({...newProject, name: e.target.value})}
          />
          <input 
            placeholder="Budget ($)" 
            type="number"
            value={newProject.budget}
            onChange={(e) => setNewProject({...newProject, budget: e.target.value})}
          />
          <button onClick={handleCreate}>Execute Command</button>
        </div>

        {/* MIDDLE: READ MODEL (Current State) */}
        <div className="card">
          <h2>Live Portfolios (Projection)</h2>
          <ul>
            {portfolios.map(p => (
              <li key={p.id}>
                <strong>{p.name}</strong> - Budget: ${p.budget}
                <span className="badge">ACTIVE</span>
              </li>
            ))}
          </ul>
        </div>

        {/* RIGHT: EVENT LOG (Immutable History) */}
        <div className="card dark">
          <h2>System Audit Log (Immutable)</h2>
          <div className="log-window">
            {events.length === 0 ? <p style={{padding:10}}>No events yet...</p> : events.map((e, i) => (
              <div key={i} className="log-entry">
                <span className="time">{new Date(e.meta.timestamp).toLocaleTimeString()}</span>
                <span className="type">{e.eventType}</span>
                <br/>
                <span className="hash">Hash: {e.meta.auditHash ? e.meta.auditHash.substring(0, 10) : 'N/A'}...</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;