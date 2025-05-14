const db = require('./db');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function createTestUser() {
  try {
    console.log('Creating test user...');
    
    // Check if user already exists
    const existingUser = await db.getUserByEmail('test@example.com');
    
    if (existingUser) {
      console.log('Test user already exists with id:', existingUser.id);
      return existingUser;
    }
    
    // Create new user
    const user = await db.createUser(
      'Test User',
      'test@example.com',
      'password123'
    );
    
    console.log('Created test user with id:', user.id);
    return user;
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  }
}

async function migrateJsonData(userId) {
  const notesDir = path.join(__dirname, 'notes');
  
  if (!fs.existsSync(notesDir)) {
    console.log('No notes directory found, skipping migration');
    return;
  }
  
  try {
    const noteFiles = fs.readdirSync(notesDir);
    
    if (noteFiles.length === 0) {
      console.log('No notes found to migrate');
      return;
    }
    
    console.log(`Found ${noteFiles.length} potential notes to migrate`);
    
    // Count migrated notes
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const file of noteFiles) {
      if (file.endsWith('.json')) {
        try {
          const noteData = fs.readFileSync(path.join(notesDir, file), 'utf8');
          const note = JSON.parse(noteData);
          
          // Create note in SQL database
          await db.createNote({
            title: note.title,
            content: note.content || '',
            summary: note.summary || '',
            tags: note.tags || [],
            flashcards: note.flashcards || []
          }, userId);
          
          console.log(`Migrated note: ${note.title}`);
          migratedCount++;
        } catch (error) {
          console.error(`Error migrating note file ${file}:`, error);
          errorCount++;
        }
      }
    }
    
    console.log('Migration completed:');
    console.log(`- Successfully migrated: ${migratedCount} notes`);
    console.log(`- Failed to migrate: ${errorCount} notes`);
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

async function main() {
  try {
    // Create test user
    const user = await createTestUser();
    
    // Ask for confirmation before migrating
    rl.question(`Are you sure you want to migrate notes to user ID ${user.id}? (yes/no) `, async (answer) => {
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        await migrateJsonData(user.id);
        console.log('Migration completed successfully.');
      } else {
        console.log('Migration aborted.');
      }
      
      // Close database connection
      process.exit(0);
    });
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
main(); 