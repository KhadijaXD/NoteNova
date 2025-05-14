import React, { useState, useEffect } from 'react';
import './Home.css';

// Components
import NoteCard from '../components/NoteCard';
import SearchBar from '../components/SearchBar';
import TagList from '../components/TagList';
import AddNoteModal from '../components/AddNoteModal';

// Services
import dbService from '../services/db';

const Home = () => {
  const [notes, setNotes] = useState([]);
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isAddNoteModalOpen, setIsAddNoteModalOpen] = useState(false);

  // Load notes and tags on component mount
  useEffect(() => {
    const loadData = async () => {
      console.log("Home - Component mounted, syncing with backend");
      try {
        setIsLoading(true);
        // Fetch notes from backend
        const notesData = await dbService.getAllNotes();
        // Overwrite local IndexedDB with backend notes
        await dbService.clearAllNotes();
        for (const note of notesData) {
          await dbService.saveNoteLocally(note);
        }
        const tagsData = await dbService.getAllTags();
        setNotes(notesData);
        setTags(tagsData);
      } catch (err) {
        console.error('Error loading data:', err);
        setError('Failed to load notes. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Handle search
  const handleSearch = async (query) => {
    setIsLoading(true);
    setSearchQuery(query);
    
    try {
      console.log("Searching for:", query);
      const results = await dbService.searchNotes(query, selectedTags);
      console.log("Search results:", results.length);
      setNotes(results);
      setError(null);
    } catch (err) {
      console.error('Error searching notes:', err);
      setError('Search failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle tag selection
  const handleTagSelect = async (tag) => {
    setIsLoading(true);
    
    try {
      let newSelectedTags;
      
      if (selectedTags.includes(tag)) {
        // If already selected, remove it
        newSelectedTags = selectedTags.filter(t => t !== tag);
      } else {
        // If not selected, add it
        newSelectedTags = [...selectedTags, tag];
      }
      
      setSelectedTags(newSelectedTags);
      console.log('Selected tags updated to:', newSelectedTags);
      
      // If no tags and no search query, load all notes
      if (newSelectedTags.length === 0 && !searchQuery) {
        console.log('No tags or search query, loading all notes');
        const notesData = await dbService.getAllNotes();
        setNotes(notesData);
      } else {
        // Otherwise search with the current filters
        console.log('Searching with filters:', { searchQuery, tags: newSelectedTags });
        const results = await dbService.searchNotes(searchQuery, newSelectedTags);
        setNotes(results);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error filtering by tags:', err);
      setError('Tag filtering failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle note added event
  const handleNoteAdded = async () => {
    try {
      // Refresh notes list
      const notesData = await dbService.getAllNotes();
      const tagsData = await dbService.getAllTags();
      
      setNotes(notesData);
      setTags(tagsData);
    } catch (err) {
      console.error('Error refreshing notes:', err);
    }
  };

  return (
    <div className="home-container">
      <div className="home-header">
        <h1>Your Smart Notes</h1>
        <p>Upload, organize, and find your academic notes with AI assistance</p>
      </div>
      
      <div className="action-buttons">
        <button 
          className="btn add-note-btn" 
          onClick={() => setIsAddNoteModalOpen(true)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Note
        </button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="search-section">
        <SearchBar onSearch={handleSearch} />
        <TagList tags={tags} selectedTags={selectedTags} onTagSelect={handleTagSelect} />
        
        {/* Search/Filter feedback */}
        {(searchQuery || selectedTags.length > 0) && (
          <div className="search-info">
            <p>
              {searchQuery && (
                <>
                  {notes.length === 0 ? (
                    <span>No results found for <strong>"{searchQuery}"</strong></span>
                  ) : (
                    <span>Showing {notes.length} {notes.length === 1 ? 'result' : 'results'} for <strong>"{searchQuery}"</strong></span>
                  )}
                </>
              )}
              
              {!searchQuery && selectedTags.length > 0 && (
                <span>
                  {notes.length === 0 ? 
                    'No notes found with selected tags' : 
                    `Showing ${notes.length} ${notes.length === 1 ? 'note' : 'notes'} with selected tags`
                  }
                </span>
              )}
              
              {selectedTags.length > 0 && (
                <span className="filtered-tags"> 
                  with tags: {selectedTags.map(tag => (
                    <span key={tag} className="search-info-tag">{tag}</span>
                  ))}
                </span>
              )}
              
              <button 
                className="clear-search" 
                onClick={async () => {
                  setSearchQuery('');
                  setSelectedTags([]);
                  try {
                    setIsLoading(true);
                    const notesData = await dbService.getAllNotes();
                    setNotes(notesData);
                    setError(null);
                  } catch (err) {
                    console.error('Error fetching notes:', err);
                    setError('Failed to fetch notes. Please try again.');
                  } finally {
                    setIsLoading(false);
                  }
                }}
              >
                Clear all filters
              </button>
            </p>
          </div>
        )}
      </div>
      
      <div className="notes-grid">
        {isLoading ? (
          <div className="loading">Loading notes...</div>
        ) : notes.length > 0 ? (
          notes.map(note => (
            <NoteCard key={note.id} note={note} />
          ))
        ) : (
          <div className="empty-state">
            <p>No notes found. Click "Add Note" to get started!</p>
          </div>
        )}
      </div>

      {/* Add Note Modal */}
      <AddNoteModal 
        isOpen={isAddNoteModalOpen} 
        onClose={() => setIsAddNoteModalOpen(false)}
        onNoteAdded={handleNoteAdded}
      />
    </div>
  );
};

export default Home; 