import React, { useState } from 'react';
import './SearchBar.css';

const SearchBar = ({ onSearch }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query);
    }
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    
    // If query is emptied, reset search
    if (!e.target.value.trim()) {
      onSearch('');
    }
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className="search-bar">
      <form onSubmit={handleSubmit}>
        <div className="search-input-container">
          <div className="search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <input
            type="text"
            className="search-input"
            placeholder="Search notes by title, content, or tags..."
            value={query}
            onChange={handleInputChange}
          />
          {query && (
            <button 
              type="button" 
              className="clear-button"
              onClick={handleClear}
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        <button type="submit" className="search-button">
          Search
        </button>
      </form>
    </div>
  );
};

export default SearchBar; 