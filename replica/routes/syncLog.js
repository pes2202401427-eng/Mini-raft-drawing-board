// replica/routes/syncLog.js

const S = require('../state');
const { replicateToFollowers } = require('../replication');

function setupSyncRoutes(app) {

  // sync missing logs
  app.post('/sync-log', (req, res) => {
    const { entries, fromIndex, leaderCommit } = req.body;

    S.log = S.log.slice(0, fromIndex).concat(entries);
    S.commitIndex = leaderCommit;

    S.raftLog(`Synced ${entries.length} entries`);

    res.json({ success: true });
  });

  // client sends stroke → leader
  app.post('/stroke', async (req, res) => {

    if (S.state !== 'leader') {
      return res.json({
        success: false,
        leader: S.leaderId,
      });
    }

    const stroke = req.body.stroke;

    S.log.push(stroke);
    const index = S.log.length - 1;

    S.raftLog(`Stroke received index ${index}`);

    const committed = await replicateToFollowers(stroke, index);

    res.json({ success: committed });
  });

  // debug logs
  app.get('/log', (req, res) => {
    res.json({
      log: S.log,
      commitIndex: S.commitIndex,
    });
  });

}

module.exports = { setupSyncRoutes };