import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Local storage keys
const AUTH_TOKEN_KEY = 'auth_token';
const USER_INFO_KEY = 'user_info';

// Create axios instance
const api = axios.create({
  baseURL: `${API_URL}/api/auth`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Register a new user account
 * @param {string} username - The username
 * @param {string} email - The email address
 * @param {string} password - The password
 * @returns {Promise} - The API response with token and user info
 */
const register = async (username, email, password) => {
  try {
    const response = await api.post('/register', {
      username,
      email,
      password,
    });
    
    if (response.data && response.data.token) {
      // Store token and user info
      localStorage.setItem(AUTH_TOKEN_KEY, response.data.token);
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(response.data.user));
      return response.data;
    } else {
      throw new Error('Registration response missing token or user data');
    }
  } catch (error) {
    console.error('Registration error:', error);
    if (error.response && error.response.data) {
      throw error;
    } else {
      throw new Error('Registration failed. Please try again later.');
    }
  }
};

/**
 * Login with username/email and password
 * @param {string} email - The email address
 * @param {string} password - The password
 * @returns {Promise} - The API response with token and user info
 */
const login = async (email, password) => {
  try {
    const response = await api.post('/login', {
      email,
      password
    });
    
    // Handle login success
    if (response.data && response.data.token) {
      // Store token and user info
      localStorage.setItem(AUTH_TOKEN_KEY, response.data.token);
      localStorage.setItem(USER_INFO_KEY, JSON.stringify(response.data.user));
      return response.data;
    } else {
      throw new Error('Login response missing token or user data');
    }
  } catch (error) {
    console.error('Login error:', error);
    if (error.response && error.response.data) {
      throw error;
    } else {
      throw new Error('Login failed. Please try again later.');
    }
  }
};

/**
 * Log out the current user
 */
const logout = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_INFO_KEY);
};

/**
 * Get the current user's info
 * @returns {Object|null} - The user info or null if not logged in
 */
const getCurrentUser = () => {
  const userInfo = localStorage.getItem(USER_INFO_KEY);
  return userInfo ? JSON.parse(userInfo) : null;
};

/**
 * Check if user is logged in
 * @returns {boolean} - True if logged in, false otherwise
 */
const isLoggedIn = () => {
  return !!localStorage.getItem(AUTH_TOKEN_KEY);
};

/**
 * Get the current token
 * @returns {string|null} - The token or null if not logged in
 */
const getToken = () => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

/**
 * Verify the current token and get user info, refresh if needed
 * @returns {Promise<boolean>} - True if token is valid, false otherwise
 */
const verifyToken = async () => {
  try {
    console.log("Verifying token...");
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    
    if (!token) {
      console.log("No token found in localStorage");
      return false;
    }
    
    try {
      const response = await api.get('/verify');
      console.log("Token verification response:", response.data);
      
      if (response.data.user) {
        console.log("Token valid, user data received:", response.data.user);
        localStorage.setItem(USER_INFO_KEY, JSON.stringify(response.data.user));
        return true;
      }
      
      console.log("Token verification failed - no user data");
      return false;
    } catch (verifyError) {
      console.error('Token verification error:', verifyError);
      
      // Handle expired token by logging out
      logout();
      return false;
    }
  } catch (error) {
    console.error('Token verification general error:', error);
    logout();
    return false;
  }
};

const authService = {
  register,
  login,
  logout,
  getCurrentUser,
  isLoggedIn,
  getToken,
  verifyToken,
  api, // Export the configured axios instance for other services to use
};

export default authService; 