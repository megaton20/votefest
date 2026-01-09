const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const xss = require('xss-clean');
const hpp = require('hpp');
const User = require("../models/User");

// Security headers
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.socket.io", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'", "ws:", "wss:", "http://localhost:*", process.env.FRONTEND_URL || "http://localhost:3000"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "same-site" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// CSRF protection
const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  },
  value: (req) => {
    // Get token from header or body
    return req.headers['x-csrf-token'] || req.body._csrf;
  },
});

// Input sanitization
const sanitizeInput = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        // Basic XSS protection
        req.body[key] = req.body[key]
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;')
          .replace(/\//g, '&#x2F;')
          .trim();
      }
    });
  }
  next();
};

// Session security
const sessionSecurity = (req, res, next) => {
  // Prevent session fixation
  if (req.isAuthenticated() && !req.session.regenerated) {
    const tempSession = req.session;
    req.session.regenerate((err) => {
      if (err) return next(err);
      Object.assign(req.session, tempSession);
      req.session.regenerated = true;
      req.session.userId = req.user.id;
      next();
    });
  } else {
    next();
  }
};

// Socket.IO authentication verification - UPDATED VERSION
const socketAuth = async (socket, next) => {
  try {
    // Use socket.userId instead of socket.request.user
    const userId = socket.userId;
    
    if (!userId) {
      throw new Error('Authentication required');
    }

    // Verify user still exists and is active
    
    const user = await User.getById(userId);
    
    if (!user) {
      throw new Error('User not found');
    }

    // Additional security checks
    if (user.banned) {
      throw new Error('Account is banned');
    }

    if (user.suspended_until && new Date(user.suspended_until) > new Date()) {
      throw new Error('Account is suspended');
    }

    // Rate limiting for socket connections
    const io = socket.server;
    const connectionCount = Array.from(io.sockets.sockets.values())
      .filter(s => s.userId === userId).length;
    
    if (connectionCount > 5) {
      throw new Error('Too many connections from this account');
    }

    // Update socket with additional user info
    socket.userRole = user.role || 'user';
    socket.isActive = user.active !== false;
    socket.lastVerified = Date.now();

    next();
  } catch (error) {
    console.error('Socket auth error:', error);
    
    // Emit error to socket
    socket.emit('auth-error', { 
      message: error.message,
      code: 'AUTH_FAILED'
    });
    
    // Disconnect after short delay
    setTimeout(() => {
      socket.disconnect(true);
    }, 1000);
    
    next(new Error('Authentication failed'));
  }
};

// Socket rate limiter middleware
const socketRateLimiter = (socket, next) => {
  try {
    const SocketRateLimiter = require('socket.io-rate-limiter');
    const rateLimiter = SocketRateLimiter.createRateLimiter({
      points: 10, // 10 points
      duration: 1, // per second
      blockDuration: 60, // block for 60 seconds if exceeded
      keyGenerator: (socket) => {
        return socket.handshake.address || socket.userId || 'unknown';
      }
    });

    rateLimiter.consume(socket.handshake.address || socket.userId || 'unknown')
      .then(() => next())
      .catch(() => {
        socket.emit('rate-limit-error', { 
          message: 'Too many requests. Please slow down.' 
        });
        socket.disconnect(true);
        next(new Error('Rate limit exceeded'));
      });
  } catch (error) {
    next(error);
  }
};

// Request logging for security
const securityLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      userId: req.user?.id || 'anonymous'
    };

    // Log suspicious activity
    if (res.statusCode >= 400) {
      console.warn('⚠️ Security Warning:', logData);
    }
  });
  
  next();
};

module.exports = {
  securityHeaders,
  limiter,
  csrfProtection,
  sanitizeInput,
  sessionSecurity,
  socketAuth,
  socketRateLimiter,
  securityLogger,
  xss,
  hpp
};