const pool = require('../config/db');
const User = require('../models/User'); // adjust path if needed

class Admin extends User {

  // Dashboard statistics for admin panel
  static async stats() {
    try {
      const totalUsersRes = await pool.query(
        'SELECT COUNT(*) FROM users WHERE role = $1 AND is_email_verified = $2',
        ['user', true]
      );
  


      return {
        totalUsers: parseInt(totalUsersRes.rows[0]?.count || 0, 10),

      };
    } catch (error) {
      console.error("Error getting dashboard stats:", error.message);
      return {
        success: false,
        error: `Error loading dashboard stats: ${error.message}`,
      };
    }
  }


  isAdmin() {
    return this.role === 'admin';
  }

}

module.exports = Admin;
