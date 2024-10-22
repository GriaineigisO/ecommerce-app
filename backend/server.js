const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const session = require('express-session');
const passport = require('passport');
const ecommerce_db = require('./db')
const Stripe = require('stripe')
const bodyParser = require('body-parser');


const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Set up session
app.use(session({ 
    secret: 'your-secret-key', 
    resave: false, 
    saveUninitialized: true,
    cookie: {secure: false}
 }));
app.use(passport.initialize());
app.use(passport.session());

// User serialization
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});


app.get('/api/products/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-cache'); // Prevent caching
  const { id } = req.params;
  
  try {
    const product = await ecommerce_db.query('SELECT * FROM products WHERE id = $1', [id]);
    
    if (product.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product.rows[0]); // Send the product as JSON

  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.post('/api/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check if user already exists
    const userExists = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert new user into the database
    const newUser = await pool.query(
      'INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING *',
      [username, email, hashedPassword]
    );

     // Generate a token for the user (e.g., using JWT)
    const token = jwt.sign({ id: newUser._id }, 'your_jwt_secret', { expiresIn: '1h' });

     // Respond with the token and user data
    res.json({
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email
      }
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Compare the password with the hashed password in the database
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate a token (this is just a placeholder, implement actual JWT later)
    const token = 'sample_jwt_token'; // Replace with actual JWT logic

    // Respond with token and user data
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
    
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const products = await ecommerce_db.query('SELECT * FROM products');
    res.json(products.rows);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Error fetching products' });
  }
});

// Create a payment intent
app.post('/api/payment', async (req, res) => {
    const { amount } = req.body; // amount should be in cents

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency: 'gbp', // Set your currency
        });
        res.send({ clientSecret: paymentIntent.client_secret });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});