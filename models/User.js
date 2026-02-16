const pool = require('../config/db');
const createTableIfNotExists = require('../utils/createTableIfNotExists');

class User {
  constructor(data = {}) {
    this.id = data.id;
    this.username = data.username;
    this.email = data.email;
    this.walletAccount = data.wallet_account;
    this.isAdmin = data.is_admin || false;
  }


  static async init() {

    const createQuery = `
    CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    wallet_account VARCHAR(20) UNIQUE NOT NULL DEFAULT 'ACC' || LPAD(floor(random() * 1000000)::text, 6, '0'),
    created_at TIMESTAMP DEFAULT NOW(),
    is_admin BOOLEAN DEFAULT FALSE
  
    );
    `;

    await createTableIfNotExists('users', createQuery);

  }



  static async create({id, username, email, passwordHash, newWallet}) {

    const result = await pool.query(
      `INSERT INTO users (id, username, email, password_hash) 
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, username, email, passwordHash]
    );

    // Create wallet for user
    await pool.query(
      'INSERT INTO wallets (id, user_id, balance) VALUES ($1,$2, 0)',
      [id, result.rows[0].id]
    );

    return new User(result.rows[0]);
  }

  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] ? result.rows[0] : null;
  }

  static async findByUsername(username) {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0] ? result.rows[0] : null;
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] ? result.rows[0] : null;
  }



 static async getDashboard(id) {
    const result = await pool.query(`
      SELECT 
        u.username,
        u.wallet_account,
        w.balance,
        w.total_votes_cast,
        w.loyalty_progress,
        (SELECT COUNT(*) FROM votes WHERE user_id = $1) as total_votes
      FROM users u
      JOIN wallets w ON w.user_id = u.id
      WHERE u.id = $1
    `, [id]);

    return result.rows[0];
  }

 static async getRecentVotes(id) {
  // Get recent votes
      const recentVotes = await pool.query(`
      SELECT v.*, c.name as contestant_name
      FROM votes v
      JOIN contestants c ON c.id = v.contestant_id
      WHERE v.user_id = $1
      ORDER BY v.created_at DESC
      LIMIT 10
    `, [id]);

    return recentVotes || [];
  }


}

module.exports = User;
