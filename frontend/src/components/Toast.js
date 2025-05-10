import React, { useState, useEffect } from 'react';
import './Toast.css';

const Toast = ({ message, type = 'info', duration = 5000, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      if (onClose) onClose();
    }, 300); // Match the animation duration
  };

  return (
    <div className={`toast ${type} ${isExiting ? 'toast-exit' : ''}`} onClick={handleClose}>
      <div className="toast-content">
        <div className="toast-message">{message}</div>
        <button className="toast-close" onClick={handleClose}>×</button>
      </div>
    </div>
  );
};

export default Toast; 