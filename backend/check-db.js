const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./notes.db');

console.log('Checking users and notes in the database...');

db.all('SELECT id, email FROM Users', [], (err, users) => {
  if (err) {
    console.error('Users error:', err);
    db.close();
    return;
  }
  console.log('\nUsers:');
  console.table(users);

  db.all('SELECT id, title, user_id FROM Notes', [], (err, notes) => {
    if (err) {
      console.error('Notes error:', err);
      db.close();
      return;
    }
    console.log('\nNotes:');
    console.table(notes);
    db.close();
  });
}); 