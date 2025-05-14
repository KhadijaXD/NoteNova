import React from 'react';
import PropTypes from 'prop-types';

const NoteNovaLogo = ({ size = 'default' }) => {
  // Determine width and height based on size prop
  let width, height;
  
  switch (size) {
    case 'small':
      width = 24;
      height = 24;
      break;
    case 'large':
      width = 64;
      height = 64;
      break;
    case 'default':
    default:
      width = 32;
      height = 32;
  }
  
  return (
    <div className="logo-icon">
      <svg 
        width={width} 
        height={height} 
        viewBox="0 0 32 32" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path 
          d="M16 2L4 6V24L16 30L28 24V6L16 2Z" 
          stroke="#9d4edd" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          fill="none" 
        />
        <path 
          d="M16 14L28 8" 
          stroke="#9d4edd" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        <path 
          d="M16 14L4 8" 
          stroke="#9d4edd" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        <path 
          d="M16 14V30" 
          stroke="#9d4edd" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round" 
        />
        <circle 
          cx="16" 
          cy="14" 
          r="4" 
          fill="#9d4edd" 
        />
      </svg>
    </div>
  );
};

NoteNovaLogo.propTypes = {
  size: PropTypes.oneOf(['small', 'default', 'large'])
};

export default NoteNovaLogo; 