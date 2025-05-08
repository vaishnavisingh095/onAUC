// App.js - Main Component
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import './App.css';

// API Base URL
const API_URL =  process.env.REACT_API_URL||'http://localhost:3001/api';

// Auth Context
const AuthContext = React.createContext();

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    // Check for stored token on initial load
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);
  
  const login = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };
  
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };
  
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Auth Hook
function useAuth() {
  return React.useContext(AuthContext);
}

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user } = useAuth();
  
  if (!user) {
    return <Navigate to="/login" />;
  }
  
  return children;
}

// API Helper
async function fetchAPI(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'API request failed');
  }
  
  return response.json();
}

// COMPONENTS

// Navigation Component
function Navigation() {
  const { user, logout } = useAuth();
  
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/">Auction App</Link>
      </div>
      <div className="navbar-menu">
        <Link to="/">Home</Link>
        {user ? (
          <>
            <Link to="/profile">Profile</Link>
            <Link to="/create-auction">Create Auction</Link>
            <button onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}

// Register Component
function Register() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }
    
    try {
      await fetchAPI('/register', {
        method: 'POST',
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password
        })
      });
      
      setSuccess('Registration successful! You can now login.');
      setFormData({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
      });
    } catch (err) {
      setError(err.message);
    }
  };
  
  return (
    <div className="auth-form">
      <h2>Register</h2>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Username</label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength="6"
          />
        </div>
        
        <div className="form-group">
          <label>Confirm Password</label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            minLength="6"
          />
        </div>
        
        <button type="submit">Register</button>
      </form>
    </div>
  );
}

// User Profile Component
function Profile() {
  const { user } = useAuth();
  const [userItems, setUserItems] = useState([]);
  const [userBids, setUserBids] = useState([]);
  const [activeTab, setActiveTab] = useState('items');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchUserData = async () => {
      setLoading(true);
      try {
        // Fetch user's items
        const items = await fetchAPI('/user/items');
        setUserItems(items);
        
        // Fetch user's bids
        const bids = await fetchAPI('/user/bids');
        setUserBids(bids);
      } catch (err) {
        console.error('Error fetching user data:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, []);
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  return (
    <div className="profile-container">
      <h1>My Profile</h1>
      <div className="user-info">
        <p><strong>Username:</strong> {user.username}</p>
      </div>
      
      <div className="profile-tabs">
        <button 
          className={activeTab === 'items' ? 'active' : ''}
          onClick={() => setActiveTab('items')}
        >
          My Auctions
        </button>
        <button 
          className={activeTab === 'bids' ? 'active' : ''}
          onClick={() => setActiveTab('bids')}
        >
          My Bids
        </button>
      </div>
      
      {loading ? (
        <div>Loading...</div>
      ) : activeTab === 'items' ? (
        <div className="user-items">
          <h2>My Auctions</h2>
          
          {userItems.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Current Price</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {userItems.map(item => (
                  <tr key={item.item_id}>
                    <td>{item.title}</td>
                    <td>{item.category_name}</td>
                    <td>${item.current_price}</td>
                    <td>{formatDate(item.end_date)}</td>
                    <td>{item.status}</td>
                    <td>
                      <Link to={`/item/${item.item_id}`}>View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>You haven't created any auctions yet.</p>
          )}
        </div>
      ) : (
        <div className="user-bids">
          <h2>My Bids</h2>
          
          {userBids.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Bid Amount</th>
                  <th>Current Price</th>
                  <th>Bid Time</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {userBids.map(bid => (
                  <tr key={bid.bid_id}>
                    <td>{bid.title}</td>
                    <td>${bid.bid_amount}</td>
                    <td>${bid.current_price}</td>
                    <td>{formatDate(bid.bid_time)}</td>
                    <td>
                      {bid.status === 'active' 
                        ? bid.bid_amount >= bid.current_price ? 'Winning' : 'Outbid'
                        : bid.status}
                    </td>
                    <td>
                      <Link to={`/item/${bid.item_id}`}>View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>You haven't placed any bids yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Main App Component
function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Navigation />
          
          <main className="content">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/item/:id" element={<ItemDetail />} />
              <Route 
                path="/profile" 
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/create-auction" 
                element={
                  <ProtectedRoute>
                    <CreateAuction />
                  </ProtectedRoute>
                } 
              />
            </Routes>
          </main>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

// Login Component
function Login() {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await fetchAPI('/login', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      
      login({ userId: response.userId, username: response.username }, response.token);
    } catch (err) {
      setError(err.message || 'Login failed');
    }
  };
  
  return (
    <div className="auth-form">
      <h2>Login</h2>
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>
        
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

// Home Component - List Active Auctions
function Home() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    category: '',
    search: ''
  });
  
  useEffect(() => {
    // Fetch categories
    const fetchCategories = async () => {
      try {
        const data = await fetchAPI('/categories');
        setCategories(data);
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    
    fetchCategories();
  }, []);
  
  useEffect(() => {
    // Fetch items with filters
    const fetchItems = async () => {
      setLoading(true);
      try {
        let endpoint = '/items';
        const params = new URLSearchParams();
        
        if (filter.category) {
          params.append('category', filter.category);
        }
        
        if (filter.search) {
          params.append('search', filter.search);
        }
        
        const queryString = params.toString();
        if (queryString) {
          endpoint += `?${queryString}`;
        }
        
        const data = await fetchAPI(endpoint);
        setItems(data);
      } catch (err) {
        console.error('Error fetching items:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchItems();
  }, [filter]);
  
  const handleFilterChange = (e) => {
    setFilter({ ...filter, [e.target.name]: e.target.value });
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  return (
    <div className="home-container">
      <h1>Active Auctions</h1>
      
      <div className="filters">
        <div className="filter-group">
          <label>Category:</label>
          <select 
            name="category" 
            value={filter.category} 
            onChange={handleFilterChange}
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category.category_id} value={category.category_id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="filter-group">
          <label>Search:</label>
          <input
            type="text"
            name="search"
            value={filter.search}
            onChange={handleFilterChange}
            placeholder="Search items..."
          />
        </div>
      </div>
      
      {loading ? (
        <div>Loading...</div>
      ) : items.length > 0 ? (
        <div className="items-grid">
          {items.map(item => (
            <div key={item.item_id} className="item-card">
              <h3>{item.title}</h3>
              <p className="item-category">{item.category_name}</p>
              <p className="item-seller">Seller: {item.seller_name}</p>
              <p className="item-price">Current Bid: ${item.current_price}</p>
              <p className="item-end-date">Ends at: {formatDate(item.end_date)}</p>
              <Link to={`/item/${item.item_id}`} className="view-button">
                View Details
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div>No active auctions found</div>
      )}
    </div>
  );
}

// Item Detail Component
function ItemDetail() {
  const { user } = useAuth();
  const [item, setItem] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Get item ID from URL
  const itemId = window.location.pathname.split('/')[2];
  
  useEffect(() => {
    const fetchItemDetails = async () => {
      setLoading(true);
      try {
        const data = await fetchAPI(`/items/${itemId}`);
        setItem(data);
        // Set initial bid amount slightly higher than current price
        setBidAmount((parseFloat(data.current_price) + 1).toFixed(2));
      } catch (err) {
        console.error('Error fetching item details:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchItemDetails();
  }, [itemId]);
  
  const handleBidSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!user) {
      setError('You must be logged in to place a bid');
      return;
    }
    
    if (parseFloat(bidAmount) <= parseFloat(item.current_price)) {
      setError('Bid must be higher than the current price');
      return;
    }
    
    try {
      await fetchAPI('/bids', {
        method: 'POST',
        body: JSON.stringify({
          item_id: item.item_id,
          bid_amount: parseFloat(bidAmount)
        })
      });
      
      setSuccess('Bid placed successfully!');
      
      // Refresh item details to show updated bid
      const updatedItem = await fetchAPI(`/items/${itemId}`);
      setItem(updatedItem);
      setBidAmount((parseFloat(updatedItem.current_price) + 1).toFixed(2));
    } catch (err) {
      setError(err.message);
    }
  };
  
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!item) {
    return <div>Item not found</div>;
  }
  
  const isAuctionEnded = new Date(item.end_date) < new Date();
  const isSellerOwner = user && user.userId === item.seller_id;
  
  return (
    <div className="item-detail">
      <h1>{item.title}</h1>
      
      <div className="item-info">
        <div className="info-group">
          <span>Category:</span>
          <span>{item.category_name}</span>
        </div>
        
        <div className="info-group">
          <span>Seller:</span>
          <span>{item.seller_name}</span>
        </div>
        
        <div className="info-group">
          <span>Current Bid:</span>
          <span className="current-price">${item.current_price}</span>
        </div>
        
        <div className="info-group">
          <span>Starting Price:</span>
          <span>${item.starting_price}</span>
        </div>
        
        <div className="info-group">
          <span>Auction Ends:</span>
          <span className={isAuctionEnded ? 'ended' : ''}>
            {formatDate(item.end_date)}
            {isAuctionEnded && ' (Ended)'}
          </span>
        </div>
        
        <div className="item-description">
          <h3>Description</h3>
          <p>{item.description}</p>
        </div>
      </div>
      
      <div className="bidding-section">
        <h2>Bidding</h2>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        {!isAuctionEnded && !isSellerOwner && user && (
          <form onSubmit={handleBidSubmit} className="bid-form">
            <div className="form-group">
              <label>Your Bid ($)</label>
              <input
                type="number"
                step="0.01"
                min={parseFloat(item.current_price) + 0.01}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                required
              />
            </div>
            
            <button type="submit">Place Bid</button>
          </form>
        )}
        
        {isSellerOwner && (
          <div className="seller-message">
            You cannot bid on your own item.
          </div>
        )}
        
        {!user && (
          <div className="login-message">
            <Link to="/login">Login</Link> to place a bid.
          </div>
        )}
        
        {isAuctionEnded && (
          <div className="auction-ended-message">
            This auction has ended.
          </div>
        )}
        
        <div className="bid-history">
          <h3>Bid History</h3>
          
          {item.bids && item.bids.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Bidder</th>
                  <th>Amount</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {item.bids.map(bid => (
                  <tr key={bid.bid_id}>
                    <td>{bid.bidder_name}</td>
                    <td>${bid.bid_amount}</td>
                    <td>{formatDate(bid.bid_time)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No bids yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Create Auction Component
function CreateAuction() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    starting_price: '',
    end_date: ''
  });
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  useEffect(() => {
    // Fetch categories
    const fetchCategories = async () => {
      try {
        const data = await fetchAPI('/categories');
        setCategories(data);
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, category_id: data[0].category_id }));
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
        setError('Failed to load categories');
      }
    };
    
    fetchCategories();
    
    // Set default end date (7 days from now)
    const defaultEndDate = new Date();
    defaultEndDate.setDate(defaultEndDate.getDate() + 7);
    setFormData(prev => ({ 
      ...prev, 
      end_date: defaultEndDate.toISOString().split('T')[0] + 'T' + new Date().toTimeString().slice(0, 8)
    }));
  }, []);
  
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      await fetchAPI('/items', {
        method: 'POST',
        body: JSON.stringify(formData)
      });
      
      setSuccess('Auction created successfully!');
      // Reset form
      setFormData({
        title: '',
        description: '',
        category_id: categories.length > 0 ? categories[0].category_id : '',
        starting_price: '',
        end_date: formData.end_date
      });
    } catch (err) {
      setError(err.message);
    }
  };
  
  return (
    <div className="create-auction">
      <h1>Create New Auction</h1>
      
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Description</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            rows="5"
          />
        </div>
        
        <div className="form-group">
          <label>Category</label>
          <select
            name="category_id"
            value={formData.category_id}
            onChange={handleChange}
            required
          >
            {categories.map(category => (
              <option key={category.category_id} value={category.category_id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>Starting Price ($)</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            name="starting_price"
            value={formData.starting_price}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="form-group">
          <label>End Date & Time</label>
          <input
            type="datetime-local"
            name="end_date"
            value={formData.end_date}
            onChange={handleChange}
            required
          />
        </div>
        
        <button type="submit">Create Auction</button>
      </form>
    </div>
  );
}