const User = require("../models/User");

module.exports = async (req, res, next) => {
  try {
    const isAdmin = await User.isAdmin(req.user?.id);
    
    if (!isAdmin) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Admin only.'
        });
      }
      req.flash('error_msg', 'Access denied. Admin only.');
      return res.redirect('/chat');
    }
    
    next();
  } catch (error) {
    console.error('Admin auth middleware error:', error);
    res.status(500).send('Server error');
  }
};