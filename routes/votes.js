const express = require('express');
const router = express.Router();
const VoteController = require('../controllers/voteController');
const { ensureAuthenticated } = require("../config/auth");

// This will be initialized in server.js
let voteController;

router.use((req, res, next) => {
  if (!voteController) {
    voteController = new VoteController(req.app.locals.socketService);
  }
  next();
});



router.post('/cast', ensureAuthenticated, (req, res) => voteController.castVote(req, res));
router.get('/leaderboard', (req, res) => voteController.getLeaderboard(req, res));

module.exports = router;
