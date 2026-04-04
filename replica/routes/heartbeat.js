// replica/routes/heartbeat.js
// Handles POST /heartbeat and GET /status

const S = require('../state');
const { becomeFollower } = require('../election');

function setupHeartbeatRoutes(app) {

  // Leader sends this every 150ms to say "I'm alive"
  app.post('/heartbeat', (req, res) => {
    const { term, leaderId } = req.body;

    if (term >= S.currentTerm) {
      // Valid leader — reset our election timer and update state
      becomeFollower(term, leaderId);
    }

    res.json({ success: true });
  });

  // Debug endpoint — gateway uses this to find the leader
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