const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.NODE_ENV === "production" ? process.env.NEON_KEY : process.env.LOCAL_KEY  ,
  ssl:process.env.NODE_ENV === "production" ? {
    rejectUnauthorized: false,
  } : false,
  max: 20,
});

pool.connect((err, client, release) => {
  if (err) {
    return console.error("❌ Error acquiring client:", err.code);
  }
  console.log("Connected to Neon DB");
  release();
});

// Export the pool directly
module.exports = pool;