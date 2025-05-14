import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './Note.css';
import { motion, AnimatePresence } from 'framer-motion';

// Services
import dbService from '../services/db';
import apiService from '../services/api';
import authService from '../services/auth';

// Context
import { useToast } from '../contexts/ToastContext';

const Note = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [note, setNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedContent, setEditedContent] = useState('');
  const [editedTags, setEditedTags] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flashcards, setFlashcards] = useState(null);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);
  const [ollamaStatusNotified, setOllamaStatusNotified] = useState(false);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const timeoutRef = useRef(null);

  // Quill editor modules/formats
  const modules = {
    toolbar: [
      [{ 'font': [] }, { 'size': ['small', false, 'large', 'huge'] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'script': 'sub' }, { 'script': 'super' }],
      [{ 'header': 1 }, { 'header': 2 }, 'blockquote', 'code-block'],
      [{ 'list': 'ordered' }, { 'list': 'bullet' }, { 'indent': '-1' }, { 'indent': '+1' }],
      ['link', 'image', 'video'],
      ['clean']
    ],
  };

  const formats = [
    'font', 'size',
    'bold', 'italic', 'underline', 'strike',
    'color', 'background',
    'script',
    'header', 'blockquote', 'code-block',
    'indent', 'list',
    'link', 'image', 'video'
  ];

  // Load note on component mount
  useEffect(() => {
    const loadNote = async () => {
      try {
        setIsLoading(true);
        const noteData = await dbService.getNoteById(id);
        
        if (!noteData) {
          setError('Note not found');
          return;
        }
        
        setNote(noteData);
        setEditedTitle(noteData.title);
        setEditedContent(noteData.content);
        setEditedTags(noteData.tags ? noteData.tags.join(', ') : '');
        
        // Also load flashcards if they exist in the note
        if (noteData.flashcards && noteData.flashcards.notes && noteData.flashcards.notes.length > 0) {
          console.log('Setting flashcards from note data');
          setFlashcards(noteData.flashcards);
        } else {
          // Only try to load from API if we don't already have them
          try {
            // Just check if flashcards exist without generating
            const flashcardsData = await apiService.getFlashcards(id);
            if (flashcardsData && flashcardsData.notes && flashcardsData.notes.length > 0) {
              console.log('Setting flashcards from API');
              setFlashcards(flashcardsData);
              
              // Also update the note with the flashcards
              const updatedNote = { ...noteData, flashcards: flashcardsData };
              setNote(updatedNote);
              
              // Update note with flashcards in local DB
              await dbService.updateNote(updatedNote);
            }
          } catch (flashcardError) {
            console.log('No existing flashcards found, skipping');
            // Don't throw an error here, just continue without flashcards
          }
        }
      } catch (err) {
        console.error('Error loading note:', err);
        setError('Failed to load note');
      } finally {
        setIsLoading(false);
      }
    };

    loadNote();
  }, [id]);

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this note? This action cannot be undone.')) {
      try {
        await dbService.deleteNote(id);
        
        // Also delete from server if it exists there
        try {
          await apiService.deleteNote(id);
        } catch (apiError) {
          console.error('Error deleting note from server:', apiError);
          // Continue even if server delete fails
        }
        
        navigate('/');
      } catch (err) {
        console.error('Error deleting note:', err);
        setError('Failed to delete note');
      }
    }
  };

  const handleSave = async () => {
    try {
      const updatedNote = {
        ...note,
        title: editedTitle,
        content: editedContent,
        tags: editedTags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
        updatedAt: new Date().toISOString()
      };
      
      await dbService.updateNote(updatedNote);
      
      // Also update on server if possible
      try {
        await apiService.updateNote(id, updatedNote);
      } catch (apiError) {
        console.error('Error updating note on server:', apiError);
        // Continue even if server update fails
      }
      
      setNote(updatedNote);
      setIsEditing(false);
    } catch (err) {
      console.error('Error saving note:', err);
      setError('Failed to save changes');
    }
  };

  // Add this function to check authentication before AI operations
  const verifyAuthBeforeOperation = async () => {
    try {
      // Verify token is still valid
      const isValid = await authService.verifyToken();
      
      if (!isValid) {
        addToast('Your session has expired. Please log in again.', 'error', 5000);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Auth verification error:', error);
      addToast('Authentication error. Please log in again.', 'error', 5000);
      return false;
    }
  };

  const handleGenerateFlashcards = async () => {
    try {
      // Check if the note has enough content
      if (!note.content || note.content.length < 100) {
        addToast('Note content is too short for flashcard generation. Please add more content.', 'error', 5000);
        return;
      }
      
      // Verify authentication before proceeding
      const isAuthenticated = await verifyAuthBeforeOperation();
      if (!isAuthenticated) return;
      
      setFlashcardsLoading(true);
      addToast('Generating flashcards with Llama 3.3 AI...', 'info', 2000);
      
      const result = await apiService.generateFlashcards(id);
      
      if (result && result.success === false) {
        // Handle server error with specific message
        addToast(result.message || 'Failed to generate flashcards. Please try again later.', 'error', 5000);
        setFlashcardsLoading(false);
        return;
      }
      
      // If we have flashcards data directly
      if (result && result.flashcards) {
        setFlashcards(result.flashcards);
        
        // Update note state with the flashcards
        const updatedNote = { ...note, flashcards: result.flashcards };
        setNote(updatedNote);
        
        // Save to database
        await dbService.updateNote(updatedNote);
        
        addToast('Flashcards generated successfully with Llama 3.3 AI!', 'success', 3000);
        setFlashcardsLoading(false);
        return;
      }
      
      // If result is the flashcards object directly
      if (result && result.notes) {
        setFlashcards(result);
        
        // Update note state with the flashcards
        const updatedNote = { ...note, flashcards: result };
        setNote(updatedNote);
        
        // Save to database
        await dbService.updateNote(updatedNote);
        
        addToast('Flashcards generated successfully with Llama 3.3 AI!', 'success', 3000);
        setFlashcardsLoading(false);
        return;
      }
      
      // Handle unknown response format
      console.error('Unexpected response format from flashcard generation:', result);
      addToast('Received an unexpected response format. Please try again.', 'error', 5000);
    } catch (error) {
      console.error('Error generating flashcards:', error);
      
      // Extract the specific error message if available
      let errorMessage = 'Failed to generate flashcards. Please try again later.';
      
      if (error.message) {
        if (error.message.includes('AI service error')) {
          errorMessage = 'AI service is currently unavailable. Please try again later.';
        } else if (error.message.includes('Content too short')) {
          errorMessage = 'Your note needs more content for flashcard generation.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'AI request timed out. The server may be busy, please try again later.';
        } else if (error.message.includes('token') || error.message.includes('authentication')) {
          errorMessage = 'Authentication issue. Please try logging out and back in.';
        } else {
          errorMessage = `Failed to generate flashcards: ${error.message}`;
        }
      }
      
      addToast(errorMessage, 'error', 5000);
    } finally {
      setFlashcardsLoading(false);
    }
  };

  // Handle showing or navigating to flashcards
  const handleFlashcards = async () => {
    if (note.flashcards && note.flashcards.notes && note.flashcards.notes.length > 0) {
      // If flashcards exist, navigate to them
      navigate(`/note/${id}/flashcards`);
    } else {
      // If no flashcards, generate them first
      await handleGenerateFlashcards();
      // If generation was successful, navigate
      if (note.flashcards && note.flashcards.notes && note.flashcards.notes.length > 0) {
        navigate(`/note/${id}/flashcards`);
      }
    }
  };

  const handleRegenerateSummary = async () => {
    try {
      // Check if the note has enough content
      if (!note.content || note.content.length < 100) {
        addToast('Note content is too short for summary generation. Please add more content.', 'error', 5000);
        return;
      }
      
      // Verify authentication before proceeding
      const isAuthenticated = await verifyAuthBeforeOperation();
      if (!isAuthenticated) return;
      
      setIsRegeneratingSummary(true);
      addToast('Regenerating summary with Llama 3.3 AI...', 'info', 2000);
      
      const result = await apiService.regenerateSummary(id);
      
      if (result && result.note) {
        // Update note state with the new summary
        setNote(result.note);
        
        // Save to database
        await dbService.updateNote(result.note);
        
        addToast('Summary regenerated successfully with Llama 3.3 AI!', 'success', 3000);
      } else {
        // Handle unknown response format
        console.error('Unexpected response format from summary regeneration:', result);
        addToast('Received an unexpected response. Please try again.', 'error', 5000);
      }
    } catch (error) {
      console.error('Error regenerating summary:', error);
      
      // Extract the specific error message if available
      let errorMessage = 'Failed to regenerate summary. Please try again later.';
      
      if (error.message) {
        if (error.message.includes('AI service error')) {
          errorMessage = 'AI service is currently unavailable. Please try again later.';
        } else if (error.message.includes('Content too short')) {
          errorMessage = 'Your note needs more content for summary generation.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'AI request timed out. The server may be busy, please try again later.';
        } else if (error.message.includes('token') || error.message.includes('authentication')) {
          errorMessage = 'Authentication issue. Please try logging out and back in.';
        } else {
          errorMessage = `Failed to regenerate summary: ${error.message}`;
        }
      }
      
      addToast(errorMessage, 'error', 5000);
    } finally {
      setIsRegeneratingSummary(false);
    }
  };

  const handleDownloadFlashcards = () => {
    // Check if we have flashcards to download
    if (!note.flashcards || !note.flashcards.notes || note.flashcards.notes.length === 0) {
      addToast('No flashcards available to download', 'error', 3000);
      return;
    }
    
    // Format the data for Anki import (basic cards format)
    const formattedFlashcards = {
      notes: note.flashcards.notes.map((card) => ({
        fields: {
          Front: card.fields.Front,
          Back: card.fields.Back
        },
        tags: note.tags || []
      }))
    };
    
    // Convert to JSON and create download
    const jsonData = JSON.stringify(formattedFlashcards, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Create an anchor element and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = `${note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_flashcards.json`;
    document.body.appendChild(a);
    a.click();
    
    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addToast('Flashcards downloaded successfully! Import them into Anki.', 'success', 3000);
  };

  // Format date for display
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
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      console.error('Error formatting date:', e, 'Date string was:', dateString);
      return 'Unknown';
    }
  };

  // Animation variants with longer exit duration
  const containerVariants = {
    hidden: { 
      opacity: 0,
      transition: { duration: 0.1 }
    },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.05,
        duration: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { 
      x: 20, 
      opacity: 0,
      transition: { duration: 0.1 }
    },
    visible: {
      x: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 350,
        damping: 25
      }
    }
  };

  const handleMenuEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setShowOptions(true);
  };

  const handleMenuLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setShowOptions(false);
    }, 600); // 600ms delay before hiding menu
  };

  // Clean up the timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return <div className="loading-container">Loading note...</div>;
  }

  if (error && typeof error === 'string') {
    return <div className="error-container">{error}</div>;
  }

  if (!note) {
    return <div className="error-container">Note not found</div>;
  }

  return (
    <div className="note-page">
      <div className="navigation-header">
        <button
          className="icon-btn back-btn"
          style={{
            background: 'none',
            border: 'none',
            color: '#a259ec',
            fontSize: '2rem',
            cursor: 'pointer',
            marginBottom: '1rem'
          }}
          onClick={() => navigate('/')}
          aria-label="Back to Notes"
        >
          ←
        </button>
      </div>
      {isEditing ? (
        <div className="note-edit-content">
          <div className="form-group">
            <label htmlFor="title" className="form-label">Title</label>
            <input
              type="text"
              id="title"
              className="form-control"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="tags" className="form-label">Tags (comma separated)</label>
            <input
              type="text"
              id="tags"
              className="form-control"
              value={editedTags}
              onChange={(e) => setEditedTags(e.target.value)}
              placeholder="Enter tags separated by commas"
            />
          </div>
          <div className="form-group">
            <label htmlFor="content" className="form-label">Content</label>
            <div className="text-editor-container">
              <ReactQuill
                theme="snow"
                modules={modules}
                formats={formats}
                value={editedContent}
                onChange={setEditedContent}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="note-view-content">
          {/* Options Button and Menu */}
          <div className="options-menu-container">
            <div className="options-button">
              <div 
                className="options-dot"
                onMouseEnter={handleMenuEnter}
                onMouseLeave={handleMenuLeave}
              >⋮</div>
              
              <AnimatePresence>
                {showOptions && (
                  <motion.div 
                    className="slide-menu"
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    variants={containerVariants}
                    style={{ 
                      position: 'absolute', 
                      top: '0', 
                      right: '-245px',
                      width: '220px',
                      boxShadow: 'none',
                      background: 'transparent'
                    }}
                    onMouseEnter={handleMenuEnter}
                    onMouseLeave={handleMenuLeave}
                  >
                    <motion.button 
                      className="menu-action edit-action"
                      variants={itemVariants}
                      onClick={() => setIsEditing(true)}
                      style={{ 
                        position: 'absolute', 
                        top: '0', 
                        left: 0,
                        width: '220px', 
                        marginBottom: '10px'
                      }}
                    >
                      Edit Note
                    </motion.button>
                    
                    <motion.button 
                      className="menu-action study-action"
                      variants={itemVariants}
                      onClick={handleFlashcards}
                      style={{ 
                        position: 'absolute', 
                        top: '55px', 
                        left: 0,
                        width: '220px', 
                        marginBottom: '10px'
                      }}
                    >
                      Study Flashcards
                    </motion.button>
                    
                    <motion.button 
                      className="menu-action delete-action"
                      variants={itemVariants}
                      onClick={handleDelete}
                      style={{ 
                        position: 'absolute', 
                        top: '110px', 
                        left: 0,
                        width: '220px'
                      }}
                    >
                      Delete Note
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <h1 className="note-title">{note.title}</h1>
          <div className="note-date">
            <span>Created: {formatDate(note.created_at)}</span>
            <span>Updated: {formatDate(note.updated_at)}</span>
          </div>
          
          {note.tags && note.tags.length > 0 && (
            <div className="note-tags">
              {note.tags.map((tag, index) => (
                <span key={index} className="tag">{tag}</span>
              ))}
            </div>
          )}
          
          {note.summary && (
            <div className="note-summary-box">
              <div className="note-summary-header">
                <h3>Summary</h3>
                <button 
                  className="btn btn-small" 
                  onClick={handleRegenerateSummary}
                  disabled={isRegeneratingSummary}
                >
                  {isRegeneratingSummary ? 'Regenerating...' : 'Regenerate Summary'}
                </button>
              </div>
              <div dangerouslySetInnerHTML={{ __html: note.summary }} />
            </div>
          )}
          <div className="note-content">
            <div className="rich-text-content" dangerouslySetInnerHTML={{ __html: note.content }} />
          </div>
        </div>
      )}
      
      {/* Bottom actions bar for edit mode */}
      {isEditing && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '3rem',
          gap: '1rem',
        }}>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
            <button className="btn btn-secondary mr-2" onClick={() => setIsEditing(false)}>
              Cancel
            </button>
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <button className="btn" onClick={handleSave}>
              Save Changes
            </button>
          </div>
          <div style={{ flex: 1 }}></div>
        </div>
      )}
    </div>
  );
};

export default Note; 