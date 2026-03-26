// replica/election.js
const axios = require('axios');
const S = require('./state');

function resetElectionTimer() {
  clearTimeout(S.electionTimer);
  const timeout = Math.floor(Math.random() * 300) + 500;
  S.electionTimer = setTimeout(startElection, timeout);
}

function stopElectionTimer() {
  clearTimeout(S.electionTimer);
}

function becomeFollower(term, newLeader = null) {
  S.raftLog(`Becoming FOLLOWER (was ${S.state}, term ${term})`);
  S.state       = 'follower';
  S.currentTerm = term;
  S.votedFor    = null;
  S.leaderId    = newLeader;
  clearInterval(S.heartbeatTimer);
  resetElectionTimer();
}

async function startElection() {
  S.state       = 'candidate';
  S.currentTerm += 1;
  S.votedFor    = S.REPLICA_ID;
  let votes     = 1;

  S.raftLog(`Starting ELECTION for term ${S.currentTerm}`);
  resetElectionTimer();

  const votePromises = S.PEERS.map(async peer => {
    try {
      const res = await axios.post(
        `${peer.url}/request-vote`,
        {
          term: S.currentTerm,
          candidateId: S.REPLICA_ID,
          lastLogIndex: S.log.length - 1,
        },
        { timeout: 300 }
      );
      if (res.data.voteGranted) {
        S.raftLog(`Got vote from ${peer.id}`);
        votes++;
      }
    } catch (e) {
      S.raftLog(`No response from ${peer.id}`);
    }
  });

  await Promise.allSettled(votePromises);
  if (S.state !== 'candidate') return;

  const majority = Math.floor((S.PEERS.length + 1) / 2) + 1;
  if (votes >= majority) {
    becomeLeader();
  } else {
    S.raftLog(`Lost election — only ${votes} votes`);
    becomeFollower(S.currentTerm);
  }
}

function becomeLeader() {
  S.raftLog(`WON ELECTION — I am LEADER`);
  S.state    = 'leader';
  S.leaderId = S.REPLICA_ID;
  stopElectionTimer();
  notifyGateway();
  S.heartbeatTimer = setInterval(sendHeartbeats, 150);
}

async function sendHeartbeats() {
  if (S.state !== 'leader') return;
  S.PEERS.forEach(async peer => {
    try {
      await axios.post(
        `${peer.url}/heartbeat`,
        { term: S.currentTerm, leaderId: S.REPLICA_ID },
        { timeout: 200 }
      );
    } catch (e) { /* peer may be down */ }
  });
}

async function notifyGateway() {
  try {
    await axios.post(
      `${S.GATEWAY_URL}/leader`,
      {
        leaderId:  S.REPLICA_ID,
        leaderUrl: `http://${S.REPLICA_ID}:${S.PORT}`,
      },
      { timeout: 500 }
    );
    S.raftLog('Gateway notified of leadership');
  } catch (e) {
    S.raftLog('Gateway not ready — retrying in 500ms');
    setTimeout(notifyGateway, 500);
  }
}

function startElectionSystem() {
  S.raftLog(`Started. Peers: ${S.PEERS.map(p => p.id).join(', ')}`);
  resetElectionTimer();
}

module.exports = {
  becomeFollower,
  becomeLeader,
  resetElectionTimer,
  stopElectionTimer,
  startElectionSystem,
};