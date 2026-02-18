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
            ticket_type VARCHAR CHECK (ticket_type IN ('regular', 'vip', 'vvip')),
            amount DECIMAL(10, 2) NOT NULL,
            qr_code_url VARCHAR,
            paystack_reference VARCHAR,
            is_used BOOLEAN DEFAULT FALSE,
            used_at TIMESTAMP,
            scanned_by VARCHAR REFERENCES users(id),
            scan_action VARCHAR(20),
            created_at TIMESTAMP DEFAULT NOW()
            )
    `;
      const logs = `
          CREATE TABLE IF NOT EXISTS scan_logs (
          id VARCHAR PRIMARY KEY,
          ticket_id VARCHAR REFERENCES tickets(id),
          scanner_id VARCHAR REFERENCES users(id),
          action VARCHAR(20) DEFAULT 'entry',
          scanned_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await createTableIfNotExists('tickets', createQuery);
    await createTableIfNotExists('scan_logs', logs);

  }



}

module.exports = Ticket;
