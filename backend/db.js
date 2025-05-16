// NOTE: This file supports both SQLite (for local dev) and PostgreSQL (for production/Render).
require('dotenv').config();
const bcrypt = require('bcrypt');

const isProduction = process.env.NODE_ENV === 'production';

let dbClient;
let dbType;

if (isProduction) {
  // PostgreSQL for production
  const { Pool } = require('pg');
  dbClient = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  dbType = 'postgres';
} else {
  // SQLite for local development
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const dbPath = path.join(__dirname, 'notes.db');
  dbClient = new sqlite3.Database(dbPath);
  dbType = 'sqlite';
}

// Helper to run queries in both DBs
function runQuery(sql, params = []) {
  if (dbType === 'postgres') {
    return dbClient.query(sql, params);
  } else {
    return new Promise((resolve, reject) => {
      dbClient.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve({ rows });
      });
    });
  }
}

// Helper to run single row queries
function getQuery(sql, params = []) {
  if (dbType === 'postgres') {
    return dbClient.query(sql, params).then(res => res.rows[0]);
  } else {
    return new Promise((resolve, reject) => {
      dbClient.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }
}

// Helper to run insert/update/delete
function runExec(sql, params = []) {
  if (dbType === 'postgres') {
    return dbClient.query(sql, params);
  } else {
    return new Promise((resolve, reject) => {
      dbClient.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }
}

// Initialize database schema
async function initDatabase() {
  if (dbType === 'postgres') {
    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS Users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS Notes (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        user_id INTEGER NOT NULL REFERENCES Users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS Tags (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE
      );
      CREATE TABLE IF NOT EXISTS NoteTags (
        note_id INTEGER REFERENCES Notes(id) ON DELETE CASCADE,
        tag_id INTEGER REFERENCES Tags(id) ON DELETE CASCADE,
        PRIMARY KEY (note_id, tag_id)
      );
      CREATE TABLE IF NOT EXISTS Flashcards (
        id SERIAL PRIMARY KEY,
        note_id INTEGER NOT NULL REFERENCES Notes(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        answer TEXT NOT NULL
      );
    `);
    console.log('Database tables initialized (PostgreSQL)');
  } else {
    await new Promise((resolve, reject) => {
      dbClient.serialize(() => {
        dbClient.run(`CREATE TABLE IF NOT EXISTS Users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        dbClient.run(`CREATE TABLE IF NOT EXISTS Notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          summary TEXT,
          user_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES Users(id)
        )`);
        dbClient.run(`CREATE TABLE IF NOT EXISTS Tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE
        )`);
        dbClient.run(`CREATE TABLE IF NOT EXISTS NoteTags (
          note_id INTEGER,
          tag_id INTEGER,
          FOREIGN KEY (note_id) REFERENCES Notes(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES Tags(id) ON DELETE CASCADE,
          PRIMARY KEY (note_id, tag_id)
        )`);
        dbClient.run(`CREATE TABLE IF NOT EXISTS Flashcards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          note_id INTEGER NOT NULL,
          question TEXT NOT NULL,
          answer TEXT NOT NULL,
          FOREIGN KEY (note_id) REFERENCES Notes(id) ON DELETE CASCADE
        )`, (err) => {
          if (err) reject(err);
          else {
            console.log('Database tables initialized (SQLite)');
            resolve();
          }
        });
      });
    });
  }
}

// User-related functions
async function createUser(username, email, password) {
  const saltRounds = 10;
  const hash = await bcrypt.hash(password, saltRounds);
  try {
    const result = await runQuery(
      'INSERT INTO Users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hash]
    );
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') { // unique_violation
      if (err.detail.includes('username')) {
        throw new Error('Username already exists');
      } else if (err.detail.includes('email')) {
        throw new Error('Email already exists');
      }
    }
    throw err;
  }
}

async function getUserByUsername(username) {
  if (!username) return null;
  const result = await runQuery('SELECT * FROM Users WHERE username = $1', [username]);
  return result.rows[0] || null;
}

async function getUserByEmail(email) {
  if (!email) return null;
  const result = await runQuery('SELECT * FROM Users WHERE email = $1', [email]);
  return result.rows[0] || null;
}

async function getUserById(id) {
  if (!id) return null;
  const result = await runQuery('SELECT * FROM Users WHERE id = $1', [id]);
  if (result.rows[0]) {
    const { password_hash, ...userWithoutPassword } = result.rows[0];
    return userWithoutPassword;
  }
  return null;
}

async function validateUser(email, password) {
  if (!email || !password) return null;
  const user = await getUserByEmail(email);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.password_hash);
  if (match) {
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  return null;
}

// Note-related functions
async function getNotes(userId) {
  const result = await runQuery('SELECT * FROM Notes WHERE user_id = $1', [userId]);
  return result.rows;
}

// Note-related functions
async function getNoteById(noteId, userId) {
  const result = await runQuery('SELECT * FROM Notes WHERE id = $1 AND user_id = $2', [noteId, userId]);
  if (result.rows.length > 0) {
    const { tag_names, ...noteWithoutTags } = result.rows[0];
    const tags = tag_names ? tag_names.split(',') : [];
    const note = { ...noteWithoutTags, tags };
    return note;
  }
  return null;
}

async function createNote(note, userId) {
  const created_at = note.created_at ? note.created_at : new Date().toISOString();
  const updated_at = note.updated_at ? note.updated_at : created_at;
  
  const result = await runQuery(
    'INSERT INTO Notes (title, content, summary, user_id, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, title, content, summary, created_at, updated_at',
    [note.title, note.content, note.summary, userId, created_at, updated_at]
  );
  
  const noteId = result.rows[0].id;
  
  try {
    if (note.tags && note.tags.length > 0) {
      await addTagsToNote(noteId, note.tags);
    }
    
    if (note.flashcards && note.flashcards.length > 0) {
      await addFlashcardsToNote(noteId, note.flashcards);
    }
    
    const createdNote = await getNoteById(noteId, userId);
    return createdNote;
  } catch (error) {
    await runExec('DELETE FROM Notes WHERE id = $1', [noteId]);
    throw error;
  }
}

async function updateNote(noteId, note, userId) {
  const updated_at = note.updated_at ? note.updated_at : new Date().toISOString();
  
  const result = await runQuery(
    'UPDATE Notes SET title = $1, content = $2, summary = $3, updated_at = $4 WHERE id = $5 AND user_id = $6 RETURNING id',
    [note.title, note.content, note.summary, updated_at, noteId, userId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Note not found or not authorized');
  }
  
  try {
    if (note.tags && note.tags.length > 0) {
      await removeAllTagsFromNote(noteId);
      await addTagsToNote(noteId, note.tags);
    }
    
    if (note.flashcards) {
      await removeAllFlashcardsFromNote(noteId);
      
      let flashcardsToStore = [];
      
      if (Array.isArray(note.flashcards)) {
        flashcardsToStore = note.flashcards;
      } else if (note.flashcards.notes && Array.isArray(note.flashcards.notes)) {
        flashcardsToStore = note.flashcards.notes.map(card => ({
          question: card.fields.Front,
          answer: card.fields.Back
        }));
      }
      
      if (flashcardsToStore.length > 0) {
        console.log(`Adding ${flashcardsToStore.length} flashcards to note ${noteId}`);
        await addFlashcardsToNote(noteId, flashcardsToStore);
      }
    }
    
    const updatedNote = await getNoteById(noteId, userId);
    return updatedNote;
  } catch (error) {
    await runExec('UPDATE Notes SET updated_at = $1 WHERE id = $2', [updated_at, noteId]);
    throw error;
  }
}

async function deleteNote(noteId, userId) {
  const result = await runExec('DELETE FROM Notes WHERE id = $1 AND user_id = $2 RETURNING id', [noteId, userId]);
  if (result.rows.length === 0) {
    throw new Error('Note not found or not authorized');
  }
  return true;
}

async function searchNotes(searchTerm, tags, userId) {
  console.log('DEBUG: searchNotes called with:', { searchTerm, tags, userId });
  
  let query = 'SELECT DISTINCT n.*, GROUP_CONCAT(t.name) as tag_names FROM Notes n LEFT JOIN NoteTags nt ON n.id = nt.note_id LEFT JOIN Tags t ON nt.tag_id = t.id WHERE n.user_id = $1';
  let params = [userId];
  let conditions = ['n.user_id = $1'];
  
  if (searchTerm && searchTerm.trim()) {
    conditions.push('(n.title LIKE $2 OR n.content LIKE $2 OR n.summary LIKE $2 OR t.name LIKE $2)');
    const searchPattern = `%${searchTerm.trim()}%`;
    params.push(searchPattern, searchPattern);
  }
  
  if (tags && tags.length > 0) {
    console.log('DEBUG: Filtering with tags:', tags);
    
    const tagQueries = tags.map((_, index) => {
      return 'EXISTS (SELECT 1 FROM NoteTags nt' + index + ' INNER JOIN Tags t' + index + ' ON nt' + index + '.tag_id = t' + index + '.id WHERE nt' + index + '.note_id = n.id AND t' + index + '.name = $' + (index + 2) + ')';
    });
    
    conditions.push('(' + tagQueries.join(' AND ') + ')');
    
    tags.forEach(tag => params.push(tag));
  }
  
  query += ' AND ' + conditions.join(' AND ') + ' GROUP BY n.id ORDER BY n.updated_at DESC';
  
  console.log('DEBUG: Generated SQL query:', query);
  console.log('DEBUG: Query parameters:', params);
  
  const result = await runQuery(query, params);
  
  console.log('DEBUG: Raw query results:', result.rows ? result.rows.length : 0, 'rows found');
  
  const notes = result.rows.map(row => {
    const tags = row.tag_names ? row.tag_names.split(',') : [];
    const { tag_names, ...noteWithoutTags } = row;
    return { ...noteWithoutTags, tags };
  });
  
  console.log('DEBUG: Returning', notes.length, 'processed notes');
  return notes;
}

// Tag-related functions
async function getAllTags(userId) {
  const result = await runQuery('SELECT t.name, COUNT(nt.note_id) as count FROM Tags t INNER JOIN NoteTags nt ON t.id = nt.tag_id INNER JOIN Notes n ON nt.note_id = n.id WHERE n.user_id = $1 GROUP BY t.id ORDER BY count DESC', [userId]);
  return result.rows;
}

async function getOrCreateTag(tagName) {
  const result = await runQuery('SELECT * FROM Tags WHERE name = $1', [tagName]);
  if (result.rows.length > 0) {
    return result.rows[0];
  }
  
  const resultInsert = await runQuery('INSERT INTO Tags (name) VALUES ($1) RETURNING id, name', [tagName]);
  return resultInsert.rows[0];
}

async function addTagsToNote(noteId, tagNames) {
  const promises = tagNames.map(async (tagName) => {
    const tag = await getOrCreateTag(tagName);
    return runExec('INSERT INTO NoteTags (note_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [noteId, tag.id]);
  });
  
  await Promise.all(promises);
}

async function removeAllTagsFromNote(noteId) {
  await runExec('DELETE FROM NoteTags WHERE note_id = $1', [noteId]);
}

// Flashcard-related functions
async function getFlashcardsForNote(noteId) {
  const result = await runQuery('SELECT * FROM Flashcards WHERE note_id = $1', [noteId]);
  if (result.rows.length > 0) {
    const formattedFlashcards = {
      notes: result.rows.map(row => ({
        fields: {
          Front: row.question,
          Back: row.answer
        },
        tags: []
      }))
    };
    return formattedFlashcards;
  }
  return [];
}

async function addFlashcardsToNote(noteId, flashcards) {
  if (!flashcards || !Array.isArray(flashcards) || flashcards.length === 0) {
    console.log('No flashcards to add');
    return;
  }

  console.log('Adding flashcards to note:', noteId, 'Count:', flashcards.length);
  console.log('First flashcard sample:', JSON.stringify(flashcards[0]));
  
  const stmt = await runExec('INSERT INTO Flashcards (note_id, question, answer) VALUES ($1, $2, $3) RETURNING id', [noteId, flashcards[0].question, flashcards[0].answer]);
  
  const promises = flashcards.map(flashcard => {
    let question, answer;
    
    if (flashcard.question && flashcard.answer) {
      question = flashcard.question;
      answer = flashcard.answer;
    } else if (flashcard.fields && flashcard.fields.Front && flashcard.fields.Back) {
      question = flashcard.fields.Front;
      answer = flashcard.fields.Back;
    } else {
      console.warn('Invalid flashcard format:', flashcard);
      return Promise.resolve();
    }
    
    return runExec('INSERT INTO Flashcards (note_id, question, answer) VALUES ($1, $2, $3) RETURNING id', [noteId, question, answer]);
  });
  
  await Promise.all(promises);
}

async function removeAllFlashcardsFromNote(noteId) {
  await runExec('DELETE FROM Flashcards WHERE note_id = $1', [noteId]);
}

// Migration function - From JSON to SQL
async function migrateJsonToSql(userId) {
  const fs = require('fs');
  const path = require('path');
  const notesDir = path.join(__dirname, 'notes');
  
  if (!fs.existsSync(notesDir)) {
    console.log('No notes directory found, skipping migration');
    return;
  }
  
  try {
    const noteFiles = fs.readdirSync(notesDir);
    console.log(`Found ${noteFiles.length} potential notes to migrate`);
    
    for (const file of noteFiles) {
      if (file.endsWith('.json')) {
        try {
          const noteData = fs.readFileSync(path.join(notesDir, file), 'utf8');
          const note = JSON.parse(noteData);
          
          await createNote({
            title: note.title,
            content: note.content,
            summary: note.summary,
            tags: note.tags || [],
            flashcards: note.flashcards || []
          }, userId);
          
          console.log(`Migrated note: ${note.title}`);
        } catch (error) {
          console.error(`Error migrating note file ${file}:`, error);
        }
      }
    }
    
    console.log('Migration completed');
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Export all functions and database connection
module.exports = {
  dbClient,
  initDatabase,
  createUser,
  getUserByUsername,
  getUserByEmail,
  getUserById,
  validateUser,
  getNotes,
  getNoteById,
  createNote,
  updateNote,
  deleteNote,
  searchNotes,
  getAllTags,
  getOrCreateTag,
  addTagsToNote,
  removeAllTagsFromNote,
  getFlashcardsForNote,
  addFlashcardsToNote,
  removeAllFlashcardsFromNote,
  migrateJsonToSql
}; 