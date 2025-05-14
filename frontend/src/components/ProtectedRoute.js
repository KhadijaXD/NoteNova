import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Loading spinner component
const Spinner = () => (
  <div className="loading-spinner-container">
    <div className="loading-spinner"></div>
  </div>
);

/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 */
const ProtectedRoute = () => {
  const { isAuthenticated, loading, user } = useAuth();
  
  console.log("ProtectedRoute - Authentication status:", { 
    isAuthenticated, 
    loading,
    user: user ? `User: ${user.email}` : 'No user'
  });
  
  // Show loading spinner while checking authentication
  if (loading) {
    console.log("ProtectedRoute - Still loading, showing spinner");
    return <Spinner />;
  }
  
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    console.log("ProtectedRoute - Not authenticated, redirecting to login");
    return <Navigate to="/login" />;
  }
  
  // Render children routes if authenticated
  console.log("ProtectedRoute - Authenticated, rendering content");
  return <Outlet />;
};

export default ProtectedRoute; 