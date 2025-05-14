import React from 'react';
import './TagList.css';

const TagList = ({ tags, selectedTags, onTagSelect }) => {
  // Sort tags by count (popularity)
  const sortedTags = [...tags].sort((a, b) => b.count - a.count);
  
  // Function to handle clearing all selected tags
  const clearAllTags = () => {
    // Reset all selected tags by calling onTagSelect for each selected tag
    selectedTags.forEach(tag => onTagSelect(tag));
  };

  return (
    <div className="tag-list">
      <div className="tag-list-header">
        <h3 className="tag-list-title">Filter by Tags</h3>
        {selectedTags.length > 0 && (
          <button 
            className="clear-tags-btn prominent"
            onClick={clearAllTags}
          >
            Clear All Filters
          </button>
        )}
      </div>
      
      {tags.length === 0 ? (
        <p className="no-tags">No tags available yet. Upload notes to generate tags.</p>
      ) : (
        <>
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
          
          {selectedTags.length > 1 && (
            <div className="tag-filter-info">
              <small>Showing notes with all of the selected tags</small>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TagList; 