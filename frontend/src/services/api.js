import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Upload a file (PDF, text)
export const uploadFile = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await apiClient.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      timeout: 30000, // 30 second timeout for large files
    });
    
    return response.data;
  } catch (error) {
    // Enhance error handling with more specific messages
    if (error.response) {
      // The server responded with a status outside the range of 2xx
      const serverError = error.response.data?.error || error.response.data?.message || 'Server error';
      throw new Error(`Upload failed: ${serverError}`);
    } else if (error.request) {
      // The request was made but no response was received
      throw new Error('No response from server. Please check your internet connection and try again.');
    } else {
      // Something happened in setting up the request
      throw new Error(`Upload error: ${error.message}`);
    }
  }
};

// Upload a manually created note
export const uploadNote = async (noteData) => {
  try {
    const response = await apiClient.post('/notes', noteData);
    return response.data;
  } catch (error) {
    if (error.response) {
      const serverError = error.response.data?.error || error.response.data?.message || 'Server error';
      throw new Error(`Note upload failed: ${serverError}`);
    } else if (error.request) {
      throw new Error('No response from server. Please check your internet connection and try again.');
    } else {
      throw new Error(`Note upload error: ${error.message}`);
    }
  }
};

// Get all notes from the server
export const getNotes = async () => {
  const response = await apiClient.get('/notes');
  return response.data;
};

// Get a note by ID
export const getNote = async (id) => {
  const response = await apiClient.get(`/notes/${id}`);
  return response.data;
};

// Update a note
export const updateNote = async (id, noteData) => {
  const response = await apiClient.put(`/notes/${id}`, noteData);
  return response.data;
};

// Delete a note
export const deleteNote = async (id) => {
  const response = await apiClient.delete(`/notes/${id}`);
  return response.data;
};

// Search notes
export const searchNotes = async (query, tags) => {
  const params = {};
  
  if (query) {
    params.query = query;
  }
  
  if (tags && tags.length) {
    params.tags = tags.join(',');
  }
  
  const response = await apiClient.get('/search', { params });
  return response.data;
};

// Generate flashcards for a note
export const generateFlashcards = async (id) => {
  const response = await apiClient.get(`/notes/${id}/flashcards`);
  return response.data;
};

// Regenerate a summary for a note using Llama
export const regenerateSummary = async (id) => {
  const response = await apiClient.post(`/notes/${id}/regenerate-summary`);
  return response.data;
};

export default {
  uploadFile,
  uploadNote,
  getNotes,
  getNote,
  updateNote,
  deleteNote,
  searchNotes,
  generateFlashcards,
  regenerateSummary
}; 