const  pool = require('../config/db');

class SocketService {
  constructor(io) {
    this.io = io;
    this.userSockets = new Map();
    this.leaderboardThrottle = new Map();
    
    this.initializeEvents();
  }
  
  initializeEvents() {
    this.io.on('connection', (socket) => {
      console.log('🔌 Client connected:', socket.id);
      
      socket.on('authenticate', (userId) => {
        if (userId) {
          this.userSockets.set(userId.toString(), socket.id);
          socket.userId = userId;
          console.log(`✅ User ${userId} authenticated`);
        }
      });
      
      socket.on('vote', async (data) => {
        this.io.emit('vote_update', data);
        this.throttleLeaderboardUpdate();
      });
      
      socket.on('comment', (data) => {
        this.io.emit('comment_update', data);
      });
      
      socket.on('disconnect', () => {
        if (socket.userId) {
          this.userSockets.delete(socket.userId.toString());
        }
        console.log('🔌 Client disconnected:', socket.id);
      });
    });
  }
  
  sendToUser(userId, event, data) {
    const socketId = this.userSockets.get(userId.toString());
    if (socketId) {
      this.io.to(socketId).emit(event, data);
    }
  }
  
  throttleLeaderboardUpdate() {
    const now = Date.now();
    const lastUpdate = this.leaderboardThrottle.get('lastUpdate') || 0;
    
    if (now - lastUpdate > 3000) {
      this.leaderboardThrottle.set('lastUpdate', now);
      this.updateLeaderboard();
    } else {
      if (this.leaderboardThrottle.get('timeout')) {
        clearTimeout(this.leaderboardThrottle.get('timeout'));
      }
      
      const timeout = setTimeout(() => {
        this.updateLeaderboard();
      }, 3000);
      
      this.leaderboardThrottle.set('timeout', timeout);
    }
  }
  
  async updateLeaderboard() {
    try {
      
      const result = await pool.query(`
        SELECT id, name, contestant_number, votes,
               RANK() OVER (ORDER BY votes DESC) as rank
        FROM contestants
        ORDER BY votes DESC
        LIMIT 20
      `);
      
      this.io.emit('leaderboard_update', result.rows);
    } catch (error) {
      console.error('Error updating leaderboard:', error);
    }
  }
}

module.exports = SocketService;
