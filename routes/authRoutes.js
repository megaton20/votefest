const router = require('express').Router();
const authController = require('../controllers/authController');
const { ensureAuthenticated,forwardAuthenticated } = require("../config/auth");

const {forwardVerifyAlert} = require('../middleware/auth');


router.get('/register',forwardAuthenticated,  authController.registerPage);
router.get('/login',forwardAuthenticated, authController.loginPage);

router.post('/register',forwardAuthenticated, authController.userCreate);
router.post('/login', forwardAuthenticated,authController.login);




// Logout route
router.get('/logout', (req, res) => {
  req.logout(err => {
    if (err) {
      return next(err);
    }
    req.flash('success_msg', 'You have logged out successfully.');
    res.redirect('/');
  });
});





module.exports = router;
