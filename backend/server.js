// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');
const bodyParser = require('body-parser');
const axios = require('axios');
const mammoth = require('mammoth');
const passport = require('passport');
const session = require('express-session');
const { OpenAI } = require('openai');

// Import database and authentication modules
const db = require('./db');
const auth = require('./auth');

const app = express();
const port = process.env.PORT || 5001;

// Global cache for Ollama availability to prevent multiple checks
let ollamaAvailabilityCache = {
  available: true, // Set to true since we're using OpenRouter API instead of local Ollama
  lastChecked: Date.now(), 
  checkInterval: 5 * 60 * 1000 // Check again after 5 minutes
};

// Add this near the top of the file with other global variables
const flashcardCache = new Map(); // Cache for generated flashcards

// OpenRouter API configuration
const OPENROUTER_REFERER = process.env.OPENROUTER_REFERER || "http://localhost:3000";
const OPENROUTER_SITE_NAME = process.env.OPENROUTER_SITE_NAME || "NoteNova";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

// Debug configuration 
console.log('OpenRouter configuration:');
console.log('Referer:', OPENROUTER_REFERER);
console.log('Site name:', OPENROUTER_SITE_NAME);
console.log('Model:', OPENROUTER_MODEL);

// Create direct axios instance for OpenRouter
const openRouterClient = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': OPENROUTER_REFERER,
    'X-Title': OPENROUTER_SITE_NAME
  },
  timeout: 60000 // 60 seconds timeout
});

// Direct function to communicate with OpenRouter API
async function callOpenRouter(messages, maxTokens = 1000, temperature = 0.7) {
  try {
    const response = await openRouterClient.post('/chat/completions', {
      model: OPENROUTER_MODEL,
      messages: messages,
      max_tokens: maxTokens,
      temperature: temperature
    });
    
    if (response.data && 
        response.data.choices && 
        response.data.choices.length > 0 && 
        response.data.choices[0].message) {
      return response.data.choices[0].message.content;
    }
    // Log the full response for debugging
    console.error('OpenRouter API returned unexpected format:', JSON.stringify(response.data, null, 2));
    // If the API returned an error message, surface it
    if (response.data && response.data.error) {
      throw new Error('OpenRouter API error: ' + response.data.error.message);
    }
    throw new Error('Invalid response format from OpenRouter API. Full response: ' + JSON.stringify(response.data));
  } catch (error) {
    // If the error is an Axios error with a response, log the full response
    if (error.response) {
      console.error('OpenRouter API error response:', JSON.stringify(error.response.data, null, 2));
      if (error.response.data && error.response.data.error) {
        throw new Error('OpenRouter API error: ' + error.response.data.error.message);
      }
    }
    console.error('OpenRouter API error:', error.message);
    throw error;
  }
}

// Function to check if OpenRouter API is available
async function getOllamaAvailability() {
  try {
    const response = await openRouterClient.get('/models');
    if (response.status === 200) {
      console.log('OpenRouter API is available');
      // Verify our model is available
      const models = response.data.data || [];
      const modelExists = models.some(model => model.id === OPENROUTER_MODEL || model.id.includes('llama'));
      if (!modelExists) {
        console.warn('Requested model not found, but other models are available');
      }
      return true;
    }
    return false;
  } catch (error) {
    console.error('OpenRouter API test failed:', error.message);
    return false;
  }
}

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Set up session - needed for passport
app.use(session({
  secret: 'e7d3f8a2c9b5e6d1f3a7c8b4e5d2a9f6c3b8e5d7a2f4c9b3e6d1a8f5c2b7e4',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Initialize passport
app.use(passport.initialize());

// Storage configuration for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // Accept PDFs and text files
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'text/plain' ||
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format. Please upload PDF or text files.'), false);
    }
  }
});

// Create 'notes' directory for storing processed notes if it doesn't exist
const notesDir = path.join(__dirname, 'notes');
if (!fs.existsSync(notesDir)) {
  fs.mkdirSync(notesDir, { recursive: true });
}

// In-memory database (replace with IndexedDB in frontend)
let notesDatabase = [];

// Load existing notes from the filesystem when the server starts
try {
  const noteFiles = fs.readdirSync(notesDir);
  for (const file of noteFiles) {
    if (file.endsWith('.json')) {
      const noteData = fs.readFileSync(path.join(notesDir, file), 'utf8');
      try {
        const note = JSON.parse(noteData);
        notesDatabase.push(note);
      } catch (error) {
        console.error(`Error parsing note file ${file}:`, error);
      }
    }
  }
  console.log(`Loaded ${notesDatabase.length} notes from filesystem`);
} catch (error) {
  console.error('Error loading notes from filesystem:', error);
}

// Helper function to extract text from PDF
async function extractTextFromPDF(pdfPath) {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}

// Helper function to extract text from DOCX
async function extractTextFromDOCX(docxPath) {
  try {
    // Use convertToHtml instead of extractRawText to preserve images and formatting
    const result = await mammoth.convertToHtml({
      path: docxPath
    }, {
      convertImage: mammoth.images.imgElement(function(image) {
        return image.read("base64").then(function(imageBuffer) {
          // Create data URL for the image
          return {
            src: `data:${image.contentType};base64,${imageBuffer}`
          };
        });
      })
    });
    
    // Log any warnings for debugging
    if (result.messages.length > 0) {
      console.log("Mammoth conversion warnings:", result.messages);
    }
    
    return result.value; // This now contains HTML with embedded images
  } catch (error) {
    console.error("Error extracting content from DOCX:", error);
    throw new Error(`Failed to extract content from DOCX: ${error.message}`);
  }
}

// Helper function to perform OCR on images
async function performOCR(imagePath) {
  try {
    const { data } = await Tesseract.recognize(imagePath, 'eng');
    return data.text;
  } catch (error) {
    console.error("Error performing OCR:", error);
    throw new Error(`OCR processing failed: ${error.message}`);
  }
}

// Helper function to generate tags using NLP
function generateTags(text) {
  const commonTags = [
    { tag: 'computer science', keywords: ['algorithm', 'programming', 'code', 'data structure', 'software', 'database', 'web', 'network'] },
    { tag: 'biology', keywords: ['cell', 'organism', 'species', 'evolution', 'dna', 'rna', 'protein', 'gene', 'ecology'] },
    { tag: 'chemistry', keywords: ['reaction', 'molecule', 'atom', 'compound', 'element', 'periodic', 'acid', 'base', 'organic'] },
    { tag: 'physics', keywords: ['force', 'energy', 'motion', 'quantum', 'relativity', 'particle', 'wave', 'mechanics', 'thermodynamics'] },
    { tag: 'mathematics', keywords: ['equation', 'theorem', 'proof', 'calculus', 'algebra', 'geometry', 'statistics', 'probability'] },
    { tag: 'history', keywords: ['war', 'revolution', 'century', 'ancient', 'medieval', 'empire', 'civilization', 'president', 'king'] },
    { tag: 'literature', keywords: ['novel', 'poem', 'author', 'character', 'theme', 'plot', 'narrative', 'essay', 'fiction'] },
    { tag: 'psychology', keywords: ['behavior', 'cognitive', 'therapy', 'mental', 'emotion', 'brain', 'consciousness', 'development'] },
    { tag: 'economics', keywords: ['market', 'price', 'demand', 'supply', 'inflation', 'gdp', 'economy', 'trade', 'fiscal'] },
    { tag: 'philosophy', keywords: ['ethics', 'metaphysics', 'epistemology', 'logic', 'existentialism', 'knowledge', 'reality'] },
    { tag: 'art', keywords: ['painting', 'sculpture', 'artist', 'museum', 'gallery', 'composition', 'aesthetic', 'visual'] },
    { tag: 'music', keywords: ['song', 'rhythm', 'melody', 'harmony', 'composer', 'instrument', 'chord', 'scale', 'tempo'] },
    { tag: 'medicine', keywords: ['disease', 'treatment', 'symptom', 'diagnosis', 'patient', 'hospital', 'drug', 'surgery'] },
    { tag: 'environmental science', keywords: ['climate', 'ecosystem', 'pollution', 'conservation', 'sustainability', 'renewable'] },
    { tag: 'astronomy', keywords: ['planet', 'star', 'galaxy', 'universe', 'cosmic', 'solar', 'telescope', 'orbit', 'nebula'] },
    { tag: 'geology', keywords: ['rock', 'mineral', 'earthquake', 'volcano', 'plate', 'tectonic', 'sediment', 'erosion'] },
    { tag: 'political science', keywords: ['government', 'policy', 'election', 'democracy', 'constitution', 'law', 'rights'] },
    { tag: 'sociology', keywords: ['society', 'culture', 'social', 'class', 'inequality', 'gender', 'race', 'ethnicity'] },
    { tag: 'anthropology', keywords: ['culture', 'ritual', 'tradition', 'kinship', 'ethnography', 'archaeology', 'tribe'] },
    { tag: 'linguistics', keywords: ['language', 'grammar', 'syntax', 'semantics', 'phonetics', 'dialect', 'morphology'] },
    { tag: 'education', keywords: ['learning', 'teaching', 'student', 'school', 'curriculum', 'assessment', 'pedagogy'] },
    { tag: 'computer network', keywords: ['tcp', 'ip', 'protocol', 'router', 'packet', 'ethernet', 'wifi', 'lan', 'wan'] },
    { tag: 'data science', keywords: ['machine learning', 'ai', 'neural network', 'data mining', 'big data', 'analytics'] },
    { tag: 'cybersecurity', keywords: ['encryption', 'authentication', 'firewall', 'malware', 'virus', 'hack', 'vulnerability'] },
    { tag: 'dna', keywords: ['gene', 'allele', 'chromosome', 'genome', 'nucleotide', 'mutation', 'helix', 'replication'] },
    { tag: 'cell', keywords: ['membrane', 'nucleus', 'mitochondria', 'organelle', 'cytoplasm', 'ribosome', 'golgi'] },
    { tag: 'algorithm', keywords: ['sorting', 'search', 'complexity', 'recursive', 'optimization', 'graph', 'tree', 'dynamic'] },
    { tag: 'database', keywords: ['sql', 'query', 'table', 'index', 'relational', 'nosql', 'schema', 'transaction', 'acid'] },
    { tag: 'acid', keywords: ['ph', 'base', 'proton', 'hydrogen', 'acidity', 'hydroxide', 'buffer', 'neutralization'] }
  ];
  
  // Convert to lowercase for case-insensitive matching
  const lowercaseText = text.toLowerCase();
  
  // Check for each tag by looking for its keywords
  const tags = [];
  
  for (const { tag, keywords } of commonTags) {
    // Count how many keywords match
    const matchCount = keywords.filter(keyword => 
      lowercaseText.includes(keyword.toLowerCase())
    ).length;
    
    // If at least 2 keywords match, add the tag
    // For shorter tags like "dna", "cell", we only require 1 match
    if ((keywords.length > 3 && matchCount >= 2) || 
        (keywords.length <= 3 && matchCount >= 1)) {
      tags.push(tag);
    }
  }
  
  return tags;
}

// Helper function to check if content is long enough for AI processing
function isContentSufficientForAI(text) {
  // Simple check for minimum content length
  if (!text || text.trim().length < 100) {
    return false;
  }
  return true;
}

// Helper function to generate summary using OpenRouter API
async function generateSummary(text, isOllamaRunning = null) {
  // If text is too short, just return a default message
  if (!isContentSufficientForAI(text)) {
    return 'No summary generated (content too short).';
  }
  
  // Try to generate summary with OpenRouter API
  let summary = '';
  
  try {
    console.log('Generating summary with OpenRouter API...');
    
    const prompt = `Write a concise 3-4 sentence summary of the main content and key findings in this document. Focus exclusively on the substantive information, core arguments, or primary conclusions.\n\nIMPORTANT: Do NOT begin with phrases like "Here is a summary" or "This document". Start directly with the key points.\n\nDocument:\n${text.slice(0, 4000)}`; // Limit to 4000 chars for the model
    
    console.log('Using OpenRouter model:', OPENROUTER_MODEL);
    
    // Using direct axios call instead of OpenAI client
    summary = await callOpenRouter([
      { role: "user", content: prompt }
    ], 1000, 0.5);
    
    // Remove any leading phrases like "Here is a summary..."
    summary = summary.replace(/^(here is|this is|this document provides|this summary presents|below is|following is).*?summary[^.]*\./i, '').trim();
    // Also remove phrases like "In summary," at the beginning
    summary = summary.replace(/^in summary,?\s*/i, '').trim();
    // Also remove phrases like "To summarize," at the beginning
    summary = summary.replace(/^to summarize,?\s*/i, '').trim();
    // Capitalize the first letter if needed
    if (summary.length > 0) {
      summary = summary.charAt(0).toUpperCase() + summary.slice(1);
    }
    
    console.log('Successfully generated summary with OpenRouter API');
  } catch (error) {
    console.error('Error generating summary with OpenRouter API:', error.message);
    console.error('Error details:', error);
    // If OpenRouter API fails, do not use fallback, just throw error
    throw new Error('Failed to generate summary with Meta: Llama 3.3 70B Instruct (free). Please try again later.');
  }
  
  return summary;
}

// Helper function for flashcard generation using OpenRouter API
async function generateFlashcardsWithLlama(noteContent, noteTitle, noteTags, isOllamaRunning = null, forceRegenerate = false) {
  // Check if content is sufficient
  if (!isContentSufficientForAI(noteContent)) {
    throw new Error('Content is too short for flashcard generation');
  }

  // Create a cache key based on the note content
  const cacheKey = Buffer.from(noteContent).toString('base64').substring(0, 50);
  
  // Check cache first (unless force regenerate is true)
  if (!forceRegenerate && flashcardCache.has(cacheKey)) {
    console.log('Using cached flashcards');
    return flashcardCache.get(cacheKey);
  }
  
  try {
    // Prepare a prompt for the OpenRouter API
    const tagsInfo = noteTags && noteTags.length > 0 
      ? `The note is tagged with: ${noteTags.join(', ')}.` 
      : '';
    
    // Using the user's suggested prompt
    const prompt = `Generate as many flashcards as possible from the following text. Each flashcard must have a clear question and a VERY CONCISE answer (preferably 1-2 sentences maximum). Focus on key facts, definitions, processes, or important concepts.\n\nIMPORTANT GUIDELINES:\n- Keep answers brief and to the point - no longer than 2 sentences when possible\n- Make each answer focused on a single concept or fact\n- Avoid lengthy explanations or examples\n- Questions should be specific and direct\n- Answers should be factual and precise\n\nPREFERRED FORMAT:\n[\n  {\n    "question": "What is X?",\n    "answer": "X is Y. It has properties Z."\n  },\n  ...\n]\n\nNote title: ${noteTitle || "Untitled Note"}\n${tagsInfo}\n\nContent:\n${noteContent.slice(0, 5000)}`; // Limit content length to avoid token limits
    
    console.log('Generating flashcards with OpenRouter API...');
    console.log('Using OpenRouter model:', OPENROUTER_MODEL);
    
    // First verify API availability with quick test
    const testResult = await getOllamaAvailability();
    if (!testResult) {
      throw new Error('OpenRouter API unavailable. Cannot generate flashcards.');
    }
    
    // Use direct axios request instead of OpenAI client
    const responseText = await callOpenRouter([
      { role: "user", content: prompt }
    ], 2000, 0.3);
    
    console.log('OpenRouter API flashcard response text:', responseText);
    
    // Extract flashcards from the response text
    const flashcards = extractFlashcardsFromResponse(responseText, noteTitle);
    
    if (flashcards.length > 0) {
      console.log(`Successfully extracted ${flashcards.length} flashcards`);
      
      // Convert the format to match what the frontend expects
      const formattedFlashcards = {
        notes: flashcards.map((card, index) => {
          // Clean up question text - remove any "Question:" prefix
          let question = card.question;
          if (question.includes("Question:")) {
            question = question.split("Question:")[1].trim();
          }
          
          // Clean up answer text - remove any "Answer:" prefix
          let answer = card.answer;
          if (answer.includes("Answer:")) {
            answer = answer.split("Answer:")[1].trim();
          }
          
          // Truncate overly long answers
          if (answer.length > 150) {
            // Try to find a sentence break
            const sentenceBreak = answer.indexOf('. ', 100);
            if (sentenceBreak > 0 && sentenceBreak < 150) {
              answer = answer.substring(0, sentenceBreak + 1);
            } else {
              // Just truncate at 150 chars if no good sentence break
              answer = answer.substring(0, 150) + '...';
            }
          }
          
          return {
            fields: {
              Front: question,
              Back: answer
            },
            tags: noteTags || []
          };
        })
      };
      
      // Cache the results
      flashcardCache.set(cacheKey, formattedFlashcards);
      
      return formattedFlashcards;
    }
    
    console.log('No valid flashcards returned from the model.');
    throw new Error('Failed to generate flashcards with Meta: Llama 3.3 70B Instruct (free). Please try again later.');
    
  } catch (error) {
    console.error('Error generating flashcards with OpenRouter API:', error.message);
    // Do not use fallback method, just throw error
    throw new Error('Failed to generate flashcards with Meta: Llama 3.3 70B Instruct (free). Please try again later.');
  }
}

// Helper function to extract main concept from a sentence
function extractMainConcept(sentence, title) {
  // Try to extract a noun phrase
  const nouns = sentence.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g) || [];
  
  for (const noun of nouns) {
    if (noun.length > 3 && !['The', 'This', 'That', 'These', 'Those'].includes(noun)) {
      return noun;
    }
  }
  
  // If we can't find a proper noun, look for important terms
  const words = sentence.split(' ');
  const longWords = words.filter(w => w.length > 6).map(w => w.replace(/[^\w]/g, ''));
  
  if (longWords.length > 0) {
    return longWords[0];
  }
  
  // Default to the title or part of the sentence
  return title || sentence.substring(0, 20) + '...';
}

// Helper function to extract main topic as best as possible
function extractMainTopic(content, title) {
  if (title && title.length > 3 && !title.match(/^[0-9\s]+$/)) {
    return title;
  }
  
  // Try to extract from first paragraph
  const firstPara = content.split(/\n\s*\n/)[0] || '';
  const cleanPara = firstPara.replace(/<[^>]*>/g, '').trim();
  
  if (cleanPara.length > 20) {
    return cleanPara.substring(0, 100) + (cleanPara.length > 100 ? '...' : '');
  }
  
  // Fallback
  return "Review the full note content to understand the main topic.";
}

// Helper function to extract key concepts
function extractKeyConcepts(content, title) {
  const conceptList = [];
  
  // Try to get concepts from headers
  const headerMatches = content.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/g);
  if (headerMatches && headerMatches.length > 0) {
    for (const headerMatch of headerMatches.slice(0, 3)) {
      const headerText = headerMatch.replace(/<[^>]*>/g, '').trim();
      if (headerText && headerText.length > 3) {
        conceptList.push(headerText);
      }
    }
  }
  
  // Try to get concepts from bold/strong text
  const boldMatches = content.match(/<strong>(.*?)<\/strong>|<b>(.*?)<\/b>|\*\*(.*?)\*\*/g);
  if (boldMatches && boldMatches.length > 0) {
    for (const boldMatch of boldMatches.slice(0, 5)) {
      const boldText = boldMatch.replace(/<[^>]*>/g, '').replace(/\*\*/g, '').trim();
      if (boldText && boldText.length > 3 && !conceptList.includes(boldText)) {
        conceptList.push(boldText);
      }
    }
  }
  
  if (conceptList.length > 0) {
    return `Key concepts include: ${conceptList.join(', ')}.`;
  }
  
  // Fallback
  return "Review the note in detail to identify and understand the key concepts covered.";
}

// Helper function to extract flashcards from the model response
function extractFlashcardsFromResponse(text, noteTitle) {
  let flashcards = [];
  console.log('Extracting flashcards from text length:', text.length);
  
  // Try to extract JSON array first (ideal case)
  try {
    const jsonMatch = text.match(/\[[\s\S]*?\]/g);
    if (jsonMatch && jsonMatch.length > 0) {
      // Try parsing each JSON array found (might be multiple in sectioned response)
      for (const extractedJson of jsonMatch) {
        try {
          const parsedCards = JSON.parse(extractedJson);
          
          if (Array.isArray(parsedCards) && parsedCards.length > 0 && 
              parsedCards.every(card => card.question && card.answer)) {
            // Filter out generic "Flashcard X?" type questions
            const validCards = parsedCards.filter(card => 
              !card.question.match(/^flashcard\s+\d+\??$/i) && 
              card.question.length > 5
            );
            
            if (validCards.length > 0) {
              console.log(`Successfully extracted ${validCards.length} JSON flashcards`);
              return validCards;
            }
          }
        } catch (parseErr) {
          // Continue to the next match if one fails
          console.log(`JSON parse error on match: ${parseErr.message}`);
        }
      }
    }
  } catch (e) {
    console.log('JSON extraction failed, trying alternative methods');
  }
  
  // Try to extract from sectioned format with JSON embedded in each section
  if (text.includes('**Section') && text.includes('{')) {
    console.log('Trying section-with-json extraction');
    
    const sectionPattern = /\*\*Section.*?\*\*[\s\n]*([\s\S]*?)(?=\*\*Section|$)/g;
    const sectionMatches = [...text.matchAll(sectionPattern)];
    
    if (sectionMatches && sectionMatches.length > 0) {
      for (const sectionMatch of sectionMatches) {
        const sectionContent = sectionMatch[1];
        
        // Look for JSON objects in the section
        const jsonObjectPattern = /\d+\.\s*({[\s\S]*?})/g;
        const jsonObjects = [...sectionContent.matchAll(jsonObjectPattern)];
        
        for (const jsonObj of jsonObjects) {
          try {
            const card = JSON.parse(jsonObj[1]);
            if (card.question && card.answer) {
              flashcards.push(card);
            }
          } catch (e) {
            // Continue if one object fails
          }
        }
      }
      
      if (flashcards.length > 0) {
        console.log(`Successfully extracted ${flashcards.length} sectioned JSON flashcards`);
        return flashcards;
      }
    }
  }
  
  // New pattern for formatted numbered flashcards with sections (like in the example response)
  // This pattern matches items like "1. **What is X?** * Answer text" 
  const sectionPattern = /(\d+\.\s+\*\*.*?\*\*[\s\n]*[\*•].*?)(?=\d+\.\s+\*\*|$)/gs;
  const sectionMatches = [...text.matchAll(sectionPattern)];
  
  if (sectionMatches && sectionMatches.length > 0) {
    console.log(`Found ${sectionMatches.length} section-style flashcards`);
    
    for (const match of sectionMatches) {
      const cardText = match[1].trim();
      // Extract question (between ** **)
      const questionMatch = cardText.match(/\d+\.\s+\*\*(.*?)\*\*/);
      // Extract answer (after the bullet point)
      const answerMatch = cardText.match(/[\*•](.*?)$/s);
      
      if (questionMatch && answerMatch) {
        const question = questionMatch[1].trim();
        const answer = answerMatch[1].trim();
        
        if (question.length > 3 && answer.length > 3) {
          flashcards.push({
            question: question,
            answer: answer
          });
        }
      }
    }
    
    if (flashcards.length > 0) return flashcards;
  }
  
  // Try to extract numbered Q/A pairs (common format from LLMs)
  const numberedFormat = /(\d+[\.\)]\s+(?:\*\*)?.*?(?:\*\*)?)(?:\s*[\*\-•])?\s*(.*?)(?=\d+[\.\)]|$)/gs;
  const numberedMatches = [...text.matchAll(numberedFormat)];
  
  if (numberedMatches && numberedMatches.length > 0) {
    console.log(`Found ${numberedMatches.length} numbered-style flashcards`);
    
    for (const match of numberedMatches) {
      // Clean up the question (remove numbers, asterisks)
      const rawQuestion = match[1].trim();
      const question = rawQuestion
        .replace(/^\d+[\.\)]\s+/, '') // Remove numbering
        .replace(/\*\*/g, '')         // Remove markdown bold
        .trim();
      
      // Clean up the answer
      const answer = match[2].trim();
      
      if (question.length > 3 && question.includes('?') && answer.length > 3) {
        flashcards.push({
          question: question,
          answer: answer
        });
      }
    }
    
    if (flashcards.length > 0) return flashcards;
  }
  
  // Try to extract Q&A style entries in the format "What is X? X is Y."
  const qaRegex = /([^.!?]+\?)\s*([^?]+?)(?=\n|$|[A-Z][^.!?]+\?)/g;
  const qaMatches = [...text.matchAll(qaRegex)];
  
  if (qaMatches && qaMatches.length > 0) {
    console.log(`Found ${qaMatches.length} Q&A-style flashcards`);
    
    for (const match of qaMatches) {
      const question = match[1].trim();
      const answer = match[2].trim();
      
      if (question.length > 5 && answer.length > 3) {
        flashcards.push({
          question: question,
          answer: answer
        });
      }
    }
    
    if (flashcards.length > 0) return flashcards;
  }

  // Try multi-line format with "Question:" and "Answer:" prefixes
  const multiLineFormat = /(?:Question|Q):\s*(.*?)\s*(?:Answer|A):\s*(.*?)(?=(?:Question|Q):|$)/gis;
  const multiLineMatches = [...text.matchAll(multiLineFormat)];
  
  if (multiLineMatches && multiLineMatches.length > 0) {
    console.log(`Found ${multiLineMatches.length} explicit Q/A format flashcards`);
    
    for (const match of multiLineMatches) {
      const question = match[1].trim();
      const answer = match[2].trim();
      
      if (question.length > 3 && answer.length > 3) {
        flashcards.push({
          question: question,
          answer: answer
        });
      }
    }
    
    if (flashcards.length > 0) return flashcards;
  }
  
  // Advanced matching for section-based content (like in our example)
  if (text.includes('Section') && text.includes('**')) {
    console.log('Trying section-based extraction');
    
    // Match questions and bullet point answers in sections
    const sectionItems = text.split(/\d+\.\s+\*\*/);
    for (let i = 1; i < sectionItems.length; i++) { // Start at 1 to skip header
      const item = sectionItems[i];
      if (!item) continue;
      
      const questionMatch = item.match(/(.*?)\*\*/);
      if (questionMatch) {
        const question = questionMatch[1].trim();
        
        // Find the bullet point content
        const bulletMatch = item.match(/\*\s+(.*?)(?=\n\d+\.|$)/s);
        if (bulletMatch) {
          const answer = bulletMatch[1].trim();
          
          if (question.length > 3 && answer.length > 3) {
            flashcards.push({
              question: question,
              answer: answer
            });
          }
        }
      }
    }
    
    if (flashcards.length > 0) return flashcards;
  }
  
  // Try to extract from numbered items in a format like "1. { "question": "...", "answer": "..." }"
  // This is a common pattern in OpenRouter AI responses with multiple sections
  if (text.includes('{') && text.match(/\d+\.\s*\{/)) {
    console.log('Trying numbered-object extraction');
    
    const numberObjectPattern = /\d+\.\s*(\{[\s\S]*?\})/g;
    const objectMatches = [...text.matchAll(numberObjectPattern)];
    
    if (objectMatches && objectMatches.length > 0) {
      for (const match of objectMatches) {
        try {
          const jsonObj = JSON.parse(match[1]);
          if (jsonObj.question && jsonObj.answer) {
            flashcards.push({
              question: jsonObj.question,
              answer: jsonObj.answer
            });
          }
        } catch (e) {
          // Skip this item if JSON parsing fails
          console.log(`Failed to parse JSON object: ${e.message}`);
        }
      }
      
      if (flashcards.length > 0) {
        console.log(`Successfully extracted ${flashcards.length} numbered JSON objects`);
        return flashcards;
      }
    }
  }
  
  // If all extraction methods fail, create at least one default flashcard
  if (flashcards.length === 0) {
    console.log('All extraction methods failed, using default flashcard');
    flashcards.push({
      question: `What is the main topic of "${noteTitle || 'this note'}"?`,
      answer: "Review the note content for the main topic."
    });
  }
  
  return flashcards;
}

// Authentication routes
app.use('/api/auth', auth.router);

// Protected API routes
// Notes endpoint
app.get('/api/notes', auth.authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const notes = await db.getNotes(userId);
    res.json(notes);
  } catch (error) {
    console.error('Error fetching notes:', error);
    res.status(500).json({ message: 'Failed to fetch notes', error: error.message });
  }
});

app.get('/api/notes/:id', auth.authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const noteId = req.params.id;
    const note = await db.getNoteById(noteId, userId);
    
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    res.json(note);
  } catch (error) {
    console.error('Error fetching note:', error);
    res.status(500).json({ message: 'Failed to fetch note', error: error.message });
  }
});

app.post('/api/notes', auth.authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, content, summary, tags } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }
    
    // Create a new note with explicit timestamp
    const currentTime = new Date().toISOString();
    const note = await db.createNote({
      title,
      content,
      summary: summary || await generateSummary(content),
      tags: tags || generateTags(content),
      created_at: currentTime,
      updated_at: currentTime
    }, userId);
    
    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({ message: 'Failed to create note', error: error.message });
  }
});

app.put('/api/notes/:id', auth.authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const noteId = req.params.id;
    const { title, content, summary, tags } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }
    
    // Update the note with explicit timestamp
    const currentTime = new Date().toISOString();
    const note = await db.updateNote(noteId, {
      title,
      content,
      summary: summary || await generateSummary(content),
      tags: tags || generateTags(content),
      updated_at: currentTime
    }, userId);
    
    res.json(note);
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ message: 'Failed to update note', error: error.message });
  }
});

app.delete('/api/notes/:id', auth.authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const noteId = req.params.id;
    
    await db.deleteNote(noteId, userId);
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ message: 'Failed to delete note', error: error.message });
  }
});

// Tags endpoint
app.get('/api/tags', auth.authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const tags = await db.getAllTags(userId);
    res.json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ message: 'Failed to fetch tags', error: error.message });
  }
});

// Search endpoint
app.get('/api/search', auth.authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const { q, tags } = req.query;
    
    console.log('DEBUG: Search endpoint called with query params:', req.query);
    
    const tagArray = tags ? tags.split(',') : [];
    console.log('DEBUG: Parsed tag array:', tagArray);
    
    const notes = await db.searchNotes(q, tagArray, userId);
    console.log('DEBUG: Search endpoint returning', notes.length, 'notes');
    
    res.json(notes);
  } catch (error) {
    console.error('Error searching notes:', error);
    res.status(500).json({ message: 'Search failed', error: error.message });
  }
});

// File upload endpoint
app.post('/api/upload', auth.authenticateJWT, upload.single('file'), async (req, res) => {
  try {
    const userId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    let extractedText = '';
    let fileType = '';
    
    // Extract text based on file type
    if (req.file.mimetype === 'application/pdf') {
      extractedText = await extractTextFromPDF(filePath);
      fileType = 'PDF';
    } else if (req.file.mimetype === 'text/plain') {
      extractedText = fs.readFileSync(filePath, 'utf8');
      fileType = 'Text';
    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      extractedText = await extractTextFromDOCX(filePath);
      fileType = 'DOCX';
    }
    
    // Generate title from filename
    const originalName = req.file.originalname;
    const title = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    
    // Generate summary
    const summary = await generateSummary(extractedText);
    
    // Generate tags
    const tags = generateTags(extractedText);
    
    // Create note with extracted content
    const note = await db.createNote({
      title,
      content: extractedText,
      summary,
      tags
    }, userId);
    
    // Cleanup the temporary file
    fs.unlinkSync(filePath);
    
    res.status(201).json({
      message: `Successfully processed ${fileType} file`,
      note
    });
  } catch (error) {
    console.error('Error processing uploaded file:', error);
    
    // Clean up the file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ message: 'Failed to process file', error: error.message });
  }
});

// Flashcards endpoint - supports viewing without regeneration
app.get('/api/notes/:id/flashcards/:cardId?', auth.authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const noteId = req.params.id;
    // Always set skipGeneration to true for GET requests to prevent unwanted regeneration
    const skipGeneration = true; 
    
    // Check if note exists and belongs to user
    const note = await db.getNoteById(noteId, userId);
    
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    // Get flashcards from database
    const flashcards = await db.getFlashcardsForNote(noteId);
    
    // If flashcards exist, return them
    if (flashcards && flashcards.notes && flashcards.notes.length > 0) {
      console.log('Found existing flashcards in database:', flashcards);
      
      // If requesting a specific card for the study interface
      if (req.params.cardId) {
        const cardIndex = parseInt(req.params.cardId, 10);
        if (!isNaN(cardIndex) && cardIndex >= 0 && cardIndex < flashcards.notes.length) {
          return res.json({
            card: flashcards.notes[cardIndex],
            total: flashcards.notes.length,
            currentIndex: cardIndex
          });
        }
      }
      
      return res.json(flashcards);
    }
    
    // No flashcards found - don't generate new ones, just return not found
    return res.status(404).json({ message: 'No flashcards found for this note' });
  } catch (error) {
    console.error('Error fetching flashcards:', error);
    res.status(500).json({ message: 'Failed to fetch flashcards', error: error.message });
  }
});

// Generate flashcards endpoint
app.post('/api/notes/:id/flashcards/generate', auth.authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const noteId = req.params.id;
    
    // Check if note exists and belongs to user
    const note = await db.getNoteById(noteId, userId);
    
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    // Check if content is sufficient
    if (!isContentSufficientForAI(note.content)) {
      return res.status(400).json({ 
        message: 'Failed to generate flashcards. Please ensure your note has enough content.',
        error: 'Content too short'
      });
    }
    
    console.log(`Force regenerating flashcards for note ${noteId}`);
    
    try {
      // Force regenerate flashcards
      const generatedFlashcards = await generateFlashcardsWithLlama(
        note.content,
        note.title,
        note.tags,
        null,
        true
      );
      
      console.log('Generated flashcards:', generatedFlashcards);
      
      // Update note with new flashcards only if generation was successful
      if (generatedFlashcards && generatedFlashcards.notes && generatedFlashcards.notes.length > 0) {
        // First remove any existing flashcards
        await db.removeAllFlashcardsFromNote(noteId);
        
        // Format flashcards for storage
        const flashcardsToStore = generatedFlashcards.notes.map(card => ({
          question: card.fields.Front,
          answer: card.fields.Back
        }));
        
        console.log('Storing flashcards:', flashcardsToStore);
        
        // Store the flashcards
        await db.addFlashcardsToNote(noteId, flashcardsToStore);
        
        await db.updateNote(noteId, {
          ...note,
          flashcards: generatedFlashcards
        }, userId);
        
        res.json(generatedFlashcards);
      } else {
        console.log('No valid flashcards returned');
        res.status(400).json({ 
          message: 'Failed to generate flashcards, no valid cards returned',
          error: 'No valid flashcards' 
        });
      }
    } catch (aiError) {
      console.error('AI error when generating flashcards:', aiError.message);
      res.status(500).json({ 
        message: 'AI service error: ' + aiError.message,
        error: 'AI service error'
      });
    }
  } catch (error) {
    console.error('Error generating flashcards:', error);
    res.status(500).json({ message: 'Failed to generate flashcards', error: error.message });
  }
});

// Regenerate summary endpoint
app.post('/api/notes/:id/regenerate-summary', auth.authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;
    const noteId = req.params.id;
    
    // Check if note exists and belongs to user
    const note = await db.getNoteById(noteId, userId);
    
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }
    
    // Check if content is sufficient
    if (!isContentSufficientForAI(note.content)) {
      return res.status(400).json({ 
        message: 'Failed to regenerate summary. Please ensure your note has enough content.',
        error: 'Content too short' 
      });
    }
    
    console.log(`Regenerating summary for note ${noteId}`);
    
    // Force regenerate summary
    const summary = await generateSummary(note.content, true);
    
    // Update note with new summary
    const updatedNote = await db.updateNote(noteId, {
      ...note,
      summary
    }, userId);
    
    res.json({
      message: 'Summary regenerated successfully',
      note: updatedNote
    });
  } catch (error) {
    console.error('Error regenerating summary:', error);
    res.status(500).json({ message: 'Failed to regenerate summary', error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0' });
});

// Check if Ollama is running
app.get('/api/ollama-status', async (req, res) => {
  res.json({ 
    running: true,
    model: OPENROUTER_MODEL,
    provider: "OpenRouter",
    modelInfo: "Meta Llama 3.3 70B Instruct (free)",
    needsLocalSetup: false
  });
});

// AI model info endpoint
app.get('/api/ai-info', (req, res) => {
  res.json({
    model: OPENROUTER_MODEL,
    provider: "OpenRouter",
    modelInfo: "Meta Llama 3.3 70B Instruct (free)",
    features: [
      "Summary generation",
      "Flashcard creation",
      "Auto-tagging"
    ],
    needsLocalSetup: false
  });
});

// On server startup, check if the model is available and log a warning if not
(async () => {
  try {
    const response = await openRouterClient.get('/models');
    if (response.status === 200) {
      const models = response.data.data || [];
      const modelExists = models.some(model => model.id === OPENROUTER_MODEL);
      if (!modelExists) {
        console.warn(`WARNING: The model ${OPENROUTER_MODEL} is not available in your OpenRouter account. Please check your account or model permissions.`);
      } else {
        console.log(`Model ${OPENROUTER_MODEL} is available in your OpenRouter account.`);
      }
    } else {
      console.warn('Could not verify model availability at startup.');
    }
  } catch (err) {
    console.warn('Error checking model availability at startup:', err.message);
  }
})();

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

(async () => {
  await db.initDatabase();
})(); 