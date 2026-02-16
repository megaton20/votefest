const pool = require('../config/db');
const createTableIfNotExists = require('../utils/createTableIfNotExists');

class Vote {
  constructor(userId) {
    this.userId = userId;
  }
  
    static async init() {

    const createQuery = `
        CREATE TABLE IF NOT EXISTS votes (
            id VARCHAR PRIMARY KEY,
            user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
            contestant_id VARCHAR REFERENCES contestants(id) ON DELETE CASCADE,
            vote_count INTEGER DEFAULT 1,
            coins_spent DECIMAL(10, 2) DEFAULT 10.00,
            created_at TIMESTAMP DEFAULT NOW()
        );
    `;

    await createTableIfNotExists('votes', createQuery);

  }



}

module.exports = Vote;
