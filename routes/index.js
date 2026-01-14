// index route
const router = require('express').Router();
const indexController = require('../controllers/indexController')



// Admin creates a class
router.get('/', indexController.landingPage)


router.get('/handler', (req, res) => {
  if (req.isAuthenticated()) {
    const role = req.user.role;

    if (role === "admin") {
      // Admin goes to inbox (WhatsApp-like conversation list)
      return res.redirect("/chat/admin");
    } else {
      // Regular users go directly to chat with admin
      return res.redirect("/chat");
    }
  } else {
    return res.redirect('/auth/login');
  }
});




module.exports = router