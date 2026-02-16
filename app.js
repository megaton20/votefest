// Load dotenv only in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
  console.log('📝 Loading environment variables from .env file (development mode)');
}
const express = require('express');
const app = express();
const session = require('express-session');
const bodyParser = require('body-parser');
const ejsLayouts = require('express-ejs-layouts');
const flash = require('connect-flash');
const passport = require('passport');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const SocketService = require('./services/SocketService');
const pgSession = require('connect-pg-simple')(session);
const { pool } = require('./config/db'); // Make sure you have a pool export

const server = http.createServer(app);
const io = socketIO(server);

const initAllModels = require('./initAllModels');
initAllModels();

const PORT = process.env.PORT || 5000;

// ===== EJS SETUP =====
app.set('view engine', 'ejs');
app.use(ejsLayouts);
app.use(express.static(path.join(__dirname, './', 'public')));

// ===== MIDDLEWARE SETUP =====
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// ===== SESSION SETUP =====
const isProduction = process.env.NODE_ENV === 'production';
console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

// Determine the trust proxy setting based on environment
if (isProduction) {
    // Render.com sits behind a proxy
    app.set('trust proxy', 1);
}

// Session store configuration
let sessionStore;
if (isProduction && process.env.DATABASE_URL) {
    // Use PostgreSQL store in production
    sessionStore = new pgSession({
        pool: pool,
        tableName: 'user_sessions',
        createTableIfMissing: true
    });
    console.log('Using PostgreSQL session store');
} else {
    // Use MemoryStore in development
    sessionStore = new session.MemoryStore();
    console.log('Using Memory session store (development only)');
}

const sessionMiddleware = session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: isProduction, // Only send cookie over HTTPS in production
        sameSite: isProduction ? 'none' : 'lax', // 'none' allows cross-site requests
        domain: isProduction ? process.env.DOMAIN || '.onrender.com' : undefined // Set domain for production
    },
    name: 'votefest.sid', // Custom session name to avoid default
    proxy: isProduction // Trust the reverse proxy in production
});

app.use(sessionMiddleware);

app.use(flash());

// ===== PASSPORT SETUP =====
app.use(passport.initialize());
app.use(passport.session());

// Flash message usage
app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.warning_msg = req.flash('warning_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    res.locals.user = req.user || null;
    res.locals.isAuthenticated = req.isAuthenticated();
    next();
});

// API detection middleware
app.use((req, res, next) => {
    req.isAPI = req.originalUrl.startsWith("/api");
    next();
});

// Make user available to all views
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.currentPath = req.path;
  next();
});

// ===== SOCKET.IO AUTHENTICATION =====
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

// Initialize Socket Service
const socketService = new SocketService(io);
app.locals.socketService = socketService;

const web = require('./router/web');
const api = require('./router/api');

app.use('/', web);
app.use('/api', api);

// 404 Handler
app.use((req, res) => {
    let userActive = req.user ? true : false;
    res.render('404', {
        pageTitle: `404`,
        userActive
    });
});

// General error handling middleware
app.use((err, req, res, next) => {
    console.error('Application Error:', err);
    res.redirect('/');
});

// ===== START SERVER =====
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`Session store: ${isProduction ? 'PostgreSQL' : 'Memory'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

module.exports = { app, server, io };