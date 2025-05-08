// server.js - Main entry point
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv')

const app = express();
const PORT = 3001;
const JWT_SECRET = 'your_jwt_secret'; // Use environment variable in production

// Middleware
app.use(cors());
app.use(express.json());
dotenv.config();
// Database connection
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'sanskar',
  password: process.env.DB_PASSWORD || '9651765738', // Replace with your MySQL password
  database: process.env.DB_NAME || 'auction_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// AUTH MIDDLEWARE
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Forbidden' });
    req.user = user;
    next();
  });
};

// ROUTES
app.get('/', async(req, res)=>{
    return res.status(200).json({ message: 'Server up and running' });

})
// User Registration
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Insert user
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    
    res.status(201).json({ 
      message: 'User registered successfully',
      userId: result.insertId 
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Username or email already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// User Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const user = users[0];
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    // Generate token
    const token = jwt.sign(
      { userId: user.user_id, username: user.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.json({ token, userId: user.user_id, username: user.username });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get categories
app.get('/api/categories', async (req, res) => {
  try {
    const [categories] = await pool.execute('SELECT * FROM categories');
    res.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new item/auction
app.post('/api/items', authenticateToken, async (req, res) => {
  try {
    const { title, description, category_id, starting_price, end_date } = req.body;
    const seller_id = req.user.userId;
    
    const [result] = await pool.execute(
      'INSERT INTO items (seller_id, category_id, title, description, starting_price, current_price, end_date) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [seller_id, category_id, title, description, starting_price, starting_price, end_date]
    );
    
    res.status(201).json({ 
      message: 'Item listed successfully',
      itemId: result.insertId 
    });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all active items
app.get('/api/items', async (req, res) => {
  try {
    // Get query parameters for filtering
    const { category, search } = req.query;
    
    let query = `
      SELECT i.*, c.name as category_name, u.username as seller_name
      FROM items i
      JOIN categories c ON i.category_id = c.category_id 
      JOIN users u ON i.seller_id = u.user_id
      WHERE i.status = 'active'
    `;
    
    const params = [];
    
    if (category) {
      query += ' AND i.category_id = ?';
      params.push(category);
    }
    
    if (search) {
      query += ' AND (i.title LIKE ? OR i.description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += ' ORDER BY i.end_date ASC';
    
    const [items] = await pool.execute(query, params);
    res.json(items);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get item details
app.get('/api/items/:id', async (req, res) => {
  try {
    const [items] = await pool.execute(
      `SELECT i.*, c.name as category_name, u.username as seller_name
       FROM items i
       JOIN categories c ON i.category_id = c.category_id
       JOIN users u ON i.seller_id = u.user_id
       WHERE i.item_id = ?`,
      [req.params.id]
    );
    
    if (items.length === 0) {
      return res.status(404).json({ message: 'Item not found' });
    }
    
    const item = items[0];
    
    // Get bids for this item
    const [bids] = await pool.execute(
      `SELECT b.*, u.username as bidder_name
       FROM bids b
       JOIN users u ON b.bidder_id = u.user_id
       WHERE b.item_id = ?
       ORDER BY b.bid_amount DESC`,
      [req.params.id]
    );
    
    res.json({ ...item, bids });
  } catch (error) {
    console.error('Error fetching item details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Place a bid
app.post('/api/bids', authenticateToken, async (req, res) => {
  try {
    const { item_id, bid_amount } = req.body;
    const bidder_id = req.user.userId;
    
    // Check if item exists and is active
    const [items] = await pool.execute(
      'SELECT * FROM items WHERE item_id = ? AND status = "active"',
      [item_id]
    );
    
    if (items.length === 0) {
      return res.status(404).json({ message: 'Item not found or auction ended' });
    }
    
    const item = items[0];
    
    // Check if bid is higher than current price
    if (bid_amount <= item.current_price) {
      return res.status(400).json({ message: 'Bid must be higher than current price' });
    }
    
    // Check if bidder is not the seller
    if (bidder_id === item.seller_id) {
      return res.status(400).json({ message: 'You cannot bid on your own item' });
    }
    
    // Begin transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Insert bid
      await connection.execute(
        'INSERT INTO bids (item_id, bidder_id, bid_amount) VALUES (?, ?, ?)',
        [item_id, bidder_id, bid_amount]
      );
      
      // Update item's current price
      await connection.execute(
        'UPDATE items SET current_price = ? WHERE item_id = ?',
        [bid_amount, item_id]
      );
      
      await connection.commit();
      
      res.status(201).json({ message: 'Bid placed successfully' });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error placing bid:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's items (auctions they created)
app.get('/api/user/items', authenticateToken, async (req, res) => {
  try {
    const [items] = await pool.execute(
      `SELECT i.*, c.name as category_name 
       FROM items i
       JOIN categories c ON i.category_id = c.category_id
       WHERE i.seller_id = ?`,
      [req.user.userId]
    );
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching user items:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's bids
app.get('/api/user/bids', authenticateToken, async (req, res) => {
  try {
    const [bids] = await pool.execute(
      `SELECT b.*, i.title, i.current_price, i.end_date, i.status
       FROM bids b
       JOIN items i ON b.item_id = i.item_id
       WHERE b.bidder_id = ?
       ORDER BY b.bid_time DESC`,
      [req.user.userId]
    );
    
    res.json(bids);
  } catch (error) {
    console.error('Error fetching user bids:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Initialize the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// CRON-like function to check expired auctions (should be replaced with proper scheduled task)
const checkExpiredAuctions = async () => {
  try {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    
    // Get expired but still active auctions
    const [expiredItems] = await pool.execute(
      'SELECT * FROM items WHERE status = "active" AND end_date < ?',
      [now]
    );
    
    for (const item of expiredItems) {
      const connection = await pool.getConnection();
      await connection.beginTransaction();
      
      try {
        // Update item status
        await connection.execute(
          'UPDATE items SET status = ? WHERE item_id = ?',
          [item.current_price > item.starting_price ? 'sold' : 'expired', item.item_id]
        );
        
        // If item was sold, record transaction
        if (item.current_price > item.starting_price) {
          // Get highest bidder
          const [highestBids] = await connection.execute(
            'SELECT * FROM bids WHERE item_id = ? ORDER BY bid_amount DESC LIMIT 1',
            [item.item_id]
          );
          
          if (highestBids.length > 0) {
            const highestBid = highestBids[0];
            // Record transaction
            await connection.execute(
              'INSERT INTO transactions (item_id, buyer_id, amount) VALUES (?, ?, ?)',
              [item.item_id, highestBid.bidder_id, highestBid.bid_amount]
            );
          }
        }
        
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        console.error('Error processing expired auction:', error);
      } finally {
        connection.release();
      }
    }
  } catch (error) {
    console.error('Error checking expired auctions:', error);
  }
};

// Run auction checker every minute
// In production, use a proper scheduling solution
setInterval(checkExpiredAuctions, 60000);

// Run once at startup
checkExpiredAuctions();