// replica/index.js
// SANCHITA owns this entry point file
// Wires together Sanchita's election code + Saanvi's replication code

const express = require('express');
const app = express();
app.use(express.json());

// ── SANCHITA's modules ────────────────────────────────────────
const { setupElectionRoutes }  = require('./routes/vote');
const { setupHeartbeatRoutes } = require('./routes/heartbeat');
const { startElectionSystem }  = require('./election');

// ── SAANVI's modules (she will create these — stub for now) ──
// Uncomment these lines once Saanvi pushes her files:
// const { setupReplicationRoutes } = require('./routes/appendEntries');
// const { setupSyncRoutes }        = require('./routes/syncLog');

// Register routes
setupElectionRoutes(app);     // /request-vote
setupHeartbeatRoutes(app);    // /heartbeat, /status

// Saanvi's routes — uncomment when she pushes:
// setupReplicationRoutes(app);
// setupSyncRoutes(app);

// Start server
const S = require('./state');
app.listen(S.PORT, () => {
  startElectionSystem();
  console.log(`[${S.REPLICA_ID}] Server started on port ${S.PORT}`);
});

// Graceful shutdown for nodemon restarts
process.on('SIGTERM', () => {
  clearInterval(S.heartbeatTimer);
  clearTimeout(S.electionTimer);
  console.log(`[${S.REPLICA_ID}] Shutting down gracefully`);
  process.exit(0);
});