


module.exports = {
  forwardVerifyAlert: function (req, res, next) {

    if (req.user.is_email_verified) {
      return res.redirect('/handler')
    }
    return next()
  },

  ensureVerifiedEmail: function (req, res, next) {

    if (req.user.is_email_verified) {
      return next()
    }
    return res.redirect('/auth/verify-alert')
  },

  ensureAdmin: function (req, res, next) {

    if (req.user.role == 'admin') {
      return next()
    }
    req.flash('error_msg', "invalid request...")
    return res.redirect('/user')
  }

};