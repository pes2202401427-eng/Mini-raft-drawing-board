const S = require('../state');

function setupSyncRoutes(app) {

  // For debugging / syncing logs
  app.get('/log', (req, res) => {
    res.json({
      log: S.log,
      commitIndex: S.commitIndex,
      state: S.state,
      term: S.currentTerm,
    });
  });

}

module.exports = { setupSyncRoutes };