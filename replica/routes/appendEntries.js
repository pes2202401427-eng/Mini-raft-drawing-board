const axios = require('axios');
const S = require('../state');
const { becomeFollower, resetElectionTimer } = require('../election');

function setupReplicationRoutes(app) {

  // Leader → Followers (log replication + heartbeat)
  app.post('/append-entries', (req, res) => {
    const { term, leaderId, entries = [], leaderCommit } = req.body;

    // Step 1: Reject if term is old
    if (term < S.currentTerm) {
      return res.json({ success: false });
    }

    // Step 2: Become follower if needed
    if (term > S.currentTerm) {
      becomeFollower(term, leaderId);
    } else if (S.state !== 'follower') {
      becomeFollower(term, leaderId);
    }

    // 🔥 Step 3: VERY IMPORTANT FIX
    resetElectionTimer();

    S.raftLog(`Received AppendEntries from ${leaderId}`);

    // Step 4: Append logs
    if (entries.length > 0) {
      S.log = [...S.log, ...entries];
      S.raftLog(`Appended ${entries.length} entries`);
    }

    // Step 5: Update commit index
    if (leaderCommit !== undefined) {
      S.commitIndex = Math.min(leaderCommit, S.log.length - 1);
    }

    return res.json({ success: true });
  });

}

module.exports = { setupReplicationRoutes };