// replica/routes/vote.js
// Handles POST /request-vote — other replicas ask us to vote

const S = require('../state');
const { becomeFollower, resetElectionTimer } = require('../election');

function setupElectionRoutes(app) {

  app.post('/request-vote', (req, res) => {
    const { term, candidateId } = req.body;

    // If candidate has higher term, we step down immediately
    if (term > S.currentTerm) {
      becomeFollower(term);
    }

    // Grant vote only if:
    // 1. Candidate's term is >= ours
    // 2. We haven't voted for anyone else this term
    const voteGranted =
      term >= S.currentTerm &&
      (S.votedFor === null || S.votedFor === candidateId);

    if (voteGranted) {
      S.votedFor = candidateId;
      resetElectionTimer(); // reset our timer — we acknowledged someone
      S.raftLog(`Voted YES for ${candidateId} in term ${term}`);
    } else {
      S.raftLog(`Voted NO for ${candidateId} (already voted for: ${S.votedFor})`);
    }

    res.json({ term: S.currentTerm, voteGranted });
  });

}

module.exports = { setupElectionRoutes };