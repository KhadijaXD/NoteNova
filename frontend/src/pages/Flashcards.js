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
        
        // Use existing flashcards instead of generating new ones
        try {
          // First try to get flashcards from the note itself
          if (noteData.flashcards && noteData.flashcards.notes && noteData.flashcards.notes.length > 0) {
            console.log('Using flashcards from note data');
            setFlashcards(noteData.flashcards);
          } else {
            // If not in the note, fetch from API with noGenerate flag
            console.log('Fetching flashcards from API');
            const flashcardsData = await apiService.getFlashcards(id);
            if (flashcardsData && flashcardsData.notes && flashcardsData.notes.length > 0) {
              setFlashcards(flashcardsData);
            } else {
              setError('No flashcards found for this note. Please generate flashcards first.');
            }
          }
        } catch (flashcardsError) {
          console.error('Error getting flashcards:', flashcardsError);
          setError('Failed to retrieve flashcards. Please go back and try generating them again.');
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
    }
  };

  // Navigate to previous card
  const prevCard = () => {
    if (!flashcards || !flashcards.notes.length) return;
    
    setShowAnswer(false);
    
    if (activeCardIndex > 0) {
      setActiveCardIndex(activeCardIndex - 1);
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
        <div className="error-actions">
          <button className="btn" onClick={() => navigate(`/note/${id}`)}>
            Back to Note
          </button>
          {error.includes('No flashcards found') && (
            <button className="btn btn-primary" onClick={() => navigate(`/note/${id}`)}>
              Generate Flashcards
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!flashcards || !flashcards.notes || flashcards.notes.length === 0) {
    return (
      <div className="flashcards-page">
        <div className="navigation-header">
          <button
            onClick={() => navigate(`/note/${id}`)}
            aria-label="Back to Note"
          >
            ←
          </button>
        </div>
        
        <div className="no-flashcards-container">
          <h2>No Flashcards Available</h2>
          <p>This note doesn't have enough content to generate meaningful flashcards.</p>
          
          <div className="no-flashcards-actions">
            <button 
              className="btn" 
              onClick={() => navigate(`/note/${id}`)}
            >
              Back to Note
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => navigate(`/note/${id}`)}
            >
              Generate Flashcards
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Clean up question and answer text
  const currentCard = flashcards.notes[activeCardIndex];
  let questionText = currentCard.fields.Front;
  let answerText = currentCard.fields.Back;
  
  // Remove "Question:" prefix if present
  if (questionText.includes("Question:")) {
    questionText = questionText.split("Question:")[1].split("Answer:")[0].trim();
  }
  
  // Remove "Answer:" prefix if present
  if (answerText.includes("Answer:")) {
    answerText = answerText.split("Answer:")[1].trim();
  }

  return (
    <div className="flashcards-page">
      <div className="navigation-header">
        <button
          onClick={() => navigate(`/note/${id}`)}
          aria-label="Back to Note"
        >
          ←
        </button>
      </div>
      <div className="flashcards-header">
        <h1>{note.title}</h1>
      </div>
      <div className="flashcard-container">
        <div className="flashcard">
          <div className="flashcard-inner">
            <div className="flashcard-front">
              <h3>Question</h3>
              <div className="flashcard-question">
                {questionText}
              </div>
              <div className="show-answer-container">
                <button 
                  className="flip-btn" 
                  onClick={toggleAnswer}
                >
                  Show Answer
                </button>
              </div>
            </div>
            {showAnswer && (
              <div className="flashcard-back">
                <h3>Answer</h3>
                <div className="flashcard-answer">
                  {answerText}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flashcard-controls">
          <button 
            onClick={prevCard} 
            disabled={activeCardIndex === 0}
            className={activeCardIndex === 0 ? "disabled" : ""}
          >
            ←
          </button>
          <div className="card-counter">
            <span>{activeCardIndex + 1}</span>
            <span style={{ margin: '0 4px', opacity: '0.7' }}>/</span>
            <span>{flashcards.notes.length}</span>
          </div>
          <button 
            onClick={nextCard}
            disabled={activeCardIndex === flashcards.notes.length - 1}
            className={activeCardIndex === flashcards.notes.length - 1 ? "disabled" : ""}
          >
            →
          </button>
        </div>
      </div>
      <div className="flashcards-actions">
        <button onClick={handleDownload}>
          <span style={{ fontSize: '1.2rem' }}>⭳</span>
          Export Anki JSON file
        </button>
      </div>
    </div>
  );
};

export default Flashcards; 