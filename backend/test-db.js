const db = require('./db');

async function testCreateUser() {
  try {
    console.log("Attempting to create a test user...");
    
    const username = "testuser_" + Date.now();
    const email = `test_${Date.now()}@example.com`;
    const password = "password123";
    
    const user = await db.createUser(username, email, password);
    console.log("User created successfully:", user);
    
    return user;
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}

testCreateUser()
  .then(user => {
    console.log("Test completed successfully with user:", user);
    process.exit(0);
  })
  .catch(err => {
    console.error("Test failed with error:", err);
    process.exit(1);
  }); 