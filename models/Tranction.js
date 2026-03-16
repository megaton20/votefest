const pool = require('../config/db');
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
const paymentSplits = 
    `
    CREATE TABLE IF NOT EXISTS payment_splits (
    id SERIAL PRIMARY KEY,
    payment_reference VARCHAR(100) UNIQUE,
    environment VARCHAR(100),
    split_config JSONB,
    amount DECIMAL(10, 2),
    payment_type VARCHAR(50), -- 'wallet_funding' or 'ticket_purchase'
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_splits_reference ON payment_splits(payment_reference);
CREATE INDEX IF NOT EXISTS idx_payment_splits_type ON payment_splits(payment_type);
`

   await createTableIfNotExists('payment_splits', paymentSplits);
  }



}

module.exports = Tranction;
