import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Flashcards.css';

// Services
import dbService from '../services/db';
import apiService from '../services/api';

const Flashcards = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [flashcards, setFlashcards] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // Load note on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Get the note from IndexedDB
        const noteData = await dbService.getNoteById(id);
        
        if (!noteData) {
          setError('Note not found');
          setIsLoading(false);
          return;
        }
        
        setNote(noteData);
        
        // Generate flashcards
        try {
          const flashcardsData = await apiService.generateFlashcards(id);
          setFlashcards(flashcardsData);
        } catch (flashcardsError) {
          console.error('Error generating flashcards:', flashcardsError);
          setError('Failed to generate flashcards. Please ensure your note has enough content.');
        }
      } catch (err) {
        console.error('Error loading note:', err);
        setError('Failed to load note data');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [id]);

  // Handle downloading flashcards
  const handleDownload = () => {
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

  // Navigate to next card
  const nextCard = () => {
    if (!flashcards || !flashcards.notes.length) return;
    
    setShowAnswer(false);
    
    if (activeCardIndex < flashcards.notes.length - 1) {
      setActiveCardIndex(activeCardIndex + 1);
    } else {
      setActiveCardIndex(0); // Loop back to the first card
    }
  };

  // Navigate to previous card
  const prevCard = () => {
    if (!flashcards || !flashcards.notes.length) return;
    
    setShowAnswer(false);
    
    if (activeCardIndex > 0) {
      setActiveCardIndex(activeCardIndex - 1);
    } else {
      setActiveCardIndex(flashcards.notes.length - 1); // Loop to the last card
    }
  };

  // Toggle showing the answer
  const toggleAnswer = () => {
    setShowAnswer(!showAnswer);
  };

  if (isLoading) {
    return <div className="loading-container">Generating flashcards...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button className="btn" onClick={() => navigate(`/note/${id}`)}>
          Back to Note
        </button>
      </div>
    );
  }

  if (!flashcards || !flashcards.notes || flashcards.notes.length === 0) {
    return (
      <div className="error-container">
        <h2>No Flashcards Available</h2>
        <p>This note doesn't have enough content to generate meaningful flashcards.</p>
        <button className="btn" onClick={() => navigate(`/note/${id}`)}>
          Back to Note
        </button>
      </div>
    );
  }

  const currentCard = flashcards.notes[activeCardIndex];

  return (
    <div className="flashcards-page">
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
          onClick={() => navigate(`/note/${id}`)}
          aria-label="Back to Note"
        >
          ←
        </button>
      </div>
      <div className="flashcards-header">
        <h1>Flashcards for: {note.title}</h1>
        <p className="card-counter">
          Card {activeCardIndex + 1} of {flashcards.notes.length}
        </p>
      </div>
      <div className="flashcard-container">
        <div className="flashcard">
          <div className="flashcard-inner">
            <div className="flashcard-front">
              <h3>Question</h3>
              <div dangerouslySetInnerHTML={{ __html: currentCard.fields.Front }} />
              <button className="btn flip-btn" style={{ marginTop: '0.5rem' }} onClick={toggleAnswer}>
                Show Answer
              </button>
            </div>
            {showAnswer && (
              <div className="flashcard-back">
                <h3>Answer</h3>
                <div className="flashcard-answer" dangerouslySetInnerHTML={{ __html: currentCard.fields.Back }} />
              </div>
            )}
          </div>
        </div>
        <div className="flashcard-controls">
          <button className="btn btn-secondary" onClick={prevCard}>
            Previous
          </button>
          <button className="btn" onClick={nextCard}>
            Next
          </button>
        </div>
      </div>
      <div className="flashcards-actions" style={{ justifyContent: 'center' }}>
        <button
          className="btn btn-outline"
          onClick={handleDownload}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 500,
            color: '#fff',
          }}
        >
          <span style={{ fontSize: '1.3rem', lineHeight: 1, color: '#fff' }}>⭳</span>
          <span style={{ fontSize: '1rem', color: '#fff', fontWeight: 400 }}>Export Anki JSON file</span>
        </button>
      </div>
    </div>
  );
};

export default Flashcards; 