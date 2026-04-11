// replica/routes/syncLog.js

const S = require('../state');
const { becomeFollower } = require('../election');
const { replicateToFollowers } = require('../replication');

function setupSyncRoutes(app) {
  app.post('/sync-log', (req, res) => {
    const {
      term,
      leaderId,
      entries = [],
      fromIndex = 0,
      leaderCommit = -1,
    } = req.body;

    if (term < S.currentTerm) {
      return res.json({ success: false, reason: 'stale-term' });
    }

    becomeFollower(term, leaderId);

    const prefix = S.log.slice(0, fromIndex);
    S.log = prefix.concat(entries);
    const nextCommit = Math.min(leaderCommit, S.log.length - 1);
    S.commitIndex = Math.max(S.commitIndex, nextCommit);

    S.raftLog(`Synced log from index ${fromIndex}, now length=${S.log.length}`);

    return res.json({ success: true, logLength: S.log.length });
  });

  app.post('/stroke', async (req, res) => {

  console.log(`[${S.REPLICA_ID}] 🔥 /stroke HIT`);

  if (S.state !== 'leader') {
    console.log(`[${S.REPLICA_ID}] ❌ Not leader`);
    return res.json({ success: false });
  }

  const stroke = req.body.stroke;

  // 1. Append immediately
  S.log.push(stroke);
  const index = S.log.length - 1;

  console.log(`[${S.REPLICA_ID}] Stroke appended at ${index}`);

  // 2. RESPOND FAST (🔥 KEY FIX)
  res.json({ success: true });

  // 3. DO REPLICATION IN BACKGROUND
  (async () => {
    try {
      const committed = await replicateToFollowers(stroke, index);
      console.log(`[${S.REPLICA_ID}] Commit result: ${committed}`);
    } catch (err) {
      console.log(`[${S.REPLICA_ID}] Replication error:`, err.message);
    }
  })();

});

  app.get('/log', (req, res) => {
    const committedLog = S.commitIndex >= 0 ? S.log.slice(0, S.commitIndex + 1) : [];

    return res.json({
      log: committedLog,
      commitIndex: S.commitIndex,
      totalLogLength: S.log.length,
    });
  });
}

module.exports = { setupSyncRoutes };
