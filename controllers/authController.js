const jwt = require('jsonwebtoken');
const AuthServices = require('../services/authServices');


exports.registerPage = async (req, res) => {
  const { userActive, referrerCode } = await AuthServices.registerPage(req);

  if (req.isAPI) {
    return res.json({
      success: true,
      data: { userActive, referrerCode }
    });
  }

  res.render('register', {
    referralCode: referrerCode,
    messages: req.flash() // Pass flash messages to view
  });
};

exports.loginPage = async (req, res) => {
  const { userActive } = await AuthServices.loginPage(req);

  if (req.isAPI) {
    return res.json({
      success: true,
      data: { userActive }
    });
  }

  res.render('login', {
    messages: req.flash() // Pass flash messages to view
  });
};

// ==================== USER REGISTRATION ====================
exports.userCreate = async (req, res, next) => {
  
  try {
    const result = await AuthServices.createUser(req.body);

    if (!result.success) {
      // For web - set flash message and redirect
      if (!req.isAPI) {
        req.flash('error_msg', result.message);
        return res.redirect('/auth/register');
      }
      // For API - return JSON
      return res.status(result.statusCode || 400).json({
        success: false,
        message: result.message
      });
    }

    const { user } = result;

    if (req.isAPI) {
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
          },
          token
        }
      });
    } else {
      // Web registration success
      req.login(user, (err) => {
        if (err) {
          req.flash('error_msg', 'Login failed. Please try again.');
          return res.redirect('/auth/register');
        }

        req.flash('success_msg', 'Registration successful!');
        return res.redirect('/handler');
      });
    }

  } catch (error) {
    console.error('User creation error:', error);
    
    if (req.isAPI) {
      return res.status(500).json({
        success: false,
        error: 'Registration failed. Please try again.'
      });
    }
    
    req.flash('error_msg', 'Something went wrong. Please try again.');
    return res.redirect('/auth/register');
  }
};

// ==================== LOGIN ====================
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      if (req.isAPI) {
        return res.status(400).json({
          success: false,
          message: 'email and password are required'
        });
      }
      req.flash('error_msg', 'email and password are required');
      return res.redirect('/auth/login');
    }
    
    const result = await AuthServices.login({ email, password }, req);
        
    if (req.isAPI) {
      return res.json({
        success: true,
        data: result
      });
    } else {
      // Web login success
      const redirectUrl = req.session.returnTo || '/handler';
      delete req.session.returnTo;

      req.flash('success_msg', 'Login successful! Welcome back.');
      return res.redirect(redirectUrl);
    }

  } catch (error) {
    console.error('Login error:', error.message);
    
    if (req.isAPI) {
      return res.status(401).json({
        success: false,
        error: error.message || 'Invalid email or password'
      });
    }
    
    req.flash('error_msg', error.message || 'Invalid email or password');
    return res.redirect('/auth/login');
  }
};



// ==================== LOGOUT ====================
exports.logout = (req, res) => {
  if (req.isAPI) {
    // For API - just return success
    return res.json({
      success: true,
      data: { message: 'Logged out successfully' }
    });
  }
  
  // For web - logout and redirect with flash message
  req.logout((err) => {
    if (err) {
      req.flash('error_msg', 'Logout failed');
      return res.redirect('/handler');
    }
    
    req.flash('success_msg', 'Logged out successfully');
    res.redirect('/auth/login');
  });
};