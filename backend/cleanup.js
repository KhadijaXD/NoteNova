// Master cleanup script
// This will clear the database and remove all user files

console.log('=== NOTENOVA CLEANUP UTILITY ===');
console.log('This will delete all users, notes, and files from your NoteNova installation');
console.log('Starting cleanup process...\n');

// Run the commands in sequence
const { execSync } = require('child_process');

try {
  // Step 1: Clear files first (in case any are referenced in the database)
  console.log('\n[STEP 1] Clearing files...\n');
  execSync('node clear-files.js', { stdio: 'inherit' });
  
  // Step 2: Clear database
  console.log('\n[STEP 2] Clearing database...\n');
  execSync('node clear-database.js', { stdio: 'inherit' });
  
  // All done
  console.log('\n=== CLEANUP COMPLETE ===');
  console.log('Your NoteNova installation has been reset.');
  console.log('You can now restart the server and create new accounts.');
} catch (error) {
  console.error('\n=== ERROR ===');
  console.error('An error occurred during cleanup:');
  console.error(error.message);
  process.exit(1);
} 