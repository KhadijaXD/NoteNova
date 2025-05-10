import React from 'react';
import './Footer.css';

const Footer = () => {
  const year = new Date().getFullYear();
  
  return (
    <footer className="footer">
      <div className="footer-container">
        <p className="copyright">
          &copy; {year} Smart Note Organizer. All rights reserved.
        </p>
        <div className="footer-links">
          <a 
            href="https://github.com/your-username/smart-note-organizer" 
            target="_blank" 
            rel="noopener noreferrer"
            className="footer-link"
          >
            GitHub
          </a>
          <span className="divider">|</span>
          <a 
            href="#privacy" 
            className="footer-link"
          >
            Privacy Policy
          </a>
          <span className="divider">|</span>
          <a 
            href="#terms" 
            className="footer-link"
          >
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 