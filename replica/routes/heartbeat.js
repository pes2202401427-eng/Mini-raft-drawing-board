// replica/routes/heartbeat.js
const S = require('../state');
const { becomeFollower } = require('../election');

function setupHeartbeatRoutes(app) {

  app.post('/heartbeat', (req, res) => {
    const { term, leaderId } = req.body;
    if (term >= S.currentTerm) {
      becomeFollower(term, leaderId);
    }
    res.json({ success: true });
  });

  app.get('/status', (req, res) => {
    res.json({
      id:          S.REPLICA_ID,
      state:       S.state,
      term:        S.currentTerm,
      leader:      S.leaderId,
      logLength:   S.log.length,
      commitIndex: S.commitIndex,
    });
  });
}

module.exports = { setupHeartbeatRoutes };