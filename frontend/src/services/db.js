import { openDB } from 'idb';

const DB_NAME = 'smart-notes-db';
const DB_VERSION = 1;
const NOTES_STORE = 'notes';
const TAGS_STORE = 'tags';

// Initialize the database
const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create notes store
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        const notesStore = db.createObjectStore(NOTES_STORE, { keyPath: 'id' });
        notesStore.createIndex('title', 'title', { unique: false });
        notesStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
        notesStore.createIndex('createdAt', 'createdAt', { unique: false });
        notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      // Create tags store
      if (!db.objectStoreNames.contains(TAGS_STORE)) {
        const tagsStore = db.createObjectStore(TAGS_STORE, { keyPath: 'name' });
        tagsStore.createIndex('count', 'count', { unique: false });
      }
    },
  });
};

// Get all notes
export const getAllNotes = async () => {
  const db = await initDB();
  return db.getAll(NOTES_STORE);
};

// Get a note by ID
export const getNoteById = async (id) => {
  const db = await initDB();
  return db.get(NOTES_STORE, id);
};

// Save a new note
export const saveNote = async (note) => {
  const db = await initDB();
  
  // Save the note
  const tx = db.transaction([NOTES_STORE, TAGS_STORE], 'readwrite');
  await tx.objectStore(NOTES_STORE).put(note);
  
  // Update the tags
  if (note.tags && note.tags.length > 0) {
    const tagsStore = tx.objectStore(TAGS_STORE);
    
    for (const tagName of note.tags) {
      try {
        const tag = await tagsStore.get(tagName);
        if (tag) {
          await tagsStore.put({ ...tag, count: tag.count + 1 });
        } else {
          await tagsStore.add({ name: tagName, count: 1 });
        }
      } catch (error) {
        console.error(`Error updating tag ${tagName}:`, error);
      }
    }
  }
  
  await tx.done;
  return note;
};

// Update an existing note
export const updateNote = async (note) => {
  const db = await initDB();
  
  // Get the old note to compare tags
  const oldNote = await getNoteById(note.id);
  const oldTags = oldNote ? oldNote.tags || [] : [];
  const newTags = note.tags || [];
  
  // Identify added and removed tags
  const addedTags = newTags.filter(tag => !oldTags.includes(tag));
  const removedTags = oldTags.filter(tag => !newTags.includes(tag));
  
  // Update the note and tags
  const tx = db.transaction([NOTES_STORE, TAGS_STORE], 'readwrite');
  
  // Update the note
  await tx.objectStore(NOTES_STORE).put({
    ...note,
    updatedAt: new Date().toISOString()
  });
  
  // Update tag counts
  const tagsStore = tx.objectStore(TAGS_STORE);
  
  // Increment count for added tags
  for (const tagName of addedTags) {
    try {
      const tag = await tagsStore.get(tagName);
      if (tag) {
        await tagsStore.put({ ...tag, count: tag.count + 1 });
      } else {
        await tagsStore.add({ name: tagName, count: 1 });
      }
    } catch (error) {
      console.error(`Error incrementing tag ${tagName}:`, error);
    }
  }
  
  // Decrement count for removed tags
  for (const tagName of removedTags) {
    try {
      const tag = await tagsStore.get(tagName);
      if (tag) {
        if (tag.count <= 1) {
          await tagsStore.delete(tagName);
        } else {
          await tagsStore.put({ ...tag, count: tag.count - 1 });
        }
      }
    } catch (error) {
      console.error(`Error decrementing tag ${tagName}:`, error);
    }
  }
  
  await tx.done;
  return note;
};

// Delete a note
export const deleteNote = async (id) => {
  const db = await initDB();
  
  // Get the note to update tag counts
  const note = await getNoteById(id);
  
  if (!note) {
    return false;
  }
  
  const tx = db.transaction([NOTES_STORE, TAGS_STORE], 'readwrite');
  
  // Delete the note
  await tx.objectStore(NOTES_STORE).delete(id);
  
  // Update tag counts
  if (note.tags && note.tags.length > 0) {
    const tagsStore = tx.objectStore(TAGS_STORE);
    
    for (const tagName of note.tags) {
      try {
        const tag = await tagsStore.get(tagName);
        if (tag) {
          if (tag.count <= 1) {
            await tagsStore.delete(tagName);
          } else {
            await tagsStore.put({ ...tag, count: tag.count - 1 });
          }
        }
      } catch (error) {
        console.error(`Error updating tag ${tagName}:`, error);
      }
    }
  }
  
  await tx.done;
  return true;
};

// Get all tags
export const getAllTags = async () => {
  const db = await initDB();
  return db.getAll(TAGS_STORE);
};

// Improved search notes function
export const searchNotes = async (query, tags = []) => {
  // eslint-disable-next-line no-unused-vars
  const db = await initDB();
  const allNotes = await getAllNotes();
  
  // If no query and no tags, return all notes
  if (!query && tags.length === 0) {
    return allNotes;
  }
  
  const lowercaseQuery = query ? query.toLowerCase() : '';
  
  // Filter and rank notes
  const scoredNotes = allNotes
    .map(note => {
      // First, check if note matches tags filter
      const matchesTags = tags.length === 0 || 
        (note.tags && tags.every(tag => note.tags.includes(tag)));
      
      if (!matchesTags) {
        return { note, score: -1 }; // Will be filtered out
      }
      
      // If no query, all tag-matched notes are included
      if (!query) {
        return { note, score: 1 };
      }
      
      // Calculate relevance score
      let score = 0;
      
      // Title matches (highest weight)
      if (note.title && note.title.toLowerCase().includes(lowercaseQuery)) {
        score += 10;
      }
      
      // Tag matches (high weight)
      if (note.tags && note.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))) {
        score += 8;
      }
      
      // Summary matches (medium-high weight)
      if (note.summary && note.summary.toLowerCase().includes(lowercaseQuery)) {
        score += 6;
      }
      
      // Content matches (medium weight)
      if (note.content && note.content.toLowerCase().includes(lowercaseQuery)) {
        score += 4;
      }
      
      return { note, score };
    })
    .filter(item => item.score > 0) // Remove non-matches
    .sort((a, b) => b.score - a.score); // Sort by score descending
  
  return scoredNotes.map(item => item.note);
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
};

export default dbService; 