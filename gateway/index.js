const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const axios = require('axios');
const path = require('path');

const {
  setLeader,
  discoverLeader,
  getLeaderUrl,
  getLeaderId,
  clearLeader
} = require('./leaderTracker');

const app = express();
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();

// ---------------- WEBSOCKET ----------------
wss.on('connection', ws => {
  clients.add(ws);
  console.log(`[GATEWAY] Client connected (${clients.size} total)`);

  ws.on('message', async data => {
    try {
      const stroke = JSON.parse(data);
      await forwardStroke(stroke);
    } catch (e) {
      console.log("[GATEWAY] WS error:", e.message);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[GATEWAY] Client disconnected (${clients.size} total)`);
  });
});

// ---------------- FORWARD STROKE ----------------
async function forwardStroke(stroke) {
  if (!getLeaderUrl()) {
    await discoverLeader();
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await axios.post(
        `${getLeaderUrl()}/stroke`,
        { stroke },
        { timeout: 1000 }
      );

      if (res.data.success) return;

      console.log("[GATEWAY] Not leader → rediscover");
      clearLeader();
      await discoverLeader();

    } catch (e) {
      console.log("[GATEWAY] Leader unreachable → retry");
      clearLeader();
      await discoverLeader();
    }
  }

  console.log("[GATEWAY] Failed to forward stroke");
}

// ---------------- RECEIVE LEADER ----------------
app.post('/leader', (req, res) => {
  const { leaderId, leaderUrl } = req.body;

  setLeader(leaderId, leaderUrl);
  console.log(`[GATEWAY] Leader received: ${leaderId}`);

  res.json({ success: true });
});

// ---------------- BROADCAST ----------------
app.post('/broadcast', (req, res) => {
  const { stroke } = req.body;

  let count = 0;

  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'stroke', stroke }));
      count++;
    }
  });

  console.log(`[GATEWAY] Broadcast to ${count} clients`);

  res.json({ success: true });
});

// ---------------- STATUS ----------------
app.get('/status', (req, res) => {
  res.json({
    leader: getLeaderId(),
    leaderUrl: getLeaderUrl(),
    clients: clients.size
  });
});

// ---------------- START SERVER ----------------
const PORT = 8080;

async function startGateway() {
  console.log("[GATEWAY] Initializing...");

  // Initial wait for replicas
  await new Promise(r => setTimeout(r, 5000));

  server.listen(PORT, async () => {
    console.log(`[GATEWAY] Running on port ${PORT}`);

    // First discovery
    await discoverLeader();

    // 🔥 BEST FIX: periodic discovery
    setInterval(async () => {
      try {
        if (!getLeaderUrl()) {
          console.log("[GATEWAY] Re-discovering leader...");
          await discoverLeader();
        }
      } catch (err) {
        console.log("[GATEWAY] Periodic error:", err.message);
      }
    }, 3000);
  });
}

startGateway();