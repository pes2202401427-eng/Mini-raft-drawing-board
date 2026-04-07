// frontend/dashboard.js — Roopashree
// Polls gateway + each replica every 2 seconds
// Shows live cluster state in the bottom-right panel

function initDashboard() {
  const els = {
    leader:  document.getElementById('dash-leader'),
    clients: document.getElementById('dash-clients'),
    strokes: document.getElementById('dash-strokes'),
    replicas: [
      {
        state: document.getElementById('dash-r1-state'),
        term:  document.getElementById('dash-r1-term'),
        log:   document.getElementById('dash-r1-log'),
      },
      {
        state: document.getElementById('dash-r2-state'),
        term:  document.getElementById('dash-r2-term'),
        log:   document.getElementById('dash-r2-log'),
      },
      {
        state: document.getElementById('dash-r3-state'),
        term:  document.getElementById('dash-r3-term'),
        log:   document.getElementById('dash-r3-log'),
      },
    ]
  };

  const PORTS = [5000, 5001, 5002];

  async function refresh() {
    // Ask gateway for leader + client count
    try {
      const res  = await fetch('/status');
      const data = await res.json();
      if (els.leader)  els.leader.textContent  = data.leader           || '—';
      if (els.clients) els.clients.textContent = data.connectedClients ?? '—';
    } catch (_) {
      if (els.leader) els.leader.textContent = '—';
    }

    // Ask each replica for its state
    for (let i = 0; i < 3; i++) {
      const r = els.replicas[i];
      try {
        const res  = await fetch(
          `http://localhost:${PORTS[i]}/status`,
          { mode: 'cors' }
        );
        const data = await res.json();

        if (r.state) {
          r.state.textContent = data.state || '—';
          r.state.className   = `dash-val ${data.state || ''}`;
        }
        if (r.term) r.term.textContent = data.term      ?? '—';
        if (r.log)  r.log.textContent  = data.logLength ?? '—';

        // Update total strokes from leader
        if (data.state === 'leader' && els.strokes) {
          els.strokes.textContent = data.logLength ?? '—';
        }

      } catch (_) {
        if (r.state) {
          r.state.textContent = 'down';
          r.state.className   = 'dash-val down';
        }
        if (r.term) r.term.textContent = '—';
        if (r.log)  r.log.textContent  = '—';
      }
    }
  }

  refresh();
  setInterval(refresh, 2000);
}