


module.exports = {

  ensureAdmin: function (req, res, next) {

    if (req.user.role == 'admin') {
      return next()
    }
    req.flash('error_msg', "invalid request...")
    return res.redirect('/')
  },

  ensureSecurity: function (req, res, next) {
    
     if (req.user.is_admin ) {
       return next()
      }
      req.flash('error_msg', "invalid request...")
     return res.redirect('/')

  }

};