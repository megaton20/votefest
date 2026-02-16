require('dotenv').config();

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

const sessionMiddleware = session({

    secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        httpOnly: true,
        secure: isProduction,
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

// Make user available to all views
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.currentPath = req.path;
  next();
});

// ===== SOCKET.IO AUTHENTICATION =====
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

// ===== SOCKET.IO EVENT HANDLERS =====
io.on('connection', (socket) => {

    // Join appropriate rooms
    if (socket.userId !== 'anonymous') {
        socket.join(`user:${socket.userId}`);

        if (socket.role === 'admin') {
            socket.join('admin-room');
            // Broadcast admin online status
            socket.broadcast.emit('admin-status', {
                status: 'online',
                username: socket.username
            });

            // Send initial conversations to admin
            sendAdminConversations(socket);
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
                console.log(' Unauthenticated user tried to send message');
                return socket.emit('error', { message: 'Please login to send messages' });
            }

            // Authorization checks for users
            if (socket.role === 'user' && targetUserId !== 'admin') {
                console.log(' User tried to send to non-admin:', targetUserId);
                return socket.emit('error', { message: 'Unauthorized' });
            }

            // Save message to database
            let result;

            if (socket.role === 'admin') {
                // Admin sending to user
                console.log(`Unsaid ${socket.userId} → User: ${targetUserId}`);
                result = await chatServices.sendAdminMessage(socket.userId, targetUserId, content);
            } else {
                // User sending to admin
                console.log(`User ${socket.userId} → Unsaid`);
                result = await chatServices.sendMessage(socket.userId, content);
            }

            if (!result.success) {
                console.error(' Database error:', result.error);
                return socket.emit('error', { message: result.error });
            }

            const message = result.message;

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

                // Update admin inbox
                updateAdminInboxForNewMessage(messageData, true);

                console.log(`Unsaid → User ${targetUserId}`);
            } else {
                // User -> Admin
                io.to('admin-room').emit('new-user-message', {
                    ...messageData,
                    username: socket.username
                });
                // User sees their own message
                socket.emit('new-message', { ...messageData, username: 'You' });

                // Update admin inbox
                updateAdminInboxForNewMessage(messageData, false);

                console.log(`User ${socket.username} → Unsaid`);
            }

        } catch (error) {
            console.error(' Message send error:', error);
            socket.emit('error', { message: 'Failed to send message: ' + error.message });
        }
    });

    // ===== ADMIN INBOX REQUESTS =====
    socket.on('admin-get-conversations', async () => {
        if (socket.role === 'admin') {
            await sendAdminConversations(socket);
        }
    });

    // ===== TYPING INDICATOR =====
    socket.on('typing', (data) => {
        const { targetUserId, isTyping, userId } = data;


        if (socket.role === 'admin' && targetUserId) {
            // Admin typing to user
            io.to(`user:${targetUserId}`).emit('typing', {
                userId: 'admin',
                targetUserId: targetUserId,
                isTyping: isTyping,
                username: 'Admin'
            });
        } else if (socket.role === 'user') {
            // User typing to admin
            io.to('admin-room').emit('typing', {
                userId: socket.userId,
                targetUserId: 'admin',
                isTyping: isTyping,
                username: socket.username
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
        console.log(` ${socket.username} disconnected`);

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
    console.error(' Application Error:', err);
    res.redirect('/');
});

// ===== START SERVER =====
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
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