import React, { createContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/auth';

// Create context
export const AuthContext = createContext();

// Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Initialize authentication state
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Check if user is already logged in
        if (authService.isLoggedIn()) {
          // Verify token validity and get user data
          const isValid = await authService.verifyToken();
          if (isValid) {
            setUser(authService.getCurrentUser());
          } else {
            // If token is invalid, log out
            handleLogout();
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Login handler
  const handleLogin = async (email, password) => {
    try {
      console.log("AuthContext - Login attempt:", email);
      const response = await authService.login(email, password);
      
      if (response && response.token) {
        console.log("AuthContext - Login successful, setting user");
        setUser(response.user);
        
        // Force navigation to home page
        setTimeout(() => {
          console.log("AuthContext - Navigating to home page");
          navigate('/', { replace: true });
        }, 100);
        
        return { success: true };
      }
      return { success: false, error: 'Login failed' };
    } catch (err) {
      console.error('Login error:', err);
      return { 
        success: false, 
        error: err.response?.data?.message || 'Login failed. Please try again.' 
      };
    }
  };

  // Register handler
  const handleRegister = async (username, email, password) => {
    try {
      const response = await authService.register(username, email, password);
      if (response && response.token) {
        setUser(response.user);
        return { success: true };
      }
      return { success: false, error: 'Registration failed' };
    } catch (err) {
      console.error('Registration error:', err);
      return { 
        success: false, 
        error: err.response?.data?.message || 'Registration failed. Please try again.'
      };
    }
  };

  // Logout handler
  const handleLogout = () => {
    authService.logout();
    setUser(null);
    navigate('/login');
  };

  // Context value
  const contextValue = {
    user,
    loading,
    isAuthenticated: !!user,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook for using auth context
export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 