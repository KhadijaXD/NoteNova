// Fix user password
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

// Open the database
const db = new sqlite3.Database('notes.db');

// User to update
const email = 'khadijalahore90@gmail.com';
const newPassword = 'test123';

// Generate password hash
bcrypt.hash(newPassword, 10, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    db.close();
    return;
  }
  
  // Update user password
  db.run(
    'UPDATE Users SET password_hash = ? WHERE email = ?',
    [hash, email],
    function(err) {
      if (err) {
        console.error('Error updating password:', err);
      } else {
        console.log(Password updated for );
        console.log('Affected rows:', this.changes);
        console.log('You can now login with:');
        console.log(Email: );
        console.log(Password: );
      }
      db.close();
    }
  );
});
