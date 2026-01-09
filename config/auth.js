

module.exports = {
  ensureAuthenticated: function(req, res, next) {

    let openSession =  req.user
    if (openSession) {
      return next();
    }
    req.flash("error_msg", "Please sign in to view our resources")
    res.redirect('/auth/login')
    return
  },

  forwardAuthenticated: function(req, res, next) {
    
    let openSession =  req.user

    if (!openSession) {
      return next()
    }

    req.flash("warning_msg", `You are already signed in!`)
    return res.redirect('/handler')
     
    },

};


