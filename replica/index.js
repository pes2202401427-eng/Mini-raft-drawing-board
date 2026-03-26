// replica/index.js — SANCHITA owns this (main entry point)
const express = require('express');
const app = express();
app.use(express.json());

// Sanchita's modules
const { setupElectionRoutes }  = require('./routes/vote');
const { setupHeartbeatRoutes } = require('./routes/heartbeat');
const { startElectionSystem }  = require('./election');

// Saanvi's modules — uncomment AFTER Saanvi pushes her files
// const { setupReplicationRoutes } = require('./routes/appendEntries');
// const { setupSyncRoutes }        = require('./routes/syncLog');

// Register routes
setupElectionRoutes(app);
setupHeartbeatRoutes(app);
// setupReplicationRoutes(app);
// setupSyncRoutes(app);

const PORT = require('./state').PORT;
app.listen(PORT, () => {
  startElectionSystem();
  console.log(`[${process.env.REPLICA_ID}] Listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
  const S = require('./state');
  clearInterval(S.heartbeatTimer);
  clearTimeout(S.electionTimer);
  console.log(`[${process.env.REPLICA_ID}] Graceful shutdown`);
  process.exit(0);
});