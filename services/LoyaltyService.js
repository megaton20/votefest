const Wallet = require('../models/Wallet');
     const pool  = require('../config/db');

class LoyaltyService {
  constructor(socketService) {
    this.socketService = socketService;
    this.rewardThreshold = 600;
    this.rewardCoins = 50;
  }
  
  async checkAndReward(userId) {
    try {
 
      
      const result = await pool.query(
        'SELECT loyalty_progress FROM wallets WHERE user_id = $1',
        [userId]
      );
      
      if (result.rows.length === 0) return;
      
      const progress = result.rows[0].loyalty_progress;
      
      if (progress >= this.rewardThreshold) {
        const newProgress = progress % this.rewardThreshold;
        
        const wallet = new Wallet(userId);
        const addResult = await wallet.addCoins(
          this.rewardCoins,
          'reward',
          { reason: 'loyalty_reward', threshold: this.rewardThreshold }
        );
        
        await pool.query(
          'UPDATE wallets SET loyalty_progress = $1 WHERE user_id = $2',
          [newProgress, userId]
        );
        
        this.socketService.sendToUser(userId, 'loyalty_reward', {
          message: `🎉 Congratulations! You've received ${this.rewardCoins} coins (5 free votes) for reaching ${this.rewardThreshold} total votes!`,
          coinsAwarded: this.rewardCoins,
          newBalance: addResult.newBalance
        });
        
        console.log(`🎁 Loyalty reward awarded to user ${userId}`);
      }
    } catch (error) {
      console.error('Loyalty service error:', error);
    }
  }
}

module.exports = LoyaltyService;
