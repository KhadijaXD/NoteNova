import axios from 'axios';
import authService from './auth';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
const DB_NAME = 'NoteNova';
const DB_VERSION = 1;

// Initialize IndexedDB
const initializeIndexedDB = () => {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    
    // Create object stores when database is being upgraded
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create notes store if it doesn't exist
      if (!db.objectStoreNames.contains('notes')) {
        const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
        notesStore.createIndex('by_title', 'title', { unique: false });
        notesStore.createIndex('by_updated_at', 'updated_at', { unique: false });
        console.log('Created "notes" object store in IndexedDB');
      }
    };
    
    request.onsuccess = (event) => {
      console.log('Successfully opened IndexedDB');
      resolve(event.target.result);
    };
    
    request.onerror = (event) => {
      console.error('Error opening IndexedDB:', event.target.error);
      reject(event.target.error);
    };
  });
};

// Initialize the database when this module is loaded
initializeIndexedDB()
  .then(db => {
    console.log('IndexedDB initialized successfully');
    db.close();
  })
  .catch(error => {
    console.error('Failed to initialize IndexedDB:', error);
  });

// Create a new axios instance for API calls
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = authService.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Get all notes
export const getAllNotes = async () => {
  try {
    const response = await api.get('/api/notes');
    return response.data;
  } catch (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
};

// Get a note by ID
export const getNoteById = async (id) => {
  try {
    const response = await api.get(`/api/notes/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching note ${id}:`, error);
    throw error;
  }
};

// Save a new note
export const saveNote = async (note) => {
  try {
    const response = await api.post('/api/notes', note);
    return response.data;
  } catch (error) {
    console.error('Error saving note:', error);
    throw error;
  }
};

// Update an existing note
export const updateNote = async (note) => {
  try {
    const response = await api.put(`/api/notes/${note.id}`, note);
    return response.data;
  } catch (error) {
    console.error(`Error updating note ${note.id}:`, error);
    throw error;
  }
};

// Delete a note
export const deleteNote = async (id) => {
  try {
    await api.delete(`/api/notes/${id}`);
    return true;
  } catch (error) {
    console.error(`Error deleting note ${id}:`, error);
    throw error;
  }
};

// Get all tags
export const getAllTags = async () => {
  try {
    const response = await api.get('/api/tags');
    return response.data;
  } catch (error) {
    console.error('Error fetching tags:', error);
    return [];
  }
};

// Search notes
export const searchNotes = async (query, tags = []) => {
  try {
    console.log('Frontend searchNotes called with:', { query, tags });
    
    let url = '/api/search';
    const params = {};
    
    if (query) {
      params.q = query;
    }
    
    if (tags && tags.length > 0) {
      params.tags = tags.join(',');
      console.log('Frontend sending tags param:', params.tags);
    }
    
    console.log('Frontend search request params:', params);
    const response = await api.get(url, { params });
    console.log('Frontend search response:', response.data.length, 'notes found');
    return response.data;
  } catch (error) {
    console.error('Error searching notes:', error);
    return [];
  }
};

// Get flashcards for a note
export const getFlashcards = async (noteId) => {
  try {
    const response = await api.get(`/api/notes/${noteId}/flashcards`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching flashcards for note ${noteId}:`, error);
    return [];
  }
};

// Generate new flashcards for a note
export const generateFlashcards = async (noteId) => {
  try {
    const response = await api.post(`/api/notes/${noteId}/flashcards/generate`);
    return response.data;
  } catch (error) {
    console.error(`Error generating flashcards for note ${noteId}:`, error);
    return [];
  }
};

// Upload a file
export const uploadFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/api/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

// Clear all notes from local IndexedDB
export const clearAllNotes = async () => {
  try {
    // Make sure IndexedDB is initialized first
    await initializeIndexedDB();
    
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = function(event) {
        const database = event.target.result;
        
        // Check if the notes object store exists
        if (!database.objectStoreNames.contains('notes')) {
          console.log('Notes object store does not exist, nothing to clear');
          database.close();
          resolve();
          return;
        }
        
        const transaction = database.transaction(['notes'], 'readwrite');
        const objectStore = transaction.objectStore('notes');
        const clearRequest = objectStore.clear();
        
        clearRequest.onsuccess = function() {
          console.log('Successfully cleared notes from IndexedDB');
          database.close();
          resolve();
        };
        
        clearRequest.onerror = function(e) {
          console.error('Error clearing notes from IndexedDB:', e);
          database.close();
          reject(e);
        };
      };
      
      request.onerror = function(e) {
        console.error('Error opening IndexedDB:', e);
        reject(e);
      };
    });
  } catch (error) {
    console.error('Error clearing all notes from IndexedDB:', error);
    throw error;
  }
};

// Save a note to local IndexedDB only (used for syncing)
export const saveNoteLocally = async (note) => {
  try {
    // Make sure IndexedDB is initialized first
    await initializeIndexedDB();
    
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    
    return new Promise((resolve, reject) => {
      request.onsuccess = function(event) {
        const database = event.target.result;
        
        // Check if the notes object store exists
        if (!database.objectStoreNames.contains('notes')) {
          console.error('Notes object store does not exist');
          database.close();
          reject(new Error('Notes object store does not exist'));
          return;
        }
        
        const transaction = database.transaction(['notes'], 'readwrite');
        const objectStore = transaction.objectStore('notes');
        const putRequest = objectStore.put(note);
        
        putRequest.onsuccess = function() {
          console.log('Successfully saved note to IndexedDB');
          database.close();
          resolve();
        };
        
        putRequest.onerror = function(e) {
          console.error('Error saving note to IndexedDB:', e);
          database.close();
          reject(e);
        };
      };
      
      request.onerror = function(e) {
        console.error('Error opening IndexedDB:', e);
        reject(e);
      };
    });
  } catch (error) {
    console.error('Error saving note locally to IndexedDB:', error);
    throw error;
  }
};

// Delete the entire IndexedDB database
export const deleteIndexedDB = () => {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase(DB_NAME);
    
    request.onsuccess = () => {
      console.log(`Successfully deleted ${DB_NAME} database`);
      resolve();
    };
    
    request.onerror = (event) => {
      console.error(`Error deleting ${DB_NAME} database:`, event.target.error);
      reject(event.target.error);
    };
    
    request.onblocked = (event) => {
      console.warn(`Database deletion blocked, please close all other tabs with this site open`);
      // We can still resolve since this is not a critical error
      resolve();
    };
  });
};

// Create a named object for export
const dbService = {
  getAllNotes,
  getNoteById,
  saveNote,
  updateNote,
  deleteNote,
  getAllTags,
  searchNotes,
  getFlashcards,
  generateFlashcards,
  uploadFile,
  clearAllNotes,
  saveNoteLocally,
  deleteIndexedDB,
};

export default dbService; 