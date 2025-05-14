const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

// Create database connection
const dbPath = path.join(__dirname, 'notes.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err);
  } else {
    console.log('Connected to SQLite database');
    
    // Initialize database tables
    initDatabase();
  }
});

// Initialize database schema
function initDatabase() {
  db.serialize(() => {
    // Create Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create Notes table
    db.run(`
      CREATE TABLE IF NOT EXISTS Notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        summary TEXT,
        user_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(id)
      )
    `);

    // Create Tags table
    db.run(`
      CREATE TABLE IF NOT EXISTS Tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
      )
    `);

    // Create NoteTags table (many-to-many relationship)
    db.run(`
      CREATE TABLE IF NOT EXISTS NoteTags (
        note_id INTEGER,
        tag_id INTEGER,
        FOREIGN KEY (note_id) REFERENCES Notes(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES Tags(id) ON DELETE CASCADE,
        PRIMARY KEY (note_id, tag_id)
      )
    `);

    // Create Flashcards table
    db.run(`
      CREATE TABLE IF NOT EXISTS Flashcards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        note_id INTEGER NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        FOREIGN KEY (note_id) REFERENCES Notes(id) ON DELETE CASCADE
      )
    `);

    console.log('Database tables initialized');
  });
}

// User-related functions
async function createUser(username, email, password) {
  return new Promise((resolve, reject) => {
    const saltRounds = 10;
    bcrypt.hash(password, saltRounds, (err, hash) => {
      if (err) {
        return reject(err);
      }

      const stmt = db.prepare('INSERT INTO Users (username, email, password_hash) VALUES (?, ?, ?)');
      stmt.run([username, email, hash], function(err) {
        if (err) {
          // Check for specific constraint error
          if (err.code === 'SQLITE_CONSTRAINT') {
            if (err.message.includes('Users.username')) {
              reject(new Error('Username already exists'));
            } else if (err.message.includes('Users.email')) {
              reject(new Error('Email already exists'));
            } else {
              reject(err);
            }
          } else {
            reject(err);
          }
        } else {
          resolve({ id: this.lastID, username, email });
        }
      });
      stmt.finalize();
    });
  });
}

async function getUserByUsername(username) {
  return new Promise((resolve, reject) => {
    if (!username) {
      return resolve(null);
    }
    
    db.get('SELECT * FROM Users WHERE username = ?', [username], (err, row) => {
      if (err) {
        console.error('Error getting user by username:', err);
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
}

async function getUserByEmail(email) {
  return new Promise((resolve, reject) => {
    if (!email) {
      return resolve(null);
    }
    
    db.get('SELECT * FROM Users WHERE email = ?', [email], (err, row) => {
      if (err) {
        console.error('Error getting user by email:', err);
        reject(err);
      } else {
        resolve(row || null);
      }
    });
  });
}

async function getUserById(id) {
  return new Promise((resolve, reject) => {
    if (!id) {
      return resolve(null);
    }
    
    db.get('SELECT * FROM Users WHERE id = ?', [id], (err, row) => {
      if (err) {
        console.error('Error getting user by ID:', err);
        reject(err);
      } else {
        if (row) {
          // Remove password hash for security
          const { password_hash, ...userWithoutPassword } = row;
          resolve(userWithoutPassword);
        } else {
          resolve(null);
        }
      }
    });
  });
}

async function validateUser(email, password) {
  try {
    if (!email || !password) {
      return null;
    }
    
    const user = await getUserByEmail(email);
    if (!user) {
      console.log(`Login attempt failed: No user found with email ${email}`);
      return null;
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (match) {
      console.log(`User ${email} logged in successfully`);
      // Return user without password
      const { password_hash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
    
    console.log(`Login attempt failed: Invalid password for user ${email}`);
    return null;
  } catch (error) {
    console.error('Error validating user:', error);
    throw error;
  }
}

// Note-related functions
async function getNotes(userId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT n.*, GROUP_CONCAT(t.name) as tag_names
      FROM Notes n
      LEFT JOIN NoteTags nt ON n.id = nt.note_id
      LEFT JOIN Tags t ON nt.tag_id = t.id
      WHERE n.user_id = ?
      GROUP BY n.id
      ORDER BY n.updated_at DESC
    `;
    
    db.all(query, [userId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        // Process the results to format the tags and dates
        const notes = rows.map(row => {
          const tags = row.tag_names ? row.tag_names.split(',') : [];
          const { tag_names, ...noteWithoutTags } = row;
          
          // Ensure the dates are properly formatted in ISO format
          let created_at = null;
          let updated_at = null;
          
          if (row.created_at) {
            try {
              // For SQLite timestamp format, need to ensure it's ISO format
              const createdDate = new Date(row.created_at);
              if (!isNaN(createdDate.getTime())) {
                created_at = createdDate.toISOString();
              }
            } catch (e) {
              console.error("Error formatting created_at date:", e);
            }
          }
          
          if (row.updated_at) {
            try {
              const updatedDate = new Date(row.updated_at);
              if (!isNaN(updatedDate.getTime())) {
                updated_at = updatedDate.toISOString();
              }
            } catch (e) {
              console.error("Error formatting updated_at date:", e);
            }
          }
          
          const note = { 
            ...noteWithoutTags, 
            tags,
            created_at: created_at,
            updated_at: updated_at
          };
          
          return note;
        });
        resolve(notes);
      }
    });
  });
}

async function getNoteById(noteId, userId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT n.*, GROUP_CONCAT(t.name) as tag_names
      FROM Notes n
      LEFT JOIN NoteTags nt ON n.id = nt.note_id
      LEFT JOIN Tags t ON nt.tag_id = t.id
      WHERE n.id = ? AND n.user_id = ?
      GROUP BY n.id
    `;
    
    db.get(query, [noteId, userId], (err, row) => {
      if (err) {
        reject(err);
      } else if (!row) {
        resolve(null);
      } else {
        // Format the tags and ensure dates
        const tags = row.tag_names ? row.tag_names.split(',') : [];
        const { tag_names, ...noteWithoutTags } = row;
        
        // Ensure the dates are properly formatted in ISO format
        let created_at = null;
        let updated_at = null;
        
        if (row.created_at) {
          try {
            // For SQLite timestamp format, need to ensure it's ISO format
            const createdDate = new Date(row.created_at);
            if (!isNaN(createdDate.getTime())) {
              created_at = createdDate.toISOString();
            }
          } catch (e) {
            console.error("Error formatting created_at date:", e);
          }
        }
        
        if (row.updated_at) {
          try {
            const updatedDate = new Date(row.updated_at);
            if (!isNaN(updatedDate.getTime())) {
              updated_at = updatedDate.toISOString();
            }
          } catch (e) {
            console.error("Error formatting updated_at date:", e);
          }
        }
        
        const note = { 
          ...noteWithoutTags, 
          tags,
          created_at: created_at,
          updated_at: updated_at
        };
        
        resolve(note);
      }
    });
  });
}

async function createNote(note, userId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      const stmt = db.prepare(`
        INSERT INTO Notes (title, content, summary, user_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime(?), datetime(?))
      `);
      
      // Make sure we have valid timestamps or use current time
      const created_at = note.created_at ? note.created_at : new Date().toISOString();
      const updated_at = note.updated_at ? note.updated_at : created_at;
      
      stmt.run([
        note.title, 
        note.content, 
        note.summary, 
        userId, 
        created_at,
        updated_at
      ], async function(err) {
        if (err) {
          db.run('ROLLBACK');
          return reject(err);
        }
        
        const noteId = this.lastID;
        
        try {
          // Handle tags
          if (note.tags && note.tags.length > 0) {
            await addTagsToNote(noteId, note.tags);
          }
          
          // Handle flashcards
          if (note.flashcards && note.flashcards.length > 0) {
            await addFlashcardsToNote(noteId, note.flashcards);
          }
          
          db.run('COMMIT');
          
          // Get the complete note with tags
          const createdNote = await getNoteById(noteId, userId);
          resolve(createdNote);
        } catch (error) {
          db.run('ROLLBACK');
          reject(error);
        }
      });
      
      stmt.finalize();
    });
  });
}

async function updateNote(noteId, note, userId) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      // Prepare update query that includes timestamp
      const updateStmt = db.prepare(`
        UPDATE Notes 
        SET title = ?, content = ?, summary = ?, updated_at = datetime(?)
        WHERE id = ? AND user_id = ?
      `);
      
      // Make sure we have a valid timestamp or use current time
      const updated_at = note.updated_at ? note.updated_at : new Date().toISOString();
      
      updateStmt.run([
        note.title, 
        note.content, 
        note.summary, 
        updated_at,
        noteId, 
        userId
      ], async function(err) {
        if (err) {
          db.run('ROLLBACK');
          return reject(err);
        }
        
        if (this.changes === 0) {
          db.run('ROLLBACK');
          return reject(new Error('Note not found or not authorized'));
        }
        
        try {
          // Remove all existing tags for this note
          await removeAllTagsFromNote(noteId);
          
          // Add new tags
          if (note.tags && note.tags.length > 0) {
            await addTagsToNote(noteId, note.tags);
          }
          
          // Update flashcards
          if (note.flashcards) {
            await removeAllFlashcardsFromNote(noteId);
            
            let flashcardsToStore = [];
            
            // Handle different flashcard formats
            if (Array.isArray(note.flashcards)) {
              flashcardsToStore = note.flashcards;
            } else if (note.flashcards.notes && Array.isArray(note.flashcards.notes)) {
              // Format from API: { notes: [{ fields: { Front, Back } }] }
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
          
          db.run('COMMIT');
          
          // Get the updated note
          const updatedNote = await getNoteById(noteId, userId);
          resolve(updatedNote);
        } catch (error) {
          db.run('ROLLBACK');
          reject(error);
        }
      });
      
      updateStmt.finalize();
    });
  });
}

async function deleteNote(noteId, userId) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('DELETE FROM Notes WHERE id = ? AND user_id = ?');
    stmt.run([noteId, userId], function(err) {
      if (err) {
        reject(err);
      } else if (this.changes === 0) {
        reject(new Error('Note not found or not authorized'));
      } else {
        resolve(true);
      }
    });
    stmt.finalize();
  });
}

async function searchNotes(searchTerm, tags, userId) {
  console.log('DEBUG: searchNotes called with:', { searchTerm, tags, userId });
  
  return new Promise((resolve, reject) => {
    // Build the base query
    let query = `
      SELECT DISTINCT n.*, GROUP_CONCAT(t.name) as tag_names
      FROM Notes n
      LEFT JOIN NoteTags nt ON n.id = nt.note_id
      LEFT JOIN Tags t ON nt.tag_id = t.id
    `;
    
    let params = [userId];
    let conditions = ['n.user_id = ?'];
    
    // Add search condition if searchTerm is provided
    if (searchTerm && searchTerm.trim()) {
      conditions.push(`(
        n.title LIKE ? OR
        n.content LIKE ? OR
        n.summary LIKE ? OR
        t.name LIKE ?
      )`);
      const searchPattern = `%${searchTerm.trim()}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    // Add tags filter if provided - use a simpler approach
    if (tags && tags.length > 0) {
      console.log('DEBUG: Filtering with tags:', tags);
      
      // Create a subquery for each tag
      const tagQueries = tags.map((_, index) => {
        return `
          EXISTS (
            SELECT 1 
            FROM NoteTags nt${index}
            INNER JOIN Tags t${index} ON nt${index}.tag_id = t${index}.id
            WHERE nt${index}.note_id = n.id AND t${index}.name = ?
          )
        `;
      });
      
      // Changed from OR to AND to require all selected tags to be present
      conditions.push(`(${tagQueries.join(' AND ')})`);
      
      // Add each tag as a parameter
      tags.forEach(tag => params.push(tag));
    }
    
    // Complete the query
    query += ` WHERE ${conditions.join(' AND ')}
               GROUP BY n.id
               ORDER BY n.updated_at DESC`;
    
    console.log('DEBUG: Generated SQL query:', query);
    console.log('DEBUG: Query parameters:', params);
    
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error('DEBUG: SQL error:', err);
        reject(err);
      } else {
        console.log('DEBUG: Raw query results:', rows ? rows.length : 0, 'rows found');
        
        // Process the results to format the tags
        const notes = rows.map(row => {
          const tags = row.tag_names ? row.tag_names.split(',') : [];
          const { tag_names, ...noteWithoutTags } = row;
          return { ...noteWithoutTags, tags };
        });
        
        console.log('DEBUG: Returning', notes.length, 'processed notes');
        resolve(notes);
      }
    });
  });
}

// Tag-related functions
async function getAllTags(userId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT t.name, COUNT(nt.note_id) as count
      FROM Tags t
      INNER JOIN NoteTags nt ON t.id = nt.tag_id
      INNER JOIN Notes n ON nt.note_id = n.id
      WHERE n.user_id = ?
      GROUP BY t.id
      ORDER BY count DESC
    `;
    
    db.all(query, [userId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function getOrCreateTag(tagName) {
  return new Promise((resolve, reject) => {
    // First try to find the tag
    db.get('SELECT * FROM Tags WHERE name = ?', [tagName], (err, row) => {
      if (err) {
        return reject(err);
      }
      
      if (row) {
        // Tag exists, return it
        return resolve(row);
      }
      
      // Tag doesn't exist, create it
      const stmt = db.prepare('INSERT INTO Tags (name) VALUES (?)');
      stmt.run([tagName], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, name: tagName });
        }
      });
      stmt.finalize();
    });
  });
}

async function addTagsToNote(noteId, tagNames) {
  const promises = tagNames.map(async (tagName) => {
    const tag = await getOrCreateTag(tagName);
    return new Promise((resolve, reject) => {
      const stmt = db.prepare('INSERT OR IGNORE INTO NoteTags (note_id, tag_id) VALUES (?, ?)');
      stmt.run([noteId, tag.id], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
      stmt.finalize();
    });
  });
  
  return Promise.all(promises);
}

async function removeAllTagsFromNote(noteId) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('DELETE FROM NoteTags WHERE note_id = ?');
    stmt.run([noteId], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
    stmt.finalize();
  });
}

// Flashcard-related functions
async function getFlashcardsForNote(noteId) {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM Flashcards WHERE note_id = ?', [noteId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        // If we have flashcards, format them to match the expected frontend format
        if (rows && rows.length > 0) {
          const formattedFlashcards = {
            notes: rows.map(row => ({
              fields: {
                Front: row.question,
                Back: row.answer
              },
              tags: [] // Tags could be added here if needed
            }))
          };
          resolve(formattedFlashcards);
        } else {
          // No flashcards found
          resolve([]);
        }
      }
    });
  });
}

async function addFlashcardsToNote(noteId, flashcards) {
  // Return early if there are no flashcards to add
  if (!flashcards || !Array.isArray(flashcards) || flashcards.length === 0) {
    console.log('No flashcards to add');
    return;
  }

  console.log('Adding flashcards to note:', noteId, 'Count:', flashcards.length);
  console.log('First flashcard sample:', JSON.stringify(flashcards[0]));
  
  const stmt = db.prepare('INSERT INTO Flashcards (note_id, question, answer) VALUES (?, ?, ?)');
  
  const promises = flashcards.map(flashcard => {
    // Handle different formats of flashcards
    let question, answer;
    
    if (flashcard.question && flashcard.answer) {
      // Direct format: { question, answer }
      question = flashcard.question;
      answer = flashcard.answer;
    } else if (flashcard.fields && flashcard.fields.Front && flashcard.fields.Back) {
      // Format from API: { fields: { Front, Back } }
      question = flashcard.fields.Front;
      answer = flashcard.fields.Back;
    } else {
      console.warn('Invalid flashcard format:', flashcard);
      return Promise.resolve(); // Skip this flashcard
    }
    
    return new Promise((resolve, reject) => {
      stmt.run([noteId, question, answer], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  });
  
  await Promise.all(promises);
  stmt.finalize();
}

async function removeAllFlashcardsFromNote(noteId) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('DELETE FROM Flashcards WHERE note_id = ?');
    stmt.run([noteId], (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
    stmt.finalize();
  });
}

// Migration function - From JSON to SQL
async function migrateJsonToSql(userId) {
  const fs = require('fs');
  const path = require('path');
  const notesDir = path.join(__dirname, 'notes');
  
  // Check if notes directory exists
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
          
          // Create note in SQL
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
  // Database connection
  db,
  
  // User functions
  createUser,
  getUserByUsername,
  getUserByEmail,
  getUserById,
  validateUser,
  
  // Include all other exported functions from the original file
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