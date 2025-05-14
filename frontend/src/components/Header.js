import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';
import NoteNovaLogo from './NoteNovaLogo';
import UserMenu from './UserMenu';
import { useAuth } from '../contexts/AuthContext';

const Header = () => {
  const { isAuthenticated } = useAuth();
  
  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <NoteNovaLogo />
          <h1 className="logo-text">NoteNova</h1>
        </Link>
        <nav className="main-nav">
          <ul>
            <li>
              <Link to="/" className="nav-link">Home</Link>
            </li>
            {isAuthenticated && (
              <li>
                <UserMenu />
              </li>
            )}
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header; 