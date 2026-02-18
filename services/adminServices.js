const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');

const Admin = require('../models/Admin');
const Contestant = require('../models/Contestant');


class adminServices {
  // Helper method for database queries
  static async _query(sql, params = []) {
    const { rows } = await pool.query(sql, params);
    return rows;
  }

  static async _querySingle(sql, params = []) {
    const rows = await this._query(sql, params);
    return rows[0] || null;
  }

  static async _execute(sql, params = []) {
    const result = await pool.query(sql, params);
    return result;
  }


  static async getDashboard(req) {
    const userId = req.user.id
    try {
      let allUser = await User.lisAll()
      const stats = await Admin.stats();



      return {
        success: true,
        data: {
          allUser,
          stats,
        }
      };
    } catch (error) {
      console.error("Error getting dashboard:", error.message);
      return {
        success: false,
        error: `Error loading dashboard: ${error.message}`,
      };
    }
  }

  static async getAllUsersPage() {
    try {

      const users = await Admin.allUsers();

      return {
        success: true,
        data: {
          users: users || []
        }
      };

    } catch (error) {
      console.error("Error getting dashboard:", error.message);
      return {
        success: false,
        error: `Error loading dashboard: ${error.message}`,
      };
    }
  }

  static async getUser(id) {
    try {

      const user = await Admin.getById(id);

      return {
        success: true,
        data: {
          user: user || []
        }
      };

    } catch (error) {
      console.error("Error getting dashboard:", error.message);
      return {
        success: false,
        error: `Error loading dashboard: ${error.message}`,
      };
    }
  }

  static async deleteUser(id) {
    try {

      await User.deleteUser(id);


      return {
        success: true,
        message: `user deleted`,
      };

    } catch (error) {
      console.error("Error deleting user:", error.message);
      return {
        success: false,
        message: `Error deleting user: ${error.message}`,
      };
    }
  }
 

  static async getAllContendersPage() {
    try {

      const users = await Contestant.findAll();

      return {
        success: true,
        data: {
          users: users || []
        }
      };

    } catch (error) {
      console.error("Error getting dashboard:", error.message);
      return {
        success: false,
        error: `Error loading dashboard: ${error.message}`,
      };
    }
  }

  static async getContender(id) {
    try {

      const user = await Contestant.findById(id);

      return {
        success: true,
        data: {
          user: user || []
        }
      };

    } catch (error) {
      console.error("Error getting dashboard:", error.message);
      return {
        success: false,
        error: `Error loading dashboard: ${error.message}`,
      };
    }
  }


  // add
  // update

  
  static async deleteContender(id) {
    try {

      await Contestant.deleteContender(id);


      return {
        success: true,
        message: `contestant deleted`,
      };

    } catch (error) {
      console.error("Error deleting contestant:", error.message);
      return {
        success: false,
        message: `Error deleting contestant: ${error.message}`,
      };
    }
  }


}

module.exports = adminServices;