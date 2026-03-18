

module.exports = {
  ensureAuthenticated: function(req, res, next) {

    let openSession =  req.user
    
    if (openSession) {
      return next();
    }

    req.session.returnTo = req.originalUrl
 
    req.flash("error_msg", "Please sign in to use our resources")
    res.redirect('/auth/login')
    return
  },
  ensureAdmin: function(req, res, next) {

    let isAdmin =  req.user.is_admin
    
    if (isAdmin) {
      return next();
    }

    req.session.returnTo = req.originalUrl
 
    req.flash("error_msg", "Please sign in to use our resources")
    res.redirect('/')
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


