const chatServices = require('../services/chatServices');
const User = require("../models/User");

// Regular user chat (sees conversation with admin)
exports.chatArea = async (req, res) => {
  try {
    const result = await chatServices.getConversation(req.user?.id);

    res.render('chat', {
      user: req.user,
      messages: result.messages,
      currentUserId: req.user?.id
    });

  } catch (err) {
    console.error('chat controller error:', err);
    req.flash('error_msg', 'Something went wrong. Please try again later.');
    res.redirect('/handler');
  }
};
// Admin Inbox (WhatsApp-like conversation list)
exports.adminInbox = async (req, res) => {
  try {
    // Check if user is admin
    const isAdmin = await User.isAdmin(req.user?.id);
    if (!isAdmin) {
      req.flash('error_msg', 'Access denied');
      return res.redirect('/chat');
    }

    const result = await chatServices.getConversations();

    res.render('chat/inbox', {
      user: req.user,
      conversations: result.conversations,
      totalMessages: result.totalMessages,
      unreadCount: result.unreadCount,
      isAdmin: true,
      formatTime: (dateString) => {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        return date.toLocaleDateString();
      }
    });

  } catch (err) {
    console.error('admin inbox controller error:', err);
    req.flash('error_msg', 'Something went wrong. Please try again later.');
    res.redirect('/chat');
  }
};

// Admin: View specific user's messages
exports.viewUserMessages = async (req, res) => {
  try {
    const isAdmin = await User.isAdmin(req.user?.id);
    if (!isAdmin) {
      req.flash('error_msg', 'Access denied');
      return res.redirect('/chat');
    }

    const { userId } = req.params;
    const result = await chatServices.getMessagesFromUser(userId);
    
    // Mark all as read when admin opens chat
    await chatServices.markAllAsRead(userId);

    res.render('chat/admin-user-chat', {
      user: req.user,
      messages: result.messages,
      targetUser: result.user,
      unreadCount: result.unreadCount,
      isAdmin: true
    });

  } catch (err) {
    console.error('view user messages controller error:', err);
    req.flash('error_msg', 'Something went wrong. Please try again later.');
    res.redirect('/chat/admin');
  }
};

// Send message (user sends to admin)
exports.sendMessage = async (req, res) => {
  try {
    const result = await chatServices.sendMessage(req.user?.id, req.body.content);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    return res.json({
      success: true,
      message: result.message
    });

  } catch (err) {
    console.error('chat controller error:', err);
    return res.status(500).json({
      success: false,
      error: 'Something went wrong'
    });
  }
};

// Admin: Mark message as read
exports.markAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const result = await chatServices.markMessageAsRead(messageId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    return res.json({
      success: true,
      message: 'Message marked as read'
    });

  } catch (err) {
    console.error('mark as read controller error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to mark message as read'
    });
  }
};

// Admin: Mark all messages from user as read
exports.markAllAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await chatServices.markAllAsRead(userId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    return res.json({
      success: true,
      message: 'All messages marked as read'
    });

  } catch (err) {
    console.error('mark all as read controller error:', err);
    return res.status(500).json({
      success: false,
        error: 'Failed to mark messages as read'
    });
  }
};

// Admin: Delete message
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const result = await chatServices.deleteMessage(messageId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    return res.json({
      success: true,
      message: 'Message deleted'
    });

  } catch (err) {
    console.error('delete message controller error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete message'
    });
  }
};

// Get new messages (for real-time updates)
exports.getNewMessages = async (req, res) => {
  try {
    const sinceId = req.query.since || '0';
    const result = await chatServices.getNewMessages(sinceId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    return res.json(result.messages);

  } catch (err) {
    console.error('get new messages controller error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to get new messages'
    });
  }
};

// Get conversation updates for admin (real-time)
exports.getConversationUpdates = async (req, res) => {
  try {
    const isAdmin = await User.isAdmin(req.user?.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const lastUpdate = req.query.lastUpdate || new Date(0);
    const result = await chatServices.getConversationUpdates(lastUpdate);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    return res.json({
      success: true,
      newConversations: result.newConversations,
      unreadCount: result.unreadCount
    });

  } catch (err) {
    console.error('conversation updates controller error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to get updates'
    });
  }
};

// Admin: Send message to user
exports.sendAdminReply = async (req, res) => {
  try {
    const isAdmin = await User.isAdmin(req.user?.id);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const { userId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message cannot be empty'
      });
    }

    const result = await chatServices.sendAdminMessage(req.user?.id, userId, content);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

    return res.json({
      success: true,
      message: result.message
    });

  } catch (err) {
    console.error('admin reply controller error:', err);
    return res.status(500).json({
      success: false,
      error: 'Something went wrong'
    });
  }
};


