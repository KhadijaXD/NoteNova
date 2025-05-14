require('dotenv').config();
const { OpenAI } = require('openai');

// OpenRouter API configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_REFERER = "http://localhost:3000";
const OPENROUTER_SITE_NAME = "NoteNova";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

console.log('Testing OpenRouter API...');
console.log('API Key present:', !!OPENROUTER_API_KEY);
console.log('Testing with model:', OPENROUTER_MODEL);

// Initialize OpenAI client with OpenRouter base URL
const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": OPENROUTER_REFERER,
    "X-Title": OPENROUTER_SITE_NAME
  }
});

async function testOpenRouter() {
  try {
    console.log('Sending request to OpenRouter API...');
    const completion = await openai.chat.completions.create({
      model: OPENROUTER_MODEL,
      messages: [
        {
          role: "user",
          content: "Please summarize the concept of neural networks in 2-3 sentences."
        }
      ],
      max_tokens: 1000,
      temperature: 0.5,
      top_p: 0.9,
      headers: {
        "HTTP-Referer": OPENROUTER_REFERER,
        "X-Title": OPENROUTER_SITE_NAME
      }
    });
    
    if (completion.choices && completion.choices.length > 0) {
      console.log('OpenRouter API Response:');
      console.log(completion.choices[0].message.content);
      console.log('\nAPI test successful!');
    } else {
      console.error('Invalid response format from OpenRouter API');
    }
  } catch (error) {
    console.error('Error calling OpenRouter API:', error.message);
    console.error('Error details:', error);
  }
}

testOpenRouter(); 