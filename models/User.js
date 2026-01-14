const pool = require('../config/db');
const createTableIfNotExists = require('../utils/createTableIfNotExists');

class User {

  static async init() {
    const createQuery = `
     CREATE TABLE users (
    id VARCHAR PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,

    token_expires TIMESTAMP,
    token VARCHAR,

    role TEXT DEFAULT 'user',

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
           
    await createTableIfNotExists('users', createQuery);

  }

  static async create({id, username, passwordHash}) {

    try {
      const result = await pool.query(`
      INSERT INTO users (username, password_hash, id )
      VALUES ($1, $2, $3)
      RETURNING *;
    `, [username, passwordHash, id]);

      return result.rows[0];
    } catch (error) {
      console.log(`error creating user: ${error.message}`);
      return null

    }
  }

  

static async isAdmin(userId) {
  try {
    const res = await pool.query(`
      SELECT role FROM users WHERE id = $1
    `, [userId]);
    return res.rows[0]?.role === 'admin';
  } catch (error) {
    console.log(`error checking admin status: ${error.message}`);
    return false;
  }
}

// Get admin user (you)
static async getAdmin() {
  try {
    const res = await pool.query(`
      SELECT * FROM users 
      WHERE role = 'admin' 
      LIMIT 1
    `);
    return res.rows[0];
  } catch (error) {
    console.log(`error getting admin: ${error.message}`);
    return null;
  }
}

  static async findByUsername(username) {
    try {
      const { rows } = await pool.query(
        `SELECT * FROM users WHERE username = $1 LIMIT 1`,
        [username]
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error in findByUsername:', error);
      return null;
    }
  }

  static async getById(userId) {
    try {
      const res = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
      return res.rows[0];
    } catch (error) {
      console.log(`error getting user: ${error.message}`);

    }
  }

  static async lisAll() {
    try {
      const {rows: res} = await pool.query(`SELECT * FROM users`);
      return res;
    } catch (error) {
      console.log(`error getting user: ${error.message}`);

    }
  }



  static async deleteUser(id){
    const result = await pool.query(`
        DELETE FROM users
        WHERE id = $1
      `, [id]);

      return result.rowCount > 0
  }
  
}

module.exports = User;
