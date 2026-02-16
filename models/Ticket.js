const  pool  = require('../config/db');
const createTableIfNotExists = require('../utils/createTableIfNotExists');

class Ticket {
  constructor(userId) {
    this.userId = userId;
  }
  
    static async init() {
      
      const createQuery = `
      CREATE TABLE IF NOT EXISTS tickets (
          id VARCHAR PRIMARY KEY,
          user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
            ticket_type VARCHAR(20) CHECK (ticket_type IN ('regular', 'vip', 'vvip')),
            amount DECIMAL(10, 2) NOT NULL,
            qr_code_url VARCHAR(500),
            paystack_reference VARCHAR(100),
            is_used BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW()
            )
    `;

    await createTableIfNotExists('tickets', createQuery);

  }



}

module.exports = Ticket;
