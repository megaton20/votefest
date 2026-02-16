const pool  = require('../config/db');
const createTableIfNotExists = require('../utils/createTableIfNotExists');

class Contestant {
  constructor(data = {}) {
    this.id = data.id;
    this.name = data.name;
    this.number = data.contestant_number;
    this.bio = data.bio;
    this.imageUrl = data.image_url;
    this.votes = data.votes;
    this.rank = data.rank;
  }


  static async init() {

    const createQuery = `
    CREATE TABLE IF NOT EXISTS contestants (
      id VARCHAR PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    contestant_number VARCHAR(10) UNIQUE NOT NULL,
    bio TEXT,
    image_url VARCHAR(500) DEFAULT '/default-contestant.jpg',
    votes INTEGER DEFAULT 0,
    current_rank INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
    `;

    await createTableIfNotExists('contestants', createQuery);

  }

  static async findAll() {
    const result = await pool.query(`
      SELECT *, 
             RANK() OVER (ORDER BY votes DESC) as rank
      FROM contestants
      ORDER BY votes DESC
    `);
    return result.rows.map(row => new Contestant(row));
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM contestants WHERE id = $1',
      [id]
    );
    return result.rows[0] ? new Contestant(result.rows[0]) : null;
  }

  async addVotes(count) {
    const result = await pool.query(
      'UPDATE contestants SET votes = votes + $1 WHERE id = $2 RETURNING votes',
      [count, this.id]
    );
    this.votes = result.rows[0].votes;
    return this.votes;
  }
}

module.exports = Contestant;
