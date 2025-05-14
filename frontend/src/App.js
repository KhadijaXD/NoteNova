import React from 'react';
import { Routes, Route, BrowserRouter } from 'react-router-dom';
import './App.css';

// Pages
import Home from './pages/Home';
import Note from './pages/Note';
import NotFound from './pages/NotFound';
import Flashcards from './pages/Flashcards';
import Login from './pages/Login';
import Signup from './pages/Signup';

// Components
import Header from './components/Header';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';

// Context Providers
import { ToastProvider } from './contexts/ToastContext';
import { AuthProvider } from './contexts/AuthContext';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <div className="app-container">
            <Header />
            <main className="content">
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                
                {/* Protected routes */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/note/:id" element={<Note />} />
                  <Route path="/note/:id/flashcards" element={<Flashcards />} />
                </Route>
                
                {/* Not Found route */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
