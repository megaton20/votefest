const  pool = require('./db');

class Queries {
  static async getUserById(id) {
    const result = await pool.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async getUserByWallet(walletAccount) {
    const result = await pool.query(
      'SELECT * FROM users WHERE wallet_account = $1',
      [walletAccount]
    );
    return result.rows[0];
  }

  static async getContestantsWithRank() {
    const result = await pool.query(`
      SELECT id, name, contestant_number, bio, image_url, votes,
             RANK() OVER (ORDER BY votes DESC) as rank
            FROM contestants
            ORDER BY votes DESC
    `);
    return result.rows;
  }

  static async getWalletWithUser(userId) {
    const result = await pool.query(`
      SELECT w.*, u.wallet_account, u.username
      FROM wallets w
      JOIN users u ON u.id = w.user_id
      WHERE w.user_id = $1
    `, [userId]);
    return result.rows[0];
  }



  static async getUserTransactions(userId, limit = 50) {
    const result = await pool.query(`
      SELECT * FROM transactions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [userId, limit]);
    return result.rows;
  }
}

module.exports = Queries;
