const pool = require('../config/db');
const createTableIfNotExists = require('../utils/createTableIfNotExists');

class Ticket {
  constructor(userId) {
    this.userId = userId;
  }

  static async init() {
    // First, create the main tickets table
    const createTicketsQuery = `
      CREATE TABLE IF NOT EXISTS tickets (
          id VARCHAR PRIMARY KEY,
          purchaser_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
          ticket_category VARCHAR CHECK (ticket_category IN ('regular', 'vip', 'table5', 'table10', 'table15')),
          quantity INTEGER DEFAULT 1,
          total_amount DECIMAL(10, 2) NOT NULL,
          paystack_reference VARCHAR UNIQUE,
          is_fully_used BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await createTableIfNotExists('tickets', createTicketsQuery);

    // Create individual_tickets table with proper foreign keys
    const createIndividualTicketsQuery = `
      CREATE TABLE IF NOT EXISTS individual_tickets (
          id VARCHAR PRIMARY KEY,
          parent_ticket_id VARCHAR REFERENCES tickets(id) ON DELETE CASCADE,
          user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
          wallet_account VARCHAR(20),
          attendee_name VARCHAR(100) NOT NULL,
          attendee_email VARCHAR(100) NOT NULL,
          ticket_type VARCHAR(20),
          qr_code_url TEXT,
          qr_code_hash VARCHAR(32) UNIQUE,
          is_checked_in BOOLEAN DEFAULT FALSE,
          checked_in_at TIMESTAMP,
          checked_in_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await createTableIfNotExists('individual_tickets', createIndividualTicketsQuery);

    // Create indexes for individual_tickets
    const createIndividualIndexesQuery = `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_individual_tickets_qr_hash ON individual_tickets (qr_code_hash);
      CREATE INDEX IF NOT EXISTS idx_individual_user ON individual_tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_individual_wallet ON individual_tickets(wallet_account);
      CREATE INDEX IF NOT EXISTS idx_individual_email ON individual_tickets(attendee_email);
      CREATE INDEX IF NOT EXISTS idx_individual_parent ON individual_tickets(parent_ticket_id);
      CREATE INDEX IF NOT EXISTS idx_individual_checked ON individual_tickets(is_checked_in);
    `;
    
    // Execute indexes separately
    const client = await pool.connect();
    try {
      await client.query(createIndividualIndexesQuery);
    } finally {
      client.release();
    }

    // Create scan_logs table
    const createScanLogsQuery = `
      CREATE TABLE IF NOT EXISTS scan_logs (
          id VARCHAR PRIMARY KEY,
          ticket_id VARCHAR REFERENCES individual_tickets(id) ON DELETE CASCADE,
          scanner_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
          attendee_name VARCHAR(100),
          ticket_type VARCHAR(20),
          scanned_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await createTableIfNotExists('scan_logs', createScanLogsQuery);

    // Create indexes for scan_logs
    const createScanLogsIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_scan_logs_date ON scan_logs(scanned_at);
      CREATE INDEX IF NOT EXISTS idx_scan_logs_ticket ON scan_logs(ticket_id);
    `;
    
    const client2 = await pool.connect();
    try {
      await client2.query(createScanLogsIndexesQuery);
    } finally {
      client2.release();
    }

    // Create notifications table
    const createNotificationsQuery = `
      CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR PRIMARY KEY,
          user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(200) NOT NULL,
          message TEXT,
          data JSONB,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW()
      )
    `;
    await createTableIfNotExists('notifications', createNotificationsQuery);

    // Create indexes for notifications
    const createNotificationsIndexesQuery = `
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
    `;
    
    const client3 = await pool.connect();
    try {
      await client3.query(createNotificationsIndexesQuery);
    } finally {
      client3.release();
    }

    console.log('✅ All ticket tables initialized successfully');
  }
}

module.exports = Ticket;