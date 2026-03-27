// replica/routes/appendEntries.js
//SAANVI PART
const S = require('../state');
const { becomeFollower } = require('../election');

function setupReplicationRoutes(app) {

  app.post('/append-entries', (req, res) => {
    const { term, leaderId, entry, prevLogIndex } = req.body;

    // reject old leader
    if (term < S.currentTerm) {
      return res.json({ success: false });
    }

    // accept leader
    becomeFollower(term, leaderId);

    // check if behind
    if (prevLogIndex >= 0 && S.log.length <= prevLogIndex) {
      return res.json({
        success: false,
        needsSync: true,
        followerLogLength: S.log.length,
      });
    }

    // append entry
    if (entry) {
      S.log.push(entry);
      S.commitIndex = S.log.length - 1;

      S.raftLog(`Appended entry ${S.commitIndex}`);
    }

    res.json({ success: true });
  });

}

module.exports = { setupReplicationRoutes };