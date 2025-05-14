require('dotenv').config();

console.log("Checking environment variables:");
console.log("---------------------------------");
console.log("JWT_SECRET:", process.env.JWT_SECRET || "Not set");
console.log("SESSION_SECRET:", process.env.SESSION_SECRET || "Not set");
console.log("OPENROUTER_API_KEY:", process.env.OPENROUTER_API_KEY ? "Set (value hidden)" : "Not set");
console.log("OPENAI_API_KEY:", process.env.OPENAI_API_KEY ? "Set (value hidden)" : "Not set");
console.log("OPENROUTER_REFERER:", process.env.OPENROUTER_REFERER || "Not set");
console.log("OPENROUTER_SITE_NAME:", process.env.OPENROUTER_SITE_NAME || "Not set");
console.log("PORT:", process.env.PORT || "Not set");
console.log("NODE_ENV:", process.env.NODE_ENV || "Not set");
console.log("---------------------------------");

// Check if .env file exists
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');

console.log("\nChecking for .env file:");
console.log("---------------------------------");
console.log(".env file exists:", fs.existsSync(envPath) ? "Yes" : "No");
if (fs.existsSync(envPath)) {
  console.log(".env file content (first line):");
  const content = fs.readFileSync(envPath, 'utf8');
  console.log(content.split('\n')[0]);
}
console.log("---------------------------------"); 