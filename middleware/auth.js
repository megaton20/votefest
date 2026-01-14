


module.exports = {

  ensureAdmin: function (req, res, next) {

    if (req.user.role == 'admin') {
      return next()
    }
    req.flash('error_msg', "invalid request...")
    return res.redirect('/user')
  }

};