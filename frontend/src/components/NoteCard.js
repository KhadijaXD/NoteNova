import React from 'react';
import { Link } from 'react-router-dom';
import './NoteCard.css';

const NoteCard = ({ note }) => {
  // Format date to readable format
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Truncate text to a certain length
  const truncateText = (text, maxLength = 150) => {
    if (!text || text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };
  
  // Strip HTML tags for display in the card
  const stripHtml = (html) => {
    if (!html) return '';
    return html.replace(/<\/?[^>]+(>|$)/g, '');
  };

  return (
    <div className="note-card">
      <div className="note-info">
        <div className="note-card-header">
          <h3 className="note-title">{note.title}</h3>
          <div className="note-date">{formatDate(note.updatedAt)}</div>
        </div>
        
        {note.tags && note.tags.length > 0 && (
          <div className="note-tags">
            {note.tags.map((tag, index) => (
              <span key={index} className="tag">{tag}</span>
            ))}
          </div>
        )}
      </div>
      
      <div className="note-content-section">
        {note.summary && (
          <div className="note-summary">
            <h4>Summary</h4>
            <p>{stripHtml(note.summary)}</p>
          </div>
        )}
        
        <div className="note-content-preview">
          <p>{stripHtml(note.content)}</p>
        </div>
      </div>
      
      <div className="note-actions">
        <Link to={`/note/${note.id}`} className="btn btn-primary">
          View Note
        </Link>
        <Link to={`/note/${note.id}/flashcards`} className="btn btn-outline">
          Flashcards
        </Link>
      </div>
    </div>
  );
};

export default NoteCard; 