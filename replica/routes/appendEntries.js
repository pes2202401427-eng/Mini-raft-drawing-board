const S = require('../state');
const { becomeFollower } = require('../election');
const axios = require('axios');

// 🔥 ADD THIS
const GATEWAY_URL = process.env.GATEWAY_URL || "http://gateway:8080";

function setupReplicationRoutes(app) {
  app.post('/append-entries', async (req, res) => {
    const {
      term,
      leaderId,
      entry,
      prevLogIndex = -1,
      leaderCommit = -1,
    } = req.body;

    if (term < S.currentTerm) {
      return res.json({ success: false, reason: 'stale-term' });
    }

    becomeFollower(term, leaderId);

    if (prevLogIndex >= 0 && S.log.length - 1 < prevLogIndex) {
      return res.json({
        success: false,
        needsSync: true,
        followerLogLength: S.log.length,
      });
    }

    // ─── APPEND LOG ─────────────────────────
    if (entry) {
      const expectedIndex = prevLogIndex + 1;

      if (S.log.length > expectedIndex) {
        S.log = S.log.slice(0, expectedIndex);
      }

      if (S.log.length === expectedIndex) {
        S.log.push(entry);
      }
    }

    // ─── COMMIT LOG ─────────────────────────
    const prevCommitIndex = S.commitIndex;
    const nextCommit = Math.min(leaderCommit, S.log.length - 1);
    S.commitIndex = Math.max(S.commitIndex, nextCommit);


    return res.json({
      success: true,
      logLength: S.log.length,
      commitIndex: S.commitIndex,
    });
  });
}

module.exports = { setupReplicationRoutes };