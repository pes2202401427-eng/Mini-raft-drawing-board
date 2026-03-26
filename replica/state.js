// replica/state.js
// All shared RAFT state — every other file imports from here

const REPLICA_ID = process.env.REPLICA_ID || 'replica1';
const PORT       = parseInt(process.env.PORT) || 5000;
const PEER_STR   = process.env.PEERS || '';

// Parse peers from env: "replica2:5001,replica3:5002"
const PEERS = PEER_STR.split(',').filter(Boolean).map(p => {
  const [host, port] = p.split(':');
  return { id: host, url: `http://${host}:${port}` };
});

const GATEWAY_URL = 'http://gateway:8080';

// ── RAFT STATE VARIABLES ─────────────────────────────────────
let state       = 'follower';  // 'follower' | 'candidate' | 'leader'
let currentTerm = 0;
let votedFor    = null;
let leaderId    = null;

// ── LOG STATE (Saanvi's code will use these too) ─────────────
let log         = [];
let commitIndex = -1;

// ── TIMERS ───────────────────────────────────────────────────
let electionTimer  = null;
let heartbeatTimer = null;

// ── LOGGING HELPER ───────────────────────────────────────────
function raftLog(msg) {
  const time = new Date().toISOString().substr(11, 12);
  console.log(`[${time}][${REPLICA_ID}][Term ${currentTerm}][${state.toUpperCase()}] ${msg}`);
}

// Export everything using getters/setters so all files share same data
module.exports = {
  get REPLICA_ID()    { return REPLICA_ID; },
  get PORT()          { return PORT; },
  get PEERS()         { return PEERS; },
  get GATEWAY_URL()   { return GATEWAY_URL; },

  get state()         { return state; },
  set state(v)        { state = v; },

  get currentTerm()   { return currentTerm; },
  set currentTerm(v)  { currentTerm = v; },

  get votedFor()      { return votedFor; },
  set votedFor(v)     { votedFor = v; },

  get leaderId()      { return leaderId; },
  set leaderId(v)     { leaderId = v; },

  get log()           { return log; },
  set log(v)          { log = v; },

  get commitIndex()   { return commitIndex; },
  set commitIndex(v)  { commitIndex = v; },

  get electionTimer()     { return electionTimer; },
  set electionTimer(v)    { electionTimer = v; },

  get heartbeatTimer()    { return heartbeatTimer; },
  set heartbeatTimer(v)   { heartbeatTimer = v; },

  raftLog,
};