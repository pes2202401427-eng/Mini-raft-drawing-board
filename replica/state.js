// replica/state.js
const REPLICA_ID = process.env.REPLICA_ID || 'replica1';
const PORT       = parseInt(process.env.PORT) || 5000;
const PEER_STR   = process.env.PEERS || '';

const PEERS = PEER_STR.split(',').filter(Boolean).map(p => {
  const [host, port] = p.split(':');
  return { id: host, url: `http://${host}:${port}` };
});

let state       = 'follower';
let currentTerm = 0;
let votedFor    = null;
let leaderId    = null;
let log         = [];
let commitIndex = -1;
let electionTimer  = null;
let heartbeatTimer = null;

const GATEWAY_URL = 'http://gateway:8080';

function raftLog(msg) {
  const ts = new Date().toISOString().substr(11, 12);
  console.log(`[${ts}][${REPLICA_ID}][Term ${currentTerm}][${state.toUpperCase()}] ${msg}`);
}

module.exports = {
  get REPLICA_ID() { return REPLICA_ID; },
  get PORT()       { return PORT; },
  get PEERS()      { return PEERS; },
  get GATEWAY_URL(){ return GATEWAY_URL; },
  get state()      { return state; },
  set state(v)     { state = v; },
  get currentTerm(){ return currentTerm; },
  set currentTerm(v){ currentTerm = v; },
  get votedFor()   { return votedFor; },
  set votedFor(v)  { votedFor = v; },
  get leaderId()   { return leaderId; },
  set leaderId(v)  { leaderId = v; },
  get log()        { return log; },
  set log(v)       { log = v; },
  get commitIndex(){ return commitIndex; },
  set commitIndex(v){ commitIndex = v; },
  get electionTimer()  { return electionTimer; },
  set electionTimer(v) { electionTimer = v; },
  get heartbeatTimer()  { return heartbeatTimer; },
  set heartbeatTimer(v) { heartbeatTimer = v; },
  raftLog,
};