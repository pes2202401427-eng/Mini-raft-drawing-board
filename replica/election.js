// replica/election.js
// SANCHITA owns this file
// All election logic: timeouts, voting, becoming leader, heartbeats

const axios = require('axios');
const S = require('./state');

// ── ELECTION TIMER ────────────────────────────────────────────
// Random 500-800ms — if no heartbeat arrives, start election
function resetElectionTimer() {
  clearTimeout(S.electionTimer);
  const timeout = Math.floor(Math.random() * 500) + 1000;
  S.electionTimer = setTimeout(startElection, timeout);
}

function stopElectionTimer() {
  clearTimeout(S.electionTimer);
}

// ── BECOME FOLLOWER ───────────────────────────────────────────
function becomeFollower(term, newLeader = null) {
  S.raftLog(`Becoming FOLLOWER (was: ${S.state}, new term: ${term})`);
  S.state       = 'follower';
  S.currentTerm = term;
  S.votedFor    = null;
  S.leaderId    = newLeader;
  clearInterval(S.heartbeatTimer);
  resetElectionTimer(); // restart the countdown
}

// ── START ELECTION ────────────────────────────────────────────
async function startElection() {
  // Become a candidate
  S.state       = 'candidate';
  S.currentTerm += 1;
  S.votedFor    = S.REPLICA_ID; // vote for yourself
  let votes     = 1;            // count your own vote

  S.raftLog(`Starting ELECTION for term ${S.currentTerm}`);
  resetElectionTimer(); // reset in case this election also fails

  // Ask all peers for their vote
  const voteRequests = S.PEERS.map(async peer => {
    try {
      const res = await axios.post(
        `${peer.url}/request-vote`,
        {
          term:         S.currentTerm,
          candidateId:  S.REPLICA_ID,
          lastLogIndex: S.log.length - 1,
        },
        { timeout: 300 }
      );

      if (res.data.voteGranted) {
        S.raftLog(`Got vote from ${peer.id}`);
        votes++;
      } else {
        S.raftLog(`${peer.id} denied vote`);
      }
    } catch (e) {
      S.raftLog(`No response from ${peer.id} (may be down)`);
    }
  });

  await Promise.allSettled(voteRequests);

  // If we got stepped down during voting, stop here
  if (S.state !== 'candidate') return;

  // Need majority: 2 out of 3
  const majority = Math.floor((S.PEERS.length + 1) / 2) + 1;

  if (votes >= majority) {
    becomeLeader();
  } else {
    S.raftLog(`Lost election — got ${votes} votes, needed ${majority}`);
    becomeFollower(S.currentTerm);
  }
}

// ── BECOME LEADER ─────────────────────────────────────────────
function becomeLeader() {
  S.raftLog(`WON ELECTION — I am now the LEADER`);
  S.state    = 'leader';
  S.leaderId = S.REPLICA_ID;
  stopElectionTimer();

  // Tell the gateway: I am the new leader
  notifyGateway();

  // Send heartbeats every 150ms to keep followers alive
  S.heartbeatTimer = setInterval(sendHeartbeats, 150);
}

// ── SEND HEARTBEATS ───────────────────────────────────────────
async function sendHeartbeats() {
  if (S.state !== 'leader') return;

  S.PEERS.forEach(async peer => {
    try {
      await axios.post(
        `${peer.url}/heartbeat`,
        { term: S.currentTerm, leaderId: S.REPLICA_ID },
        { timeout: 200 }
      );
    } catch (e) {
      // Peer might be down — that is OK
    }
  });
}

// ── NOTIFY GATEWAY OF LEADERSHIP ─────────────────────────────
// Retries up to 10 times then stops — no more spam
async function notifyGateway(attempt = 0) {
  if (attempt >= 10) {
    S.raftLog('Gateway unreachable — will get notified when it starts');
    return; // stop retrying after 10 attempts
  }

  try {
    await axios.post(
      `${S.GATEWAY_URL}/leader`,
      {
        leaderId:  S.REPLICA_ID,
        leaderUrl: `http://${S.REPLICA_ID}:${S.PORT}`,
      },
      { timeout: 500 }
    );
    S.raftLog('Gateway notified of leadership successfully');
  } catch (e) {
    S.raftLog(`Gateway not ready — retry ${attempt + 1}/10`);
    setTimeout(() => notifyGateway(attempt + 1), 500);
  }
}

// ── START THE ELECTION SYSTEM ─────────────────────────────────
// Called once when the server starts
function startElectionSystem() {
  S.raftLog(`Started as FOLLOWER. Peers: ${S.PEERS.map(p => p.id).join(', ')}`);
  resetElectionTimer(); // begin countdown — if no heartbeat comes, start election
}

module.exports = {
  becomeFollower,
  becomeLeader,
  resetElectionTimer,
  stopElectionTimer,
  startElectionSystem,
};
// reload test Thu Mar 26 09:35:39 PM IST 2026