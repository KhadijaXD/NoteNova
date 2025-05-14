const axios = require('axios');

async function testRegistration() {
  try {
    console.log("Testing registration API...");
    
    const username = "testapi_" + Date.now();
    const email = `testapi_${Date.now()}@example.com`;
    const password = "password123";
    
    console.log(`Attempting to register with: 
      Username: ${username}
      Email: ${email}
      Password: ${password}`);
    
    const response = await axios.post('http://localhost:5001/api/auth/register', {
      username,
      email,
      password
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log("Registration successful:", response.data);
    return response.data;
  } catch (error) {
    console.error("Registration failed:");
    
    if (error.response) {
      // The server responded with a status code outside the 2xx range
      console.error("Status:", error.response.status);
      console.error("Data:", error.response.data);
      console.error("Headers:", error.response.headers);
    } else if (error.request) {
      // The request was made but no response was received
      console.error("No response received:", error.request);
    } else {
      // Something happened in setting up the request
      console.error("Error:", error.message);
    }
    
    throw error;
  }
}

testRegistration()
  .then(result => {
    console.log("Test completed successfully with result:", result);
    process.exit(0);
  })
  .catch(err => {
    console.error("Test failed.");
    process.exit(1);
  }); 