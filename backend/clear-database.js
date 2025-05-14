// Clear database script
// This script will delete all users and associated data from the database

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Create database connection
const dbPath = path.join(__dirname, 'notes.db');

console.log('Connecting to database...');
console.log(`Database path: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
  
  // Begin the clearing process
  clearDatabase();
});

// Function to clear all tables in a specific order
function clearDatabase() {
  console.log('\n=== CLEARING DATABASE ===');
  
  // Use a transaction for data consistency
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    console.log('Deleting VerificationCodes...');
    db.run('DELETE FROM VerificationCodes', handleError);
    
    console.log('Deleting Flashcards...');
    db.run('DELETE FROM Flashcards', handleError);
    
    console.log('Deleting NoteTags...');
    db.run('DELETE FROM NoteTags', handleError);
    
    console.log('Deleting Tags...');
    db.run('DELETE FROM Tags', handleError);
    
    console.log('Deleting Notes...');
    db.run('DELETE FROM Notes', handleError);
    
    console.log('Deleting Users...');
    db.run('DELETE FROM Users', handleError);
    
    // Commit transaction and close database
    db.run('COMMIT', (err) => {
      if (err) {
        console.error('Error committing transaction:', err);
        db.run('ROLLBACK');
        db.close();
        process.exit(1);
      }
      
      console.log('\n=== DATABASE CLEARED SUCCESSFULLY ===');
      
      // Get statistics on tables
      getTableCounts();
    });
  });
}

// Error handler for database operations
function handleError(err) {
  if (err) {
    console.error(`Error: ${err.message}`);
    db.run('ROLLBACK');
    db.close();
    process.exit(1);
  }
}

// Function to get count of rows in each table for verification
function getTableCounts() {
  const tables = ['Users', 'Notes', 'Tags', 'NoteTags', 'Flashcards', 'VerificationCodes'];
  
  console.log('\n=== TABLE STATISTICS ===');
  
  let completed = 0;
  tables.forEach(table => {
    db.get(`SELECT COUNT(*) as count FROM ${table}`, (err, result) => {
      if (err) {
        console.error(`Error getting count for ${table}: ${err.message}`);
      } else {
        console.log(`${table}: ${result.count} rows`);
      }
      
      completed++;
      if (completed === tables.length) {
        // Close the database connection when all queries are complete
        db.close(() => {
          console.log('\nDatabase connection closed');
          console.log('Done!');
        });
      }
    });
  });
}

// Handle any cleanup when the script is interrupted
process.on('SIGINT', () => {
  console.log('\nProcess interrupted');
  db.close();
  process.exit(0);
}); 