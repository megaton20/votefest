const Wallet = require('../models/Wallet');
const pool = require('../config/db');
const Queries = require('../config/queries');
const PaystackService = require('../services/PaystackService');

class WalletController {
  constructor(socketService) {
    this.socketService = socketService;
    this.paystackService = new PaystackService();
  }
  
  async getWallet(req, res) {
    
    const userId = req.user.id
    
    try {
      const walletData = await Queries.getWalletWithUser(userId);
      const transactions = await Queries.getUserTransactions(userId);
      
      res.render('wallet', {
        user: req.user,
        wallet: walletData,
        transactions,
        paystackKey: process.env.PAYSTACK_PUBLIC_KEY
      });
    } catch (error) {
      console.error('Wallet error:', error);
      res.status(500).render('error', { error: 'Failed to load wallet' });
    }
  }
  
  async fundWallet(req, res) {
    const { amount } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;
    
    if (!amount || amount < 100) {
      return res.status(400).json({ 
        success: false, 
        error: 'Minimum amount is ₦100' 
      });
    }
    
    try {
      const payment = await this.paystackService.initializeServerTransaction(
        userEmail,
        amount,
        { 
          userId, 
          type: 'wallet_funding',
          username: req.user.username
        }
      );
      
      res.json({
        success: true,
        authorization_url: payment.data.authorization_url,
        reference: payment.data.reference
      });
      
    } catch (error) {
      console.error('Payment initialization error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Payment initialization failed. Please try again.' 
      });
    }
  }
  
  async verifyPayment(req, res) {
    const { reference } = req.query;
    const userId = req.user.id;
    
    if (!reference) {
      return res.redirect('/wallet?error=No payment reference provided');
    }
    
    try {
      const verification = await this.paystackService.verifyPayment(reference);
      
      if (verification.data.status === 'success') {
        const amount = verification.data.amount / 100;
        const coins = amount * 10; // 1 NGN = 10 coins
        
        const wallet = new Wallet(userId);
        const result = await wallet.addCoins(coins, 'deposit', {
          reference,
          amount: amount,
          payment_method: verification.data.channel,
          paid_at: verification.data.paid_at
        });
        
        // Send real-time update
        this.socketService.sendToUser(userId, 'wallet_update', {
          newBalance: result.newBalance,
          message: `✅ Wallet funded with ${coins} coins (₦${amount})`
        });
        
        this.socketService.sendToUser(userId, 'purchase_update', {
          success: true,
          message: `Payment successful! ₦${amount} = ${coins} coins added to wallet`
        });
        
        res.redirect('/wallet?success=Payment successful! Coins added to wallet');
      } else {
        res.redirect('/wallet?error=Payment verification failed');
      }
      
    } catch (error) {
      console.error('Payment verification error:', error);
      res.redirect('/wallet?error=Verification failed. Please contact support.');
    }
  }
  
  async transferCoins(req, res) {
    const { receiverWallet, amount } = req.body;
    const userId = req.user.id;
    
    if (!receiverWallet || !amount || amount < 10) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid transfer details' 
      });
    }
    
    try {
      const wallet = new Wallet(userId);
      const transfer = await wallet.transferCoins(receiverWallet, parseInt(amount));
      
      // Get sender's new balance
      const senderBalance = await wallet.getBalance();
      
      // Send private update to sender
      this.socketService.sendToUser(userId, 'wallet_update', {
        newBalance: senderBalance,
        message: `Transferred ${amount} coins to ${receiverWallet}`
      });
      
      // Get receiver's user ID and send update
      const receiverResult = await pool.query(
        'SELECT id FROM users WHERE wallet_account = $1',
        [receiverWallet]
      );
      
      if (receiverResult.rows.length > 0) {
        const receiverId = receiverResult.rows[0].id;
        const receiverWalletObj = new Wallet(receiverId);
        const receiverBalance = await receiverWalletObj.getBalance();
        
        this.socketService.sendToUser(receiverId, 'wallet_update', {
          newBalance: receiverBalance,
          message: `Received ${amount} coins from ${req.user.walletAccount}`
        });
      }
      
      res.json({
        success: true,
        message: `✅ Successfully transferred ${amount} coins to ${receiverWallet}`,
        transactionRef: transfer.transactionRef,
        newBalance: senderBalance
      });
      
    } catch (error) {
      console.error('Transfer error:', error);
      res.status(400).json({ 
        success: false, 
        error: error.message || 'Transfer failed' 
      });
    }
  }
}

module.exports = WalletController;