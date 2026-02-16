const pool  = require('../config/db');
const createTableIfNotExists = require('../utils/createTableIfNotExists');

class Tranction {
  constructor(userId) {
    this.userId = userId;
  }
  
    static async init() {
      
      const createQuery = `
      CREATE TABLE IF NOT EXISTS transactions (
          id VARCHAR PRIMARY KEY,
          reference VARCHAR(100) UNIQUE NOT NULL,
          user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(20) CHECK (type IN ('deposit', 'transfer', 'vote', 'comment', 'reward')),
          amount DECIMAL(10, 2) NOT NULL,
          sender_wallet VARCHAR(20),
          receiver_wallet VARCHAR(20),
          metadata JSONB,
          status VARCHAR(20) DEFAULT 'completed',
          created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await createTableIfNotExists('transactions', createQuery);

  }



}

module.exports = Tranction;
