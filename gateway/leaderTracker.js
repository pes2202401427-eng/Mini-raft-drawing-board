const axios = require('axios');

const envReplicas = process.env.REPLICAS;

function parseReplicaTargets(str) {
  return str
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [host, port] = r.split(':');
      return { id: host, host, port, url: `http://${host}:${port}` };
    });
}

const defaultTargets = [
  'replica1:5000',
  'replica2:5001',
  'replica3:5002',
  'localhost:5000',
  'localhost:5001',
  'localhost:5002',
];

const ALL_REPLICAS = envReplicas
  ? parseReplicaTargets(envReplicas)
  : parseReplicaTargets(defaultTargets.join(','));

let currentLeaderUrl = null;
let currentLeaderId = null;

function setLeader(id, url) {
  currentLeaderId = id;
  currentLeaderUrl = url;
  console.log(`[GATEWAY] Leader set: ${id} (${url})`);
}

async function discoverLeader() {
  for (const replica of ALL_REPLICAS) {
    try {
      const res = await axios.get(`${replica.url}/status`, { timeout: 500 });

      if (res.data.state === 'leader') {
        currentLeaderId = res.data.id || replica.id;
        currentLeaderUrl = replica.url;
        console.log(`[GATEWAY] Found leader: ${currentLeaderId} (${currentLeaderUrl})`);
        return true;
      }
    } catch {
      // Ignore unreachable replica and continue probing.
    }
  }

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
}

function getReplicaUrls() {
  return ALL_REPLICAS.map((r) => r.url);
}

module.exports = {
  setLeader,
  discoverLeader,
  getLeaderUrl,
  getLeaderId,
  clearLeader,
  getReplicaUrls,
};
