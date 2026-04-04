const axios = require('axios');

const REPLICAS = process.env.REPLICAS || 'replica1:5000,replica2:5001,replica3:5002';

const ALL_REPLICAS = REPLICAS.split(',').map(r => {
  const [host, port] = r.split(':');
  return { id: host, url: `http://${host}:${port}` };
});

let currentLeaderUrl = null;
let currentLeaderId = null;

// Set leader when replica notifies
function setLeader(id, url) {
  currentLeaderId = id;
  currentLeaderUrl = url;
  console.log(`[GATEWAY] Leader set: ${id} (${url})`);
}

// Discover leader manually
async function discoverLeader() {
  console.log("[GATEWAY] Discovering leader...");

  for (const replica of ALL_REPLICAS) {
    try {
      const res = await axios.get(`${replica.url}/status`, { timeout: 500 });

      if (res.data.state === 'leader') {
        currentLeaderUrl = replica.url;
        currentLeaderId = replica.id;
        console.log(`[GATEWAY] Found leader: ${replica.id}`);
        return true;
      }
    } catch (e) {
      console.log(`[GATEWAY] ${replica.id} not reachable`);
    }
  }

  console.log("[GATEWAY] No leader found");
  return false;
}

function getLeaderUrl() {
  return currentLeaderUrl;
}

function getLeaderId() {
  return currentLeaderId;
}

function clearLeader() {
  currentLeaderUrl = null;
  currentLeaderId = null;
  console.log("[GATEWAY] Leader cleared");
}

module.exports = {
  setLeader,
  discoverLeader,
  getLeaderUrl,
  getLeaderId,
  clearLeader
};