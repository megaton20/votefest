const  pool  = require('../config/db');
const createTableIfNotExists = require('../utils/createTableIfNotExists');
const { v4: uuidv4 } = require('uuid');
class Wallet {
  constructor(userId) {
    this.userId = userId;
  }
  
    static async init() {

    const createQuery = `
    CREATE TABLE IF NOT EXISTS wallets (
    id VARCHAR PRIMARY KEY,
    user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    balance DECIMAL(10, 2) DEFAULT 0.00,
    total_deposited DECIMAL(10, 2) DEFAULT 0.00,
    total_votes_cast INTEGER DEFAULT 0,
    loyalty_progress INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW()
);
    `;

    await createTableIfNotExists('wallets', createQuery);

  }

  async getBalance() {
    const result = await pool.query(
      'SELECT balance FROM wallets WHERE user_id = $1',
      [this.userId]
    );
    return result.rows[0]?.balance || 0;
  }
  
  async deductCoins(amount, transactionType, metadata = {}) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const balanceResult = await client.query(
        'SELECT balance FROM wallets WHERE user_id = $1 FOR UPDATE',
        [this.userId]
      );
      
      const currentBalance = parseFloat(balanceResult.rows[0]?.balance || 0);
      if (currentBalance < amount) {
        throw new Error('Insufficient coins');
      }
      
      await client.query(
        'UPDATE wallets SET balance = balance - $1, last_updated = NOW() WHERE user_id = $2',
        [amount, this.userId]
      );
      
      const reference = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await client.query(
        `INSERT INTO transactions 
         (id, reference, user_id, type, amount, metadata, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          uuidv4(),
          reference,
          this.userId,
          transactionType,
          amount,
          JSON.stringify(metadata),
          'completed'
        ]
      );
      
      await client.query('COMMIT');
      
      return {
        success: true,
        newBalance: currentBalance - amount,
        transactionId: reference
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  async addCoins(amount, transactionType, metadata = {}) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if wallet exists
      const walletExists = await client.query(
        'SELECT id FROM wallets WHERE user_id = $1',
        [this.userId]
      );
      
      if (walletExists.rows.length === 0) {
        await client.query(
          'INSERT INTO wallets (user_id, balance, id) VALUES ($1, $2, $3)',
          [this.userId, amount, uuidv4()]
        );
      } else {
        await client.query(
          'UPDATE wallets SET balance = balance + $1, last_updated = NOW() WHERE user_id = $2',
          [amount, this.userId]
        );
      }
      
      const reference = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await client.query(
        `INSERT INTO transactions 
         (id, reference, user_id, type, amount, metadata, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          uuidv4(),
          reference,
          this.userId,
          transactionType,
          amount,
          JSON.stringify(metadata),
          'completed'
        ]
      );
      
      await client.query('COMMIT');
      
      const newBalance = await this.getBalance();
      return { success: true, newBalance, reference };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  async transferCoins(receiverWalletAccount, amount) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const receiverResult = await client.query(
        'SELECT id FROM users WHERE wallet_account = $1',
        [receiverWalletAccount]
      );
      
      if (receiverResult.rows.length === 0) {
        throw new Error('Receiver wallet account not found');
      }
      
      const receiverId = receiverResult.rows[0].id;
      
      const senderBalance = await this.getBalance();
      if (senderBalance < amount) {
        throw new Error('Insufficient coins for transfer');
      }
      
      await client.query(
        'UPDATE wallets SET balance = balance - $1, last_updated = NOW() WHERE user_id = $2',
        [amount, this.userId]
      );
      
      await client.query(
        'UPDATE wallets SET balance = balance + $1, last_updated = NOW() WHERE user_id = $2',
        [amount, receiverId]
      );
      
      const transactionRef = `TRF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const senderWallet = await this.getWalletAccount();
      
      await client.query(
        `INSERT INTO transactions 
         (id, reference, user_id, type, amount, sender_wallet, receiver_wallet, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          uuidv4(),
          transactionRef,
          this.userId,
          'transfer',
          amount,
          senderWallet,
          receiverWalletAccount,
          'completed'
        ]
      );
      
      
      await client.query('COMMIT');
      
      return {
        success: true,
        message: 'Transfer completed successfully',
        transactionRef
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  async getWalletAccount() {
    const result = await pool.query(
      'SELECT wallet_account FROM users WHERE id = $1',
      [this.userId]
    );
    return result.rows[0]?.wallet_account;
  }
  
  async updateLoyaltyProgress(votes) {
    await pool.query(
      'UPDATE wallets SET loyalty_progress = loyalty_progress + $1 WHERE user_id = $2',
      [votes, this.userId]
    );
  }
}

module.exports = Wallet;
