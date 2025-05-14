/**
 * Helper script to load environment variables in Windows
 * 
 * This script should be run BEFORE the main server:
 * node load-env-windows.js && node server.js
 */

const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '.env');
const envPsFile = path.join(__dirname, '.env.ps1');

console.log('Current working directory:', __dirname);
console.log('.env file exists:', fs.existsSync(envFile));
console.log('.env.ps1 file exists:', fs.existsSync(envPsFile));

// For direct hardcoding when all else fails
// process.env.JWT_SECRET = "8f4c91b7e5a3c7d2f8e90a6b1c5d2e7f3a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5";
process.env.SESSION_SECRET = "e7d3f8a2c9b5e6d1f3a7c8b4e5d2a9f6c3b8e5d7a2f4c9b3e6d1a8f5c2b7e4";

// Check if .env exists
if (!fs.existsSync(envFile) && fs.existsSync(envPsFile)) {
  console.log('Creating .env file from .env.ps1');
  
  try {
    const psContent = fs.readFileSync(envPsFile, 'utf8');
    console.log('.env.ps1 content length:', psContent.length);
    console.log('.env.ps1 content sample:', psContent.substring(0, 50));
    
    let envContent = '';
    
    // Process each line manually
    const lines = psContent.split('\n');
    for (const line of lines) {
      console.log(`Processing line: ${line}`);
      
      if (line.trim().startsWith('#')) {
        envContent += line + '\n';
        continue;
      }
      
      // Match $env:KEY="VALUE"
      if (line.includes('$env:') && line.includes('=')) {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const key = parts[0].replace('$env:', '').trim();
          let value = parts[1].trim();
          
          // Remove quotes if present
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          }
          
          console.log(`Setting ${key}=${value.substring(0, 3)}...`);
          envContent += `${key}=${value}\n`;
          
          // Also set in current process
          process.env[key] = value;
        }
      } else {
        envContent += line + '\n';
      }
    }
    
    fs.writeFileSync(envFile, envContent);
    console.log('.env file created successfully');
  } catch (error) {
    console.error('Error creating .env file:', error);
  }
}

console.log('Environment variables check:');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not set');
console.log('- SESSION_SECRET:', process.env.SESSION_SECRET ? 'Set' : 'Not set');
console.log('- OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? 'Set' : 'Not set'); 