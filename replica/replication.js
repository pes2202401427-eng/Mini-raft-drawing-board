// replica/replication.js
// SAANVI PART
const axios = require('axios');
const S = require('./state');

// Leader sends entry to followers
async function replicateToFollowers(entry, index) {
  let acks = 1; // leader itself

  const promises = S.PEERS.map(async (peer) => {
    try {
      const res = await axios.post(`${peer.url}/append-entries`, {
        term: S.currentTerm,
        leaderId: S.REPLICA_ID,
        entry,
        prevLogIndex: index - 1,
        leaderCommit: S.commitIndex,
      },
        { timeout: 300 }
    );

      if (res.data.success) {
        S.raftLog(`Ack from ${peer.id}`);
        acks++;
      }
    } catch (e) {
      S.raftLog(`Failed to reach ${peer.id}`);
    }
  });

  await Promise.race([
    Promise.allSettled(promises),
    new Promise(resolve => setTimeout(resolve, 500)) // max wait 500ms
    ]);
  const majority = Math.floor((S.PEERS.length + 1) / 2) + 1;

  if (acks >= majority) {
    S.commitIndex = index;
    S.raftLog(`COMMITTED entry ${index}`);

    // tell gateway to broadcast
    try {
      await axios.post(`${S.GATEWAY_URL}/broadcast`, {
        stroke: entry,
      });
    } catch (e) {
      S.raftLog("Gateway broadcast failed");
    }

    return true;
  }

  S.raftLog(`NOT COMMITTED`);
  return false;
}

module.exports = { replicateToFollowers };