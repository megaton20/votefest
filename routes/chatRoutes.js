//  chat route
const router = require('express').Router();
const chatController = require('../controllers/chatController');
const adminAuth = require('../middleware/adminAuth');

// User routes (public)
router.get('/', chatController.chatArea); // User chat interface
router.post('/send', chatController.sendMessage); // Send message to admin
router.get('/messages', chatController.getNewMessages); // Get new messages (real-time)

// Admin routes (protected)
router.get('/admin', adminAuth, chatController.adminInbox); // WhatsApp-like inbox
router.get('/admin/user/:userId', adminAuth, chatController.viewUserMessages); // View specific user chat
router.get('/admin/conversations/update', adminAuth, chatController.getConversationUpdates); // Real-time updates
// Add this route to your existing admin routes
router.post('/admin/reply/:userId', adminAuth, chatController.sendAdminReply);

// Admin API endpoints (protected)
router.post('/admin/mark-read/:messageId', adminAuth, chatController.markAsRead); // Mark as read
router.post('/admin/mark-all-read/:userId', adminAuth, chatController.markAllAsRead); // Mark all from user as read
router.post('/admin/delete/:messageId', adminAuth, chatController.deleteMessage); // Delete message



module.exports = router;