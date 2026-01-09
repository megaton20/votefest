// Always load dotenv
require('dotenv').config();

const express = require('express');
const app = express();
const session = require('express-session');
const bodyParser = require('body-parser');
const ejsLayouts = require('express-ejs-layouts');
const env = process.env;
const flash = require('connect-flash');
const passport = require('passport');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');

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
// Determine if we're in production or development
const isProduction = process.env.NODE_ENV === 'production';
console.log(`🌍 Environment: ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        // Secure cookies only in production (HTTPS)
        secure: isProduction,
        // Use 'none' for cross-site in production, 'lax' for local
        sameSite: isProduction ? 'none' : 'lax',
    },
    store: new session.MemoryStore()
});

app.use(sessionMiddleware);

app.use(flash());
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

// ===== SERVER & SOCKET.IO SETUP =====
const server = http.createServer(app);

// Configure CORS for Socket.IO
let corsOptions;
if (isProduction) {
    // Production settings
    const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()) : 
        [];
    
    console.log('✅ Production mode - Allowed origins:', allowedOrigins);
    
    corsOptions = {
        origin: function(origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) {
                console.log('⚠️ Request with no origin, allowing...');
                return callback(null, true);
            }
            
            // Check if origin is in allowed list
            if (allowedOrigins.length === 0) {
                console.log('⚠️ No allowed origins configured, allowing all');
                return callback(null, true);
            }
            
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }
            
            console.error(`❌ CORS blocked origin: ${origin}`);
            return callback(new Error('Not allowed by CORS'), false);
        },
        methods: ['GET', 'POST'],
        credentials: true
    };
} else {
    // Development settings
    console.log('🔧 Development mode - Allowing all origins');
    corsOptions = {
        origin: true, // Reflect the request origin
        credentials: true,
        methods: ['GET', 'POST']
    };
}

const io = socketIo(server, {
    cors: corsOptions,
    transports: ['websocket', 'polling']
});

// ===== SOCKET.IO AUTHENTICATION =====
io.use((socket, next) => {
    console.log('🔍 Socket connection attempt from:', socket.handshake.headers.origin);
    
    // Check if we have user data passed in auth (from frontend)
    const authData = socket.handshake.auth;
    if (authData && authData.userId && authData.userId !== '') {
        console.log(`✅ Using auth data: ${authData.username} (${authData.userId})`);
        socket.userId = authData.userId;
        socket.username = authData.username || 'User';
        socket.role = authData.role || 'user';
        return next();
    }
    
    // Try to get session from cookies
    const cookies = socket.handshake.headers.cookie;
    if (!cookies) {
        console.log('❌ No cookies found - anonymous connection');
        socket.userId = 'anonymous';
        socket.username = 'Anonymous';
        socket.role = 'guest';
        return next();
    }
    
    const sessionCookie = cookies.match(/connect\.sid=([^;]+)/)?.[1];
    if (!sessionCookie) {
        console.log('❌ No session cookie found');
        socket.userId = 'anonymous';
        socket.username = 'Anonymous';
        socket.role = 'guest';
        return next();
    }
    
    console.log('🍪 Found session cookie, attempting authentication...');
    
    // Use session middleware to restore session
    sessionMiddleware(socket.request, {}, (err) => {
        if (err) {
            console.error('Session middleware error:', err);
            socket.userId = 'anonymous';
            socket.username = 'Anonymous';
            socket.role = 'guest';
            return next();
        }
        
        // Check if user is authenticated in session
        if (socket.request.session && socket.request.session.passport) {
            const userId = socket.request.session.passport.user;
            console.log('✅ Found user ID in session:', userId);
            
            const User = require('./models/User');
            User.getById(userId)
                .then(user => {
                    if (user) {
                        socket.userId = user.id;
                        socket.username = user.username || 'Anonymous';
                        socket.role = user.role || 'user';
                        socket.user = user;
                        console.log(`✅ Socket authenticated: ${socket.username} (${user.id})`);
                    } else {
                        console.log('❌ User not found in database');
                        socket.userId = 'anonymous';
                        socket.username = 'Anonymous';
                        socket.role = 'guest';
                    }
                    next();
                })
                .catch(err => {
                    console.error('User fetch error:', err);
                    socket.userId = 'anonymous';
                    socket.username = 'Anonymous';
                    socket.role = 'guest';
                    next();
                });
        } else {
            console.log('❌ No passport found in session');
            socket.userId = 'anonymous';
            socket.username = 'Anonymous';
            socket.role = 'guest';
            next();
        }
    });
});

// ===== SOCKET.IO EVENT HANDLERS =====
io.on('connection', (socket) => {
    console.log(`🔗 New connection: ${socket.username} (${socket.userId}, ${socket.role})`);
    
    // Join appropriate rooms
    if (socket.userId !== 'anonymous') {
        socket.join(`user:${socket.userId}`);
        
        if (socket.role === 'admin') {
            socket.join('admin-room');
            console.log(`👑 Admin joined admin-room: ${socket.username}`);
            
            // Broadcast admin online status
            socket.broadcast.emit('admin-status', {
                status: 'online',
                username: socket.username
            });
        } else {
            // Notify admins about user online status
            io.to('admin-room').emit('user-status', {
                userId: socket.userId,
                username: socket.username,
                status: 'online'
            });
        }
        
        // Send connection confirmation with user data
        socket.emit('connected', {
            userId: socket.userId,
            role: socket.role,
            username: socket.username,
            authenticated: true
        });
    } else {
        // Send basic connection confirmation for anonymous
        socket.emit('connected', {
            userId: 'anonymous',
            role: 'guest',
            username: 'Anonymous',
            authenticated: false
        });
    }
    
    // ===== MESSAGE SENDING =====
    socket.on('send-message', async (data) => {
        console.log(`📩 Message from ${socket.username}:`, data);
        
        try {
            const { content, targetUserId } = data;
            
            // Input validation
            if (!content || !content.trim()) {
                return socket.emit('error', { message: 'Message cannot be empty' });
            }
            
            if (content.length > 500) {
                return socket.emit('error', { message: 'Message too long (max 500 characters)' });
            }
            
            // Check if user is authenticated (not anonymous)
            if (socket.userId === 'anonymous' || socket.role === 'guest') {
                console.log('❌ Unauthenticated user tried to send message');
                return socket.emit('error', { message: 'Please login to send messages' });
            }
            
            // Authorization checks for users
            if (socket.role === 'user' && targetUserId !== 'admin') {
                console.log('❌ User tried to send to non-admin:', targetUserId);
                return socket.emit('error', { message: 'Unauthorized' });
            }
            
            // Save message to database
            const chatServices = require('./services/chatServices');
            let result;
            
            if (socket.role === 'admin') {
                // Admin sending to user
                console.log(`👑 Admin ${socket.userId} → User ${targetUserId}`);
                result = await chatServices.sendAdminMessage(socket.userId, targetUserId, content);
            } else {
                // User sending to admin
                console.log(`👤 User ${socket.userId} → Admin`);
                result = await chatServices.sendMessage(socket.userId, content);
            }
            
            if (!result.success) {
                console.error('❌ Database error:', result.error);
                return socket.emit('error', { message: result.error });
            }
            
            const message = result.message;
            console.log('✅ Message saved to DB:', message.id);
            
            // Prepare message data
            const messageData = {
                id: message.id,
                user_id: socket.role === 'admin' ? targetUserId : socket.userId,
                content: message.content,
                is_from_admin: socket.role === 'admin',
                username: socket.role === 'admin' ? 'Admin' : socket.username,
                created_at: message.created_at,
                is_read: false
            };
            
            // Emit to recipients
            if (socket.role === 'admin') {
                // Admin -> User
                io.to(`user:${targetUserId}`).emit('new-message', messageData);
                // Admin sees their own message
                socket.emit('new-message', { ...messageData, username: 'You' });
                
                console.log(`📤 Socket emitted: Admin → User ${targetUserId}`);
            } else {
                // User -> Admin
                io.to('admin-room').emit('new-message', {
                    ...messageData,
                    username: socket.username
                });
                // User sees their own message
                socket.emit('new-message', { ...messageData, username: 'You' });
                
                console.log(`📤 Socket emitted: User ${socket.username} → Admin`);
            }
            
        } catch (error) {
            console.error('❌ Message send error:', error);
            socket.emit('error', { message: 'Failed to send message: ' + error.message });
        }
    });
    
    // ===== TYPING INDICATOR =====
    socket.on('typing', (data) => {
        const { targetUserId, isTyping } = data;
        
        if (socket.role === 'admin' && targetUserId) {
            // Admin typing to user
            io.to(`user:${targetUserId}`).emit('user-typing', {
                userId: 'admin',
                username: 'Admin',
                isTyping: isTyping
            });
        } else if (socket.role === 'user') {
            // User typing to admin
            io.to('admin-room').emit('user-typing', {
                userId: socket.userId,
                username: socket.username,
                isTyping: isTyping
            });
        }
    });
    
    // ===== MARK AS READ =====
    socket.on('mark-as-read', async (data) => {
        try {
            const { messageId } = data;
            
            // Only admin can mark messages as read
            if (socket.role !== 'admin') {
                return socket.emit('error', { message: 'Unauthorized' });
            }
            
            // Update in database
            const chatServices = require('./services/chatServices');
            await chatServices.markMessageAsRead(messageId);
            
            // Notify sender that their message was read
            socket.emit('message-read', { messageId });
            
            console.log(`✓ Message ${messageId} marked as read by admin ${socket.username}`);
            
        } catch (error) {
            console.error('Mark as read error:', error);
            socket.emit('error', { message: 'Failed to mark as read' });
        }
    });
    
    // ===== ONLINE STATUS =====
    socket.on('set-online-status', (status) => {
        if (socket.role === 'user') {
            io.to('admin-room').emit('user-status', {
                userId: socket.userId,
                username: socket.username,
                status: status
            });
        } else if (socket.role === 'admin') {
            io.emit('admin-status', {
                status: status,
                username: socket.username
            });
        }
    });
    
    // ===== DISCONNECTION =====
    socket.on('disconnect', () => {
        console.log(`🔌 ${socket.username} disconnected`);
        
        // Notify others
        if (socket.role === 'user') {
            io.to('admin-room').emit('user-status', {
                userId: socket.userId,
                username: socket.username,
                status: 'offline'
            });
        } else if (socket.role === 'admin') {
            io.emit('admin-status', {
                status: 'offline',
                username: socket.username
            });
        }
    });
    
    // ===== ERROR HANDLING =====
    socket.on('error', (error) => {
        console.error(`Socket ${socket.id} error:`, error);
    });
});

// ===== ROUTES =====
// Health check endpoint (required for Render)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'OK', 
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Debug endpoint
app.get('/debug', (req, res) => {
    res.json({
        environment: process.env.NODE_ENV,
        sessionId: req.sessionID,
        userId: req.user?.id,
        username: req.user?.username,
        isAuthenticated: req.isAuthenticated(),
        cookies: req.headers.cookie,
        nodeEnv: process.env.NODE_ENV
    });
});

// Test Socket.IO endpoint
app.get('/test-socket', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Socket.IO Test</title>
            <script src="/socket.io/socket.io.js"></script>
        </head>
        <body>
            <h1>Socket.IO Test Page</h1>
            <div id="status">Connecting...</div>
            <script>
                const socket = io({
                    withCredentials: true,
                    transports: ['websocket', 'polling']
                });
                
                socket.on('connect', () => {
                    document.getElementById('status').innerHTML = 'Connected!';
                    console.log('Socket connected:', socket.id);
                });
                
                socket.on('connected', (data) => {
                    console.log('Connected event:', data);
                    document.getElementById('status').innerHTML = 
                        'Connected as: ' + data.username + ' (' + data.userId + ')';
                });
                
                socket.on('error', (error) => {
                    console.error('Socket error:', error);
                    document.getElementById('status').innerHTML = 'Error: ' + error.message;
                });
            </script>
        </body>
        </html>
    `);
});

const web = require('./router/web');
const api = require('./router/api');

app.use('/', web);
app.use('/api', api);

// Add API endpoint for polling fallback
app.get('/chat/api/messages', async (req, res) => {
    try {
        const lastUpdate = req.query.lastUpdate;
        const userId = req.user?.id;
        
        if (!userId) {
            return res.json({ messages: [] });
        }
        
        const chatServices = require('./services/chatServices');
        const result = await chatServices.getNewMessages(lastUpdate);
        
        if (result.success) {
            res.json({ messages: result.messages || [] });
        } else {
            res.json({ messages: [] });
        }
    } catch (error) {
        console.error('API messages error:', error);
        res.json({ messages: [] });
    }
});

// ===== API ENDPOINTS =====
app.post('/api/update-join-status', (req, res) => {
    try {
        req.session.showJoinCommunity = true;
        res.json({ success: true });
    } catch (error) {
        console.error('Update join status error:', error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// ===== ERROR HANDLING =====
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
    console.error('🚨 Application Error:', err);
    let userActive = req.user ? true : false;
    res.redirect('/');
});

// ===== START SERVER =====
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔌 Socket.IO ready`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 Test Socket.IO: http://localhost:${PORT}/test-socket`);
    console.log(`❤️ Health check: http://localhost:${PORT}/health`);
    console.log(`🐛 Debug info: http://localhost:${PORT}/debug`);
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