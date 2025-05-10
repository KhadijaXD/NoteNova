import React from 'react';
import { Link } from 'react-router-dom';
import './Header.css';

const Header = () => {
  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 2L4 6V24L16 30L28 24V6L16 2Z" stroke="#9d4edd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M16 14L28 8" stroke="#9d4edd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 14L4 8" stroke="#9d4edd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 14V30" stroke="#9d4edd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="16" cy="14" r="4" fill="#9d4edd" />
            </svg>
          </div>
          <h1 className="logo-text">NoteNova</h1>
        </Link>
        <nav className="main-nav">
          <ul>
            <li>
              <Link to="/" className="nav-link">Home</Link>
            </li>
            <li>
              <a 
                href="https://github.com/your-username/smart-note-organizer" 
                target="_blank" 
                rel="noopener noreferrer"
                className="nav-link"
                style={{background: 'transparent'}}
              >
                GitHub
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
};

export default Header; 