import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import './Note.css';

// Services
import dbService from '../services/db';
import apiService from '../services/api';

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

  const handleGenerateFlashcards = async () => {
    try {
      setIsGeneratingFlashcards(true);
      await apiService.generateFlashcards(id);
      // Navigate to the flashcards interface
      navigate(`/note/${id}/flashcards`);
    } catch (err) {
      console.error('Error generating flashcards:', err);
      if (!ollamaStatusNotified) {
        addToast('Failed to generate flashcards. Basic generation will be used instead of AI.', 'info', 5000);
        setOllamaStatusNotified(true);
      }
      setIsGeneratingFlashcards(false);
    }
  };

  // New handler for regenerating summaries
  const handleRegenerateSummary = async () => {
    try {
      setIsRegeneratingSummary(true);
      
      const response = await apiService.regenerateSummary(id);
      
      // Update the note in state and in IndexedDB
      if (response && response.note) {
        setNote(response.note);
        await dbService.updateNote(response.note);
        
        // Check the message to see if Llama was used
        if (response.message && response.message.includes('basic extraction') && !ollamaStatusNotified) {
          // Show a toast notification that Ollama is not running
          addToast('Summary was generated using basic extraction. To use AI-powered summaries, install Ollama following the instructions in LLAMA_SETUP.md.', 'info', 8000);
          setOllamaStatusNotified(true);
        } else {
          // Show success toast
          addToast('Summary regenerated successfully!', 'success', 3000);
        }
      }
      setIsRegeneratingSummary(false);
    } catch (err) {
      console.error('Error regenerating summary:', err);
      // Show error toast instead of redirecting
      if (!ollamaStatusNotified) {
        addToast('Failed to regenerate summary. Llama AI is not available. Check the LLAMA_SETUP.md file for installation instructions.', 'error', 8000);
        setOllamaStatusNotified(true);
      }
      setIsRegeneratingSummary(false);
    }
  };

  const handleDownloadFlashcards = () => {
    if (!flashcards) return;
    
    const blob = new Blob([JSON.stringify(flashcards, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `flashcards-${note.title.replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

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
          <h1 className="note-title">{note.title}</h1>
          <div className="note-metadata">
            <div className="note-date">
              <span>Created: {new Date(note.createdAt).toLocaleString()}</span>
              <span>Updated: {new Date(note.updatedAt).toLocaleString()}</span>
            </div>
            {note.tags && note.tags.length > 0 && (
              <div className="note-tags">
                {note.tags.map((tag, index) => (
                  <span key={index} className="tag">{tag}</span>
                ))}
              </div>
            )}
          </div>
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
      {flashcards && flashcards.notes && flashcards.notes.length > 0 && (
        <div className="flashcards-section">
          <h2>Generated Flashcards</h2>
          <p>Generated {flashcards.notes.length} flashcards. Download them to import into Anki.</p>
          <div className="flashcards-actions">
            <button className="btn" onClick={handleDownloadFlashcards}>
              Download Flashcards
            </button>
            <button className="btn btn-primary" onClick={() => navigate(`/note/${id}/flashcards`)}>
              View Flashcards
            </button>
          </div>
          <div className="flashcards-preview">
            <h3>Preview</h3>
            {flashcards.notes.slice(0, 3).map((card, index) => (
              <div key={index} className="flashcard-preview-item">
                <div className="flashcard-front">
                  <strong>Front:</strong> {card.fields.Front}
                </div>
                <div className="flashcard-back">
                  <strong>Back:</strong> {card.fields.Back}
                </div>
              </div>
            ))}
            {flashcards.notes.length > 3 && (
              <p className="flashcards-more">...and {flashcards.notes.length - 3} more</p>
            )}
          </div>
        </div>
      )}
      {/* Bottom actions bar */}
      <div className="note-bottom-actions" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '3rem',
        gap: '1rem',
      }}>
        {isEditing ? (
          <>
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
          </>
        ) : (
          <>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
              <button className="btn btn-secondary mr-2" onClick={() => setIsEditing(true)}>
                Edit Note
              </button>
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              <button className="btn btn-outline mr-2" onClick={handleGenerateFlashcards}>
                Flashcards
              </button>
              {flashcards && flashcards.notes && flashcards.notes.length > 0 && (
                <button className="btn btn-primary" onClick={() => navigate(`/note/${id}/flashcards`)}>
                  View Flashcards
                </button>
              )}
            </div>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={handleDelete}>
                Delete Note
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Note; 