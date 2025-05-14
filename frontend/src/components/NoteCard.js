import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './NoteCard.css';
import dbService from '../services/db';
import apiService from '../services/api';

// Separate component for the Flashcards button with navigate hook
const FlashcardsButton = ({ note }) => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleFlashcardsClick = async (e) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      
      // First check if note already has flashcards
      if (note.flashcards && note.flashcards.notes && note.flashcards.notes.length > 0) {
        // Flashcards exist, navigate directly
        navigate(`/note/${note.id}/flashcards`);
        return;
      }
      
      // Then try to get existing flashcards from API without generating
      try {
        const flashcardsData = await apiService.getFlashcards(note.id);
        if (flashcardsData && flashcardsData.notes && flashcardsData.notes.length > 0) {
          // Save flashcards to note
          const updatedNote = { ...note, flashcards: flashcardsData };
          await dbService.updateNote(updatedNote);
          
          // Navigate to flashcards
          navigate(`/note/${note.id}/flashcards`);
          return;
        }
      } catch (error) {
        console.log('No existing flashcards found, will generate new ones');
      }
      
      // No flashcards found, generate them
      try {
        console.log('Generating flashcards for note:', note.id);
        const generatedFlashcards = await apiService.generateFlashcards(note.id);
        
        if (generatedFlashcards && generatedFlashcards.notes && generatedFlashcards.notes.length > 0) {
          // Save flashcards to note
          const updatedNote = { ...note, flashcards: generatedFlashcards };
          await dbService.updateNote(updatedNote);
          
          // Navigate to flashcards view
          navigate(`/note/${note.id}/flashcards`);
          return;
        } else {
          console.error('Failed to generate flashcards, result was invalid');
          // Navigate to note view as fallback if generation fails
          navigate(`/note/${note.id}`);
        }
      } catch (genError) {
        console.error('Error generating flashcards:', genError);
        // If generation fails, navigate to note view
        navigate(`/note/${note.id}`);
      }
    } catch (error) {
      console.error('Error handling flashcards navigation:', error);
      // Navigate to note as fallback
      navigate(`/note/${note.id}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button 
      onClick={handleFlashcardsClick} 
      className="btn btn-outline"
      disabled={isLoading}
    >
      {isLoading ? 'Generating...' : 'Flashcards'}
    </button>
  );
};

const NoteCard = ({ note }) => {
  const navigate = useNavigate();
  
  // Format date to readable format
  const formatDate = (dateString) => {
    if (!dateString) {
      return 'Unknown';
    }
    
    try {
      // First try standard date parsing
      let date = new Date(dateString);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        // If standard parsing fails, try to parse common SQLite date formats
        // SQLite datetime format: YYYY-MM-DD HH:MM:SS
        const sqliteDatePattern = /^(\d{4})-(\d{2})-(\d{2})\s(\d{2}):(\d{2}):(\d{2})$/;
        const match = dateString.match(sqliteDatePattern);
        
        if (match) {
          // Recreate date from matched components
          const [, year, month, day, hour, minute, second] = match;
          date = new Date(year, month - 1, day, hour, minute, second);
        } else {
          return 'Unknown';
        }
      }
      
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch (e) {
      console.error('Error formatting date:', e, 'Date string was:', dateString);
      return 'Unknown';
    }
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

  // Handle note deletion
  const handleDelete = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      try {
        await apiService.deleteNote(note.id);
        // Refresh the page or update the note list
        window.location.reload();
      } catch (error) {
        console.error('Error deleting note:', error);
        alert('Failed to delete note. Please try again.');
      }
    }
  };

  // Inline styles for delete button
  const deleteButtonStyle = {
    position: 'absolute',
    bottom: '15px',
    right: '15px',
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'rgba(138, 43, 226, 0.1)',
    border: '1px solid rgba(255, 100, 100, 0.4)',
    color: 'rgba(255, 100, 100, 0.8)',
    fontSize: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    zIndex: 5,
    opacity: 0.7,
    padding: 0,
    lineHeight: 1
  };

  return (
    <div className="note-card">
      <div className="note-info">
        <div className="note-card-header">
          <h3 className="note-title">{note.title}</h3>
          <div className="note-date">
            {note.created_at ? formatDate(note.created_at) : 'Unknown'}
          </div>
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
        <FlashcardsButton note={note} />
      </div>
      
      <button 
        style={deleteButtonStyle}
        onClick={handleDelete}
        title="Delete note"
        onMouseOver={(e) => {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.background = 'rgba(255, 100, 100, 0.2)';
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.color = 'rgb(255, 100, 100)';
          e.currentTarget.style.borderColor = 'rgba(255, 100, 100, 0.8)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.opacity = '0.7';
          e.currentTarget.style.background = 'rgba(138, 43, 226, 0.1)';
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.color = 'rgba(255, 100, 100, 0.8)';
          e.currentTarget.style.borderColor = 'rgba(255, 100, 100, 0.4)';
        }}
      >
        ×
      </button>
    </div>
  );
};

export default NoteCard; 