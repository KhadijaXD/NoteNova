import React from 'react';
import './TagList.css';

const TagList = ({ tags, selectedTags, onTagSelect }) => {
  // Sort tags by count (popularity)
  const sortedTags = [...tags].sort((a, b) => b.count - a.count);

  return (
    <div className="tag-list">
      <h3 className="tag-list-title">Filter by Tags</h3>
      
      {tags.length === 0 ? (
        <p className="no-tags">No tags available yet. Upload notes to generate tags.</p>
      ) : (
        <div className="tags-container">
          {sortedTags.map((tag) => (
            <button
              key={tag.name}
              className={`tag-pill ${selectedTags.includes(tag.name) ? 'selected' : ''}`}
              onClick={() => onTagSelect(tag.name)}
            >
              {tag.name}
              <span className="tag-count">{tag.count}</span>
            </button>
          ))}
        </div>
      )}
      
      {selectedTags.length > 0 && (
        <button 
          className="clear-tags-btn"
          onClick={() => {
            // Reset all selected tags by calling onTagSelect for each selected tag
            selectedTags.forEach(tag => onTagSelect(tag));
          }}
        >
          Clear All Filters
        </button>
      )}
    </div>
  );
};

export default TagList; 