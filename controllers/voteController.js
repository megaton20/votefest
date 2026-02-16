const Wallet = require('../models/Wallet');
const Contestant = require('../models/Contestant');
const LoyaltyService = require('../services/LoyaltyService');
const pool  = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class VoteController {
  constructor(socketService) {
    this.socketService = socketService;
    this.loyaltyService = new LoyaltyService(socketService);
  }
  
  async castVote(req, res) {
    const { contestantId, voteCount = 1 } = req.body;
    const userId = req.user.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!contestantId || voteCount < 1) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }
    
    const coinsRequired = voteCount * 10;
    
    try {
      const wallet = new Wallet(userId);
      
      // First check if user has enough coins (for better error message)
      const currentBalance = await wallet.getBalance();
      if (currentBalance < coinsRequired) {
        return res.status(400).json({ 
          success: false, 
          error: `Insufficient coins. You have ${currentBalance} coins but need ${coinsRequired} coins for ${voteCount} votes.`,
          balance: currentBalance,
          required: coinsRequired
        });
      }
      
      // Proceed with voting
      const deduction = await wallet.deductCoins(
        coinsRequired,
        'vote',
        { contestantId, voteCount }
      );
      
      const contestant = await Contestant.findById(contestantId);
      const newVotes = await contestant.addVotes(voteCount);
    
      await pool.query(
        `INSERT INTO votes (id, user_id, contestant_id, vote_count, coins_spent)
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), userId, contestantId, voteCount, coinsRequired]
      );
      
      await pool.query(
        `UPDATE wallets 
         SET total_votes_cast = total_votes_cast + $1,
             loyalty_progress = loyalty_progress + $1
         WHERE user_id = $2`,
        [voteCount, userId]
      );
      
      await this.loyaltyService.checkAndReward(userId);
      
      // Emit socket events
      this.socketService.io.emit('vote_update', {
        contestantId,
        newVotes,
        voteCount,
        userId
      });
      
      this.socketService.throttleLeaderboardUpdate();
      
      this.socketService.sendToUser(userId, 'wallet_update', {
        newBalance: deduction.newBalance,
        coinsSpent: coinsRequired
      });
      
      res.json({
        success: true,
        newVotes,
        newBalance: deduction.newBalance,
        message: `Voted ${voteCount} time(s) successfully!`
      });
      
    } catch (error) {
      console.error('Vote error:', error);
      
      // Check if it's an insufficient coins error from deductCoins
      if (error.message === 'Insufficient coins') {
        const wallet = new Wallet(userId);
        const balance = await wallet.getBalance().catch(() => 0);
        return res.status(400).json({ 
          success: false, 
          error: `Insufficient coins. You have ${balance} coins but need ${coinsRequired} coins.`,
          balance: balance,
          required: coinsRequired
        });
      }
      
      res.status(400).json({ 
        success: false, 
        error: error.message || 'Vote failed'
      });
    }
  }
  
  async getLeaderboard(req, res) {
    try {
      const contestants = await Contestant.findAll();
      res.json(contestants);
    } catch (error) {
      console.error('Leaderboard error:', error);
      res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
  }
}

module.exports = VoteController;