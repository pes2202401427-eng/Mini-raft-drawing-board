// frontend/dashboard.js — Roopashree
// Shows live cluster info in the bottom-right panel
// Polls the gateway and each replica every 2 seconds

function initDashboard() {

  // Get references to all the HTML elements in the dashboard
  const leaderEl  = document.getElementById('dash-leader');
  const clientsEl = document.getElementById('dash-clients');

  // For each of the 3 replicas, get their state/term/log elements
  const replicaEls = [
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
  ];

  // The 3 replica ports
  const PORTS = [5000, 5001, 5002];

  async function refresh() {

    // 1. Ask gateway: who is the leader? how many clients?
    try {
      const response = await fetch('/status');
      const data     = await response.json();
      if (leaderEl)  leaderEl.textContent  = data.leader           || '—';
      if (clientsEl) clientsEl.textContent = data.connectedClients ?? '—';
    } catch (e) {
      // gateway not reachable yet — that's fine
    }

    // 2. Ask each replica: what state are you in? what term? how big is your log?
    for (let i = 0; i < 3; i++) {
      try {
        const response = await fetch(`http://localhost:${PORTS[i]}/status`);
        const data     = await response.json();
        const els      = replicaEls[i];

        if (els.state) {
          els.state.textContent = data.state || '—';
          // colour-code: leader=yellow, follower=blue, candidate=red
          els.state.className = `dash-val ${data.state || ''}`;
        }
        if (els.term) els.term.textContent = data.term      ?? '—';
        if (els.log)  els.log.textContent  = data.logLength ?? '—';

      } catch (e) {
        // replica is down — show "down" in red
        const els = replicaEls[i];
        if (els.state) {
          els.state.textContent = 'down';
          els.state.className   = 'dash-val candidate';
        }
        if (els.term) els.term.textContent = '—';
        if (els.log)  els.log.textContent  = '—';
      }
    }
  }

  refresh();                    // run immediately on page load
  setInterval(refresh, 2000);  // then every 2 seconds
}