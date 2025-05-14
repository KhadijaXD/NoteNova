// Clear files script 
// This script will delete all uploaded files and reset directories

const fs = require('fs');
const path = require('path');

// Directories to clean
const directories = [
  'uploads',
  'notes'
];

console.log('\n=== CLEARING FILES ===');

// Process each directory
directories.forEach(dirName => {
  const dirPath = path.join(__dirname, dirName);
  
  // Check if directory exists
  if (fs.existsSync(dirPath)) {
    console.log(`\nClearing ${dirPath}...`);
    
    try {
      // Get all files in the directory
      const files = fs.readdirSync(dirPath);
      
      // Delete each file
      let deletedCount = 0;
      files.forEach(file => {
        const filePath = path.join(dirPath, file);
        
        // Check if it's a file (not a directory)
        if (fs.statSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      });
      
      console.log(`Deleted ${deletedCount} files from ${dirName}/`);
    } catch (err) {
      console.error(`Error clearing ${dirName}/: ${err.message}`);
    }
  } else {
    console.log(`Creating ${dirName}/ directory (doesn't exist)`);
    // Create directory if it doesn't exist
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (err) {
      console.error(`Error creating ${dirName}/ directory: ${err.message}`);
    }
  }
});

console.log('\n=== CLEANUP COMPLETE ===');
console.log('All user files have been removed and directories reset.'); 