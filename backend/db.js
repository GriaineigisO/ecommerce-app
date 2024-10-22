// Import the Pool class from the 'pg' package
const { Pool } = require('pg');

// Create a new Pool instance to manage connections
const pool = new Pool({
  user: 'postgres',         
  host: 'localhost',             
  database: 'ecommerce_db', 
  password: 'postgres',   
  port: 5432,                   
});

// Export a function to query the database
module.exports = {
  query: (text, params) => pool.query(text, params), // Method to execute SQL queries
};
