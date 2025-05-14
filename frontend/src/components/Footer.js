import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-container">
        <p className="copyright">
          Developed by Khadija Rashid
        </p>
        <div className="footer-links">
          <a 
            href="https://github.com/KhadijaXD" 
            target="_blank" 
            rel="noopener noreferrer"
            className="footer-link"
          >
            GitHub
          </a>
          <span className="divider">|</span>
          <a 
            href="https://mail.google.com/mail/?view=cm&fs=1&to=khadijarashid1204@gmail.com" 
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Contact me
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 