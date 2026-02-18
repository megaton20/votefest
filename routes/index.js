
const router = require('express').Router();
const indexController = require('../controllers/indexController')


// router.get('/', indexController.landingPage)
router.get('/', indexController.eventPage)
router.get('/contestant/:id', indexController.viewContestantPage)

router.get('/leaderboard', async (req, res) => {
  try {
    // Fetch leaderboard data from your API endpoint
    const response = await fetch(`http://localhost:${process.env.PORT || 3000}/vote/leaderboard`);
    const leaderboardData = await response.json();
    
    res.render('leaderboard', {
      user: req.user,
      contestants: leaderboardData,
      totalVotes: leaderboardData.reduce((sum, c) => sum + c.votes, 0)
    });
  } catch (error) {
    console.error('Leaderboard page error:', error);
    // Fallback to empty data if API fails
    res.render('leaderboard', {
      user: req.user,
      contestants: [],
      totalVotes: 0
    });
  }
});

router.get('/handler', (req, res) => {
  if (req.isAuthenticated()) {
    const role = req.user.role;

    if (role === "admin") {
      return res.redirect("/admin");
    } else {
      // Regular users go directly to chat with admin
      return res.redirect("/dashboard");
    }
  } else {
    return res.redirect('/auth/login');
  }
});




module.exports = router