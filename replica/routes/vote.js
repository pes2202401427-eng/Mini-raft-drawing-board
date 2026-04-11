// replica/routes/vote.js
// Handles POST /request-vote

const S = require('../state');
const { becomeFollower, resetElectionTimer } = require('../election');

function setupElectionRoutes(app) {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    return next();
  });

  app.post('/request-vote', (req, res) => {
    const { term, candidateId } = req.body;

    if (term > S.currentTerm) {
      becomeFollower(term);
    }

    const voteGranted =
      term >= S.currentTerm &&
      (S.votedFor === null || S.votedFor === candidateId);

    if (voteGranted) {
      S.votedFor = candidateId;
      resetElectionTimer();
      S.raftLog(`Voted YES for ${candidateId} in term ${term}`);
    } else {
      S.raftLog(`Voted NO for ${candidateId} (already voted for: ${S.votedFor})`);
    }

    return res.json({ term: S.currentTerm, voteGranted });
  });
}

module.exports = { setupElectionRoutes };
