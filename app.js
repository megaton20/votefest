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

const PORT = env.PORT;

// ===== EJS SETUP =====
app.set('view engine', 'ejs');
app.use(ejsLayouts);
app.use(express.static(path.join(__dirname, './', 'public')));

// ===== MIDDLEWARE SETUP =====
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// ===== SESSION SETUP =====
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'your-secret-key-changeme-12345',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production' ? true : false, // Only HTTPS in production
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-site in production
        domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined
    },
    store: process.env.NODE_ENV === 'production' ? 
        (() => {
            // For production, you should use a proper session store
            // Using memory store for now, but consider Redis for production
            console.log('⚠️ Using memory session store - not suitable for production scaling');
            return new session.MemoryStore();
        })() : 
        new session.MemoryStore()
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

// Get allowed origins from environment or use defaults
const allowedOrigins = process.env.NODE_ENV === 'production' 
    ? (process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [])
    : ['http://localhost:5000', 'http://127.0.0.1:3000', process.env.SOCKET_IO_ORIGIN];

const io = socketIo(server, {
    cors: {
        origin: function(origin, callback) {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);
            
            // Check if origin is in allowed list
            if (allowedOrigins.indexOf(origin) === -1) {
                const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;
                console.error('CORS Error:', msg);
                return callback(new Error(msg), false);
            }
            return callback(null, true);
        },
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true // For compatibility with older clients
});


// ===== SOCKET.IO AUTHENTICATION =====
// Simple authentication wrapper - NO REQUEST OBJECT MODIFICATION
io.use((socket, next) => {
    // Get session ID from handshake
    const sessionId = socket.handshake.auth.sessionId || 
                     socket.handshake.headers.cookie?.match(/connect\.sid=([^;]+)/)?.[1];
    
    if (sessionId) {
        // Get session from memory store
        sessionMiddleware(socket.request, {}, (err) => {
            if (err) {
                console.error('Session middleware error:', err);
                socket.userId = 'anonymous';
                socket.username = 'Anonymous';
                socket.role = 'guest';
                return next();
            }
            
            // Check if user is authenticated
            if (socket.request.session && socket.request.session.passport) {
                const userId = socket.request.session.passport.user;
                
                // Get user from database
              const User = require('./models/User');
                User.getById(userId)
                    .then(user => {
                        if (user) {
                            // Store user info on SOCKET object (not request!)
                            socket.userId = user.id;
                            socket.username = user.username || 'Anonymous';
                            socket.role = user.role || 'user';
                            socket.user = user;
                            console.log(`✅ Socket authenticated: ${socket.username} (${user.id})`);
                        } else {
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
                socket.userId = 'anonymous';
                socket.username = 'Anonymous';
                socket.role = 'guest';
                next();
            }
        });
    } else {
        // No session, anonymous user
        socket.userId = 'anonymous';
        socket.username = 'Anonymous';
        socket.role = 'guest';
        next();
    }
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