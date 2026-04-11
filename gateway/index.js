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
  clearLeader,
  getReplicaUrls,
} = require('./leaderTracker');

const app = express();

app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  return next();
});

const frontendPath = path.join(__dirname, 'frontend');

app.use(express.static(frontendPath));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Set();

function sendToClient(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function broadcast(payload) {
  console.log("[GATEWAY] Broadcasting:", payload); // ✅ ADD

  let count = 0;
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(payload));
      count++;
    }
  });
  return count;
}
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`[GATEWAY] Client connected (${clients.size} total)`);

  ws.on('message', async (rawData) => {
    try {
      const data = JSON.parse(rawData.toString());

      // Backward compatibility with clients that send raw stroke objects.
      if (data.x1 !== undefined && data.y1 !== undefined && data.x2 !== undefined && data.y2 !== undefined) {
        await forwardStroke(data);
        return;
      }

      if (data.type === 'stroke' && data.stroke) {
        await forwardStroke(data.stroke);
        return;
      }

      if (data.type === 'get-full-log') {
        const strokes = await getCommittedLog();
        sendToClient(ws, { type: 'full-log', strokes });
      }
    } catch (e) {
      console.log(`[GATEWAY] WS message error: ${e.message}`);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[GATEWAY] Client disconnected (${clients.size} total)`);
  });
});

async function ensureLeader() {
  if (getLeaderUrl()) return true;
  return discoverLeader();
}

async function forwardStroke(stroke) {
  const hasLeader = await ensureLeader();
  if (!hasLeader) {
    console.log('[GATEWAY] No leader available for stroke forwarding');
    return false;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const leaderUrl = getLeaderUrl();
    if (!leaderUrl) {
      await discoverLeader();
      continue;
    }

    try {
      const res = await axios.post(
        `${leaderUrl}/stroke`,
        { stroke },
        { timeout: 5000 }
      );

      if (res.data && res.data.success) {

        // 🔥 ADD THIS (CRITICAL FIX)
        const count = broadcast({
          type: 'stroke',
          stroke
        });

        console.log(`[GATEWAY] Immediate broadcast to ${count} clients`);

        return true;
      }

      clearLeader();
      await discoverLeader();
    } catch (err) {
      console.log('[GATEWAY] Forward error:', err.message);
      clearLeader();
      await discoverLeader();
    }
  }

  console.log('[GATEWAY] Failed to forward stroke after retries');
  return false;
}
async function getCommittedLog() {
  if (!(await ensureLeader())) {
    return [];
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const leaderUrl = getLeaderUrl();
    if (!leaderUrl) {
      await discoverLeader();
      continue;
    }

    try {
      const res = await axios.get(`${leaderUrl}/log`, { timeout: 1000 });
      return Array.isArray(res.data.log) ? res.data.log : [];
    } catch {
      clearLeader();
      await discoverLeader();
    }
  }

  return [];
}

app.post('/leader', (req, res) => {
  const { leaderId, leaderUrl } = req.body;

  if (leaderId && leaderUrl) {
    setLeader(leaderId, leaderUrl);
  }

  return res.json({ success: true });
});

app.post('/broadcast', (req, res) => {
  const { stroke } = req.body;

  if (!stroke) {
    return res.status(400).json({ success: false, error: 'stroke is required' });
  }

  const count = broadcast({ type: 'stroke', stroke });
  console.log(`[GATEWAY] Broadcast to ${count} clients`);
  return res.json({ success: true, clients: count });
});

app.get('/status', async (req, res) => {
  if (!getLeaderUrl()) {
    await discoverLeader();
  }

  return res.json({
    leader: getLeaderId(),
    leaderUrl: getLeaderUrl(),
    clients: clients.size,
    knownReplicas: getReplicaUrls(),
  });
});

const PORT = 8080;

async function startGateway() {
  await new Promise((resolve) => setTimeout(resolve, 1200));

  server.listen(PORT, async () => {
    console.log(`[GATEWAY] Running on port ${PORT}`);

    await discoverLeader();

    setInterval(async () => {
      try {
        await discoverLeader();
      } catch (err) {
        console.log(`[GATEWAY] Leader discovery error: ${err.message}`);
      }
    }, 2000);
  });
}

startGateway();
