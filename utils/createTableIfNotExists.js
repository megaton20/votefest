const pool = require('../config/db'); // adjust path to your DB pool

async function createTableIfNotExists(tableName, createQuery) {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      );
    `, [tableName]);

    if (!result.rows[0].exists) {
      await pool.query(createQuery);
      console.log(`✅ Table '${tableName}' created successfully.`);
    } else {
      // console.log(`ℹ️ Table '${tableName}' already exists.`);
    }
  } catch (error) {
    console.error(`❌ Error while checking/creating table '${tableName}':`, error.message);
  }
}

module.exports = createTableIfNotExists;
