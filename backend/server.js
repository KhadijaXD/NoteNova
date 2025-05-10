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

const app = express();
const port = process.env.PORT || 5000;

// Global cache for Ollama availability to prevent multiple checks
let ollamaAvailabilityCache = {
  available: null, // Will be set to true or false after first check
  lastChecked: null, // Timestamp of last check
  checkInterval: 5 * 60 * 1000 // Check again after 5 minutes
};

// Add this near the top of the file with other global variables
const flashcardCache = new Map(); // Cache for generated flashcards

// Function to get Ollama availability status (from cache if possible)
async function getOllamaAvailability() {
  const now = Date.now();
  
  // If we have a cached result that's still valid, use it
  if (ollamaAvailabilityCache.available !== null && 
      ollamaAvailabilityCache.lastChecked !== null &&
      now - ollamaAvailabilityCache.lastChecked < ollamaAvailabilityCache.checkInterval) {
    console.log(`Using cached Ollama availability: ${ollamaAvailabilityCache.available}`);
    return ollamaAvailabilityCache.available;
  }
  
  console.log('Checking Ollama availability...');
  
  try {
    // Try the base URL first for availability check
    const response = await axios.get('http://localhost:11434', { 
      timeout: 5000 // Increased timeout
    });
    
    ollamaAvailabilityCache.available = true;
    console.log('Ollama is running');
    
    // Try to check for the llama model
    try {
      const modelResponse = await axios.post('http://localhost:11434/api/tags', {}, {
        timeout: 5000
      });
      
      const modelsList = modelResponse.data?.models || [];
      const hasLlama3 = modelsList.some(model => 
        model.name === 'llama3' || 
        model.name === 'llama3:latest' ||
        model.name.includes('llama3')
      );
      
      console.log(hasLlama3 
        ? 'Successfully confirmed llama3 model is available' 
        : 'Warning: llama3 model might not be available');
    } catch (modelError) {
      // Just log but don't affect availability
      console.log('Could not verify model availability:', modelError.message);
    }
  } catch (error) {
    try {
      // Try alternate Ollama API endpoint
      const response = await axios.get('http://localhost:11434/api/version', { 
        timeout: 5000
      });
      ollamaAvailabilityCache.available = true;
      console.log('Ollama is running (verified with version endpoint)');
    } catch (secondError) {
      ollamaAvailabilityCache.available = false;
      console.log(`Ollama not available: ${error.message}`);
    }
  }
  
  ollamaAvailabilityCache.lastChecked = now;
  return ollamaAvailabilityCache.available;
}

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

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
  // Simplified implementation - in a real app, use spaCy or other NLP
  const commonKeywords = {
    'biology': ['cell', 'photosynthesis', 'organism', 'evolution', 'dna'],
    'chemistry': ['element', 'reaction', 'compound', 'acid', 'molecule'],
    'physics': ['energy', 'force', 'motion', 'quantum', 'relativity'],
    'mathematics': ['equation', 'theorem', 'algebra', 'calculus', 'geometry'],
    'computer science': ['algorithm', 'database', 'programming', 'network', 'software']
  };
  
  const tags = [];
  const lowercaseText = text.toLowerCase();
  
  // Check if any keywords are present in the text
  Object.entries(commonKeywords).forEach(([category, keywords]) => {
    if (keywords.some(keyword => lowercaseText.includes(keyword))) {
      tags.push(category);
      
      // Add the specific keyword tags that were found
      keywords.forEach(keyword => {
        if (lowercaseText.includes(keyword)) {
          tags.push(keyword);
        }
      });
    }
  });
  
  return [...new Set(tags)]; // Remove duplicates
}

// Helper function to generate summary using Llama
async function generateSummary(text, isOllamaRunning = null) {
  try {
    // Clean and prepare the text
    const cleanText = text
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // If text is very short, just return it
    if (cleanText.length < 200) {
      return cleanText;
    }
    
    // Get Ollama availability from cache if possible
    if (isOllamaRunning === null) {
      isOllamaRunning = await getOllamaAvailability();
    }
    
    // If Ollama is not available, go to fallback immediately
    if (!isOllamaRunning) {
      throw new Error("Using fallback method");
    }
    
    // Use the entire cleaned text for summary
    const prompt = `
    Summarize the following text in 3 to 4 concise, factual sentences. Do not include any introductory phrases or labels. Just output the summary directly.\n\nText to summarize:\n${cleanText}\n`;
    
    try {
      const response = await axios.post('http://localhost:11434/api/generate', {
        model: 'llama3',
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.2,
          num_predict: 500 // Reduced to keep summary concise
        }
      }, {
        timeout: 10000
      });
      
      if (response.data && response.data.response) {
        let summary = response.data.response.trim();
        // Extract summary from within the first pair of quotes
        const quoteMatch = summary.match(/"([^"]+)"/);
        if (quoteMatch && quoteMatch[1]) {
          summary = quoteMatch[1].trim();
        } else {
          // Remove any leading summary phrases (robust)
          summary = summary.replace(/^(here(\s+is)?(\s+a)?(\s+brief)?(\s+summary)?(\s+of)?(\s+the)?(\s+text)?(\s+in)?(\s+exactly)?(\s*\d*-?\d*\s*sentences)?\s*:?\s*)/i, '');
          summary = summary.replace(/^summary(\s*\(.*?\))?:?/i, '').trim();
        }
        // Ensure proper sentence endings
        if (!summary.endsWith('.')) {
          summary += '.';
        }
        // Split into sentences and take first 4
        const sentences = summary.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length > 4) {
          summary = sentences.slice(0, 4).join('. ') + '.';
        }
        return summary;
      }
    } catch (error) {
      console.error('Error generating summary:', error.message);
      throw new Error("Fallback to basic extraction");
    }
    
    // Fallback to basic extraction
    throw new Error("Fallback to basic extraction");
    
  } catch (error) {
    // Fallback to basic extraction in case of error
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length <= 3) {
      return text;
    }
    return sentences.slice(0, 3).join('. ') + '.';
  }
}

// Helper function to generate flashcards using Llama
async function generateFlashcardsWithLlama(noteContent, noteTitle, noteTags, isOllamaRunning = null, forceRegenerate = false) {
  try {
    // Check cache first if not forcing regeneration
    if (!forceRegenerate && flashcardCache.has(noteTitle)) {
      console.log('Returning cached flashcards for:', noteTitle);
      return flashcardCache.get(noteTitle);
    }

    if (isOllamaRunning === null) {
      isOllamaRunning = await getOllamaAvailability();
    }
    
    if (!isOllamaRunning) {
      console.log('Ollama is not available, skipping Llama flashcard generation');
      return null;
    }
    
    console.log('Attempting to generate flashcards with llama3:latest...');
    
    // Clean and prepare the text
    const cleanText = noteContent
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Split content into smaller chunks to process more thoroughly
    const paragraphs = cleanText.split(/\n\n+/).filter(p => p.trim().length > 0);
    const allFlashcards = [];
    
    // Process each paragraph separately to get more focused flashcards
    for (const paragraph of paragraphs) {
      if (paragraph.trim().length < 20) continue;
      
      const prompt = `
      Generate as many flashcards as possible from the following text. Each flashcard should have a clear question and a concise answer. Focus on key facts, definitions, processes, or important concepts.

      Guidelines:
      - Create a flashcard for EVERY important point, concept, or definition
      - Questions should be specific and test understanding of individual concepts
      - Answers should be detailed but concise
      - Focus on key terms, definitions, relationships, and important details
      - Make sure questions and answers are factually accurate based on the text
      - Format each flashcard as "Q: [question]" on one line followed by "A: [answer]" on the next line
      - Separate each flashcard with a blank line
      - Create as many flashcards as needed to cover ALL important points
      - Don't skip any important information - create a flashcard for each significant detail

      Text to create flashcards from:
      ${paragraph}

      Generate the flashcards now, with each in the format:
      Q: [Question]
      A: [Answer]
      `;
      
      try {
        console.log('Attempting to generate flashcards with llama3:latest...');
        const response = await axios.post('http://localhost:11434/api/generate', {
          model: 'llama3:latest',
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.2,
            num_predict: 2000
          }
        }, {
          timeout: 60000
        });
        
        if (response.data && response.data.response) {
          console.log('Successfully received response from llama3:latest');
          const flashcardsText = response.data.response.trim();
          console.log('Raw response:', flashcardsText);
          
          // Split by double newlines and filter for valid Q/A pairs
          const flashcardPairs = flashcardsText
            .split(/\n\s*\n/)
            .filter(pair => {
              const hasQuestion = pair.includes('Q:') || pair.includes('Question:');
              const hasAnswer = pair.includes('A:') || pair.includes('Answer:');
              return hasQuestion && hasAnswer;
            });
          
          console.log(`Found ${flashcardPairs.length} potential flashcard pairs`);
          
          const paragraphCards = flashcardPairs.map((pair, index) => {
            // Try different question patterns
            const questionMatch = pair.match(/(?:Q:|Question:)\s*(.*?)(?=\n|$)/s) || 
                                pair.match(/^([^A:]+?)(?=\n|$)/s);
            const answerMatch = pair.match(/(?:A:|Answer:)\s*(.*?)(?=\n|$)/s) || 
                              pair.match(/\n([^Q:]+?)(?=\n|$)/s);
            
            const question = questionMatch ? questionMatch[1].trim() : 'Question not found';
            const answer = answerMatch ? answerMatch[1].trim() : 'Answer not found';
            
            console.log(`Processing card ${index + 1}:`);
            console.log('Question:', question);
            console.log('Answer:', answer);
            
            return {
              deckName: `Notes - ${noteTitle}`,
              modelName: "Basic",
              fields: {
                Front: question,
                Back: answer
              },
              tags: noteTags || []
            };
          }).filter(card => 
            card.fields.Front !== 'Question not found' && 
            card.fields.Back !== 'Answer not found' &&
            card.fields.Front.length > 0 &&
            card.fields.Back.length > 0
          );
          
          console.log(`Successfully processed ${paragraphCards.length} valid flashcards`);
          allFlashcards.push(...paragraphCards);
        } else {
          console.log('No response data received from llama3:latest');
        }
      } catch (error) {
        console.error('Error processing paragraph:', error.message);
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          console.log('Timeout occurred, trying with smaller chunk...');
          const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0);
          const halfLength = Math.ceil(sentences.length / 2);
          const firstHalf = sentences.slice(0, halfLength).join('. ') + '.';
          const secondHalf = sentences.slice(halfLength).join('. ') + '.';
          
          // Process first half
          if (firstHalf.length > 20) {
            try {
              console.log('Processing first half of paragraph...');
              const firstResponse = await axios.post('http://localhost:11434/api/generate', {
                model: 'llama3:latest',
                prompt: prompt.replace(paragraph, firstHalf),
                stream: false,
                options: {
                  temperature: 0.2,
                  num_predict: 1000
                }
              }, {
                timeout: 30000
              });
              
              if (firstResponse.data && firstResponse.data.response) {
                const flashcardsText = firstResponse.data.response.trim();
                console.log('First half response:', flashcardsText);
                
                const flashcardPairs = flashcardsText
                  .split(/\n\s*\n/)
                  .filter(pair => {
                    const hasQuestion = pair.includes('Q:') || pair.includes('Question:');
                    const hasAnswer = pair.includes('A:') || pair.includes('Answer:');
                    return hasQuestion && hasAnswer;
                  });
                
                const paragraphCards = flashcardPairs.map((pair, index) => {
                  const questionMatch = pair.match(/(?:Q:|Question:)\s*(.*?)(?=\n|$)/s) || 
                                      pair.match(/^([^A:]+?)(?=\n|$)/s);
                  const answerMatch = pair.match(/(?:A:|Answer:)\s*(.*?)(?=\n|$)/s) || 
                                    pair.match(/\n([^Q:]+?)(?=\n|$)/s);
                  
                  const question = questionMatch ? questionMatch[1].trim() : 'Question not found';
                  const answer = answerMatch ? answerMatch[1].trim() : 'Answer not found';
                  
                  return {
                    deckName: `Notes - ${noteTitle}`,
                    modelName: "Basic",
                    fields: {
                      Front: question,
                      Back: answer
                    },
                    tags: noteTags || []
                  };
                }).filter(card => 
                  card.fields.Front !== 'Question not found' && 
                  card.fields.Back !== 'Answer not found' &&
                  card.fields.Front.length > 0 &&
                  card.fields.Back.length > 0
                );
                
                allFlashcards.push(...paragraphCards);
              }
            } catch (innerError) {
              console.error('Error processing first half:', innerError.message);
            }
          }
          
          // Process second half
          if (secondHalf.length > 20) {
            try {
              console.log('Processing second half of paragraph...');
              const secondResponse = await axios.post('http://localhost:11434/api/generate', {
                model: 'llama3:latest',
                prompt: prompt.replace(paragraph, secondHalf),
                stream: false,
                options: {
                  temperature: 0.2,
                  num_predict: 1000
                }
              }, {
                timeout: 30000
              });
              
              if (secondResponse.data && secondResponse.data.response) {
                const flashcardsText = secondResponse.data.response.trim();
                console.log('Second half response:', flashcardsText);
                
                const flashcardPairs = flashcardsText
                  .split(/\n\s*\n/)
                  .filter(pair => {
                    const hasQuestion = pair.includes('Q:') || pair.includes('Question:');
                    const hasAnswer = pair.includes('A:') || pair.includes('Answer:');
                    return hasQuestion && hasAnswer;
                  });
                
                const paragraphCards = flashcardPairs.map((pair, index) => {
                  const questionMatch = pair.match(/(?:Q:|Question:)\s*(.*?)(?=\n|$)/s) || 
                                      pair.match(/^([^A:]+?)(?=\n|$)/s);
                  const answerMatch = pair.match(/(?:A:|Answer:)\s*(.*?)(?=\n|$)/s) || 
                                    pair.match(/\n([^Q:]+?)(?=\n|$)/s);
                  
                  const question = questionMatch ? questionMatch[1].trim() : 'Question not found';
                  const answer = answerMatch ? answerMatch[1].trim() : 'Answer not found';
                  
                  return {
                    deckName: `Notes - ${noteTitle}`,
                    modelName: "Basic",
                    fields: {
                      Front: question,
                      Back: answer
                    },
                    tags: noteTags || []
                  };
                }).filter(card => 
                  card.fields.Front !== 'Question not found' && 
                  card.fields.Back !== 'Answer not found' &&
                  card.fields.Front.length > 0 &&
                  card.fields.Back.length > 0
                );
                
                allFlashcards.push(...paragraphCards);
              }
            } catch (innerError) {
              console.error('Error processing second half:', innerError.message);
            }
          }
        }
        continue;
      }
    }
    
    if (allFlashcards.length > 0) {
      const result = {
        deckName: `Notes - ${noteTitle}`,
        notes: allFlashcards,
        generatedAt: new Date().toISOString()
      };
      
      // Cache the result
      flashcardCache.set(noteTitle, result);
      
      console.log(`Successfully created ${allFlashcards.length} flashcards using llama3:latest`);
      return result;
    }
    
    console.log('No valid flashcards could be generated, falling back to basic method');
    return null;
    
  } catch (error) {
    console.error('Error generating flashcards with Llama:', error.message);
    return null;
  }
}

// API Endpoints

// Upload endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileType = path.extname(filePath).toLowerCase();
    
    let extractedText = '';
    
    if (fileType === '.pdf') {
      try {
        extractedText = await extractTextFromPDF(filePath);
        
        // If PDF appears to be scanned (very little text extracted), perform OCR
        if (extractedText.length < 100) {
          extractedText = await performOCR(filePath);
        }
      } catch (err) {
        return res.status(400).json({ error: `Failed to process PDF file: ${err.message}` });
      }
    } else if (fileType === '.txt') {
      try {
        extractedText = fs.readFileSync(filePath, 'utf8');
      } catch (err) {
        return res.status(400).json({ error: `Failed to read text file: ${err.message}` });
      }
    } else if (fileType === '.docx') {
      try {
        extractedText = await extractTextFromDOCX(filePath);
      } catch (err) {
        return res.status(400).json({ error: `Failed to process Word document: ${err.message}` });
      }
    } else {
      return res.status(400).json({ error: `Unsupported file format: ${fileType}` });
    }
    
    // Check if we got any meaningful text content
    if (!extractedText || extractedText.trim().length === 0) {
      return res.status(400).json({ 
        error: 'No text could be extracted from the file. Please check if the file is corrupted or password protected.'
      });
    }
    
    // Process the extracted text
    const tags = generateTags(extractedText);
    const summary = await generateSummary(extractedText);
    
    // Create a new note object
    const newNote = {
      id: Date.now().toString(),
      title: req.file.originalname.replace(/\.[^/.]+$/, ""), // Remove file extension
      content: extractedText,
      tags,
      summary,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save to our in-memory database
    notesDatabase.push(newNote);
    
    // Also save to a file for persistence
    fs.writeFileSync(
      path.join(notesDir, `${newNote.id}.json`),
      JSON.stringify(newNote, null, 2)
    );
    
    res.status(200).json({ 
      message: 'File processed successfully',
      note: newNote
    });
    
  } catch (error) {
    console.error('Error processing file:', error);
    res.status(500).json({ error: `Error processing file: ${error.message}` });
  } finally {
    // Clean up the uploaded file to avoid taking up disk space
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('Failed to remove temporary uploaded file:', err);
      }
    }
  }
});

// Get all notes
app.get('/api/notes', (req, res) => {
  res.json(notesDatabase);
});

// Get note by ID
app.get('/api/notes/:id', (req, res) => {
  const note = notesDatabase.find(note => note.id === req.params.id);
  
  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }
  
  res.json(note);
});

// Update note
app.put('/api/notes/:id', (req, res) => {
  const { title, content, tags } = req.body;
  const noteIndex = notesDatabase.findIndex(note => note.id === req.params.id);
  
  if (noteIndex === -1) {
    return res.status(404).json({ error: 'Note not found' });
  }
  
  // Update the note
  notesDatabase[noteIndex] = {
    ...notesDatabase[noteIndex],
    title: title || notesDatabase[noteIndex].title,
    content: content || notesDatabase[noteIndex].content,
    tags: tags || notesDatabase[noteIndex].tags,
    updatedAt: new Date().toISOString()
  };
  
  // Update the file for persistence
  fs.writeFileSync(
    path.join(notesDir, `${notesDatabase[noteIndex].id}.json`),
    JSON.stringify(notesDatabase[noteIndex], null, 2)
  );
  
  res.json(notesDatabase[noteIndex]);
});

// Delete note
app.delete('/api/notes/:id', (req, res) => {
  const noteIndex = notesDatabase.findIndex(note => note.id === req.params.id);
  
  if (noteIndex === -1) {
    return res.status(404).json({ error: 'Note not found' });
  }
  
  // Remove from memory
  const deletedNote = notesDatabase.splice(noteIndex, 1)[0];
  
  // Remove the file
  const notePath = path.join(notesDir, `${deletedNote.id}.json`);
  if (fs.existsSync(notePath)) {
    fs.unlinkSync(notePath);
  }
  
  res.json({ message: 'Note deleted', noteId: req.params.id });
});

// Search notes
app.get('/api/search', (req, res) => {
  const { query, tags } = req.query;
  
  let results = [...notesDatabase];
  
  // Filter by search query
  if (query) {
    const lowercaseQuery = query.toLowerCase();
    results = results.filter(note => 
      note.title.toLowerCase().includes(lowercaseQuery) ||
      note.content.toLowerCase().includes(lowercaseQuery) ||
      note.summary.toLowerCase().includes(lowercaseQuery) ||
      note.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
    );
  }
  
  // Filter by tags
  if (tags) {
    const tagList = tags.split(',').map(tag => tag.trim().toLowerCase());
    results = results.filter(note => 
      note.tags.some(tag => tagList.includes(tag.toLowerCase()))
    );
  }
  
  res.json(results);
});

// Export notes as flashcards (Anki format)
app.get('/api/notes/:id/flashcards', async (req, res) => {
  try {
    const note = notesDatabase.find(note => note.id === req.params.id);
    const forceRegenerate = req.query.regenerate === 'true';
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    if (!note.content || note.content.trim().length === 0) {
      return res.status(400).json({ error: 'Note has no content to generate flashcards' });
    }
    
    // Check cache first if not forcing regeneration
    if (!forceRegenerate && flashcardCache.has(note.title)) {
      console.log('Returning cached flashcards for:', note.title);
      return res.json({
        ...flashcardCache.get(note.title),
        generatedBy: 'llama',
        canRegenerate: true
      });
    }
    
    const isOllamaRunning = await getOllamaAvailability();
    
    if (isOllamaRunning) {
      try {
        const ankiDeck = await generateFlashcardsWithLlama(
          note.content, 
          note.title, 
          note.tags, 
          isOllamaRunning,
          forceRegenerate
        );
        
        if (ankiDeck && ankiDeck.notes && ankiDeck.notes.length > 0) {
          return res.json({
            ...ankiDeck,
            generatedBy: 'llama',
            canRegenerate: true
          });
        }
      } catch (llamaError) {
        console.error('Error generating flashcards with Llama:', llamaError);
      }
    }
    
    // Preprocess content to be better organized
    let preprocessedContent = note.content
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    
    // Split content into paragraphs while preserving original formatting
    const paragraphs = preprocessedContent.split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);
    
    // Find potential definitions (Key term: definition format)
    const definitions = [];
    const keyTermPattern = /^([A-Z][A-Za-z0-9\s\-]+):\s*(.+)$/;
    const bulletPointPattern = /^[•\-*]\s*([A-Z][A-Za-z0-9\s\-]+):\s*(.+)$/;
    
    paragraphs.forEach(paragraph => {
      // Check for paragraph-level definitions
      const definitionMatch = paragraph.match(keyTermPattern);
      if (definitionMatch) {
        definitions.push({
          term: definitionMatch[1].trim(),
          definition: definitionMatch[2].trim()
        });
      }
      
      // Check for bulleted lists with definitions
      paragraph.split('\n').forEach(line => {
        const bulletMatch = line.match(bulletPointPattern);
        if (bulletMatch) {
          definitions.push({
            term: bulletMatch[1].trim(),
            definition: bulletMatch[2].trim()
          });
        }
      });
    });
    
    // Process content into sentences for concept-based flashcards
    const sentences = [];
    paragraphs.forEach(paragraph => {
      // Keep paragraphs intact to preserve formatting
      const paragraphSentences = paragraph
        .split(/(?<=[.!?])\s+/)
        .map(sentence => sentence.trim())
        .filter(sentence => sentence.length > 0); // Accept any non-empty sentence
      
      sentences.push(...paragraphSentences);
    });
    
    // Create definition flashcards from the extracted definitions
    const definitionCards = definitions.map((def, index) => {
      return {
        id: `${note.id}-def-${index}`,
        noteId: note.id,
        front: `What is ${def.term}?`,
        back: def.definition,
        tags: [...(note.tags || []), 'definition']
      };
    });
    
    // If no definitions found, create basic flashcards from sentences
    let allCards = [...definitionCards];
    
    // If we don't have enough cards, add basic flashcards from sentences
    if (allCards.length < 5 && sentences.length > 0) {
      // Use any sentence that's at least 5 characters long
      const basicCards = sentences
        .filter(sentence => sentence.length >= 5)
        .slice(0, 10)
        .map((sentence, index) => {
          const words = sentence.split(' ');
          const halfLength = Math.max(1, Math.floor(words.length / 2));
          
          return {
            id: `${note.id}-basic-${index}`,
            noteId: note.id,
            front: words.length > 1 ? `${words.slice(0, halfLength).join(' ')}...?` : `${sentence}?`,
            back: sentence,
            tags: [...(note.tags || []), 'basic']
          };
        });
      
      allCards.push(...basicCards);
    }
    
    // If still no cards were created, create generic ones from the title
    if (allCards.length === 0 && note.title) {
      allCards.push({
        id: `${note.id}-title-1`,
        noteId: note.id,
        front: `What is ${note.title}?`,
        back: preprocessedContent.length > 100 ? preprocessedContent.slice(0, 100) + '...' : preprocessedContent,
        tags: [...(note.tags || []), 'title']
      });
      
      allCards.push({
        id: `${note.id}-title-2`,
        noteId: note.id,
        front: `Describe ${note.title}`,
        back: note.summary || 'No detailed description available',
        tags: [...(note.tags || []), 'title']
      });
    }
    
    // As a last resort, create a flashcard with tags as topics
    if (allCards.length === 0 && note.tags && note.tags.length > 0) {
      allCards.push({
        id: `${note.id}-tags-1`,
        noteId: note.id,
        front: `List topics related to ${note.title}`,
        back: note.tags.join(', '),
        tags: [...(note.tags || []), 'tags']
      });
    }
    
    // Format for Anki
    const ankiDeck = {
      deckName: `Notes - ${note.title}`,
      notes: allCards.map(card => ({
        deckName: `Notes - ${note.title}`,
        modelName: "Basic",
        fields: {
          Front: card.front,
          Back: card.back
        },
        tags: card.tags
      })),
      generatedBy: 'basic'
    };
    
    res.json(ankiDeck);
  } catch (error) {
    console.error('Error generating flashcards:', error);
    
    // Return a generic deck even on error
    const fallbackDeck = {
      deckName: `Notes - ${error.noteTitle || 'Error'}`,
      notes: [{
        deckName: `Notes - Error`,
        modelName: "Basic",
        fields: {
          Front: "What is this note about?",
          Back: "This is a fallback flashcard. Please try again with more content."
        },
        tags: ["error", "fallback"]
      }],
      generatedBy: 'error-fallback'
    };
    
    res.json(fallbackDeck);
  }
});

// Regenerate a summary for an existing note
app.post('/api/notes/:id/regenerate-summary', async (req, res) => {
  try {
    const noteIndex = notesDatabase.findIndex(note => note.id === req.params.id);
    
    if (noteIndex === -1) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    // Get the existing note
    const note = notesDatabase[noteIndex];
    
    // Check if content exists
    if (!note.content || note.content.trim().length === 0) {
      return res.status(400).json({ error: 'Note has no content to generate a summary' });
    }
    
    // Get Ollama availability from cache
    const isOllamaRunning = await getOllamaAvailability();
    
    // Generate a new summary (pass the Ollama status to avoid redundant checks)
    const newSummary = await generateSummary(note.content, isOllamaRunning);
    
    // Update the note
    notesDatabase[noteIndex] = {
      ...note,
      summary: newSummary,
      updatedAt: new Date().toISOString()
    };
    
    // Update the file for persistence
    fs.writeFileSync(
      path.join(notesDir, `${note.id}.json`),
      JSON.stringify(notesDatabase[noteIndex], null, 2)
    );
    
    res.json({ 
      message: isOllamaRunning 
        ? 'Summary regenerated successfully with Llama AI' 
        : 'Summary regenerated with basic extraction (Llama AI not available)',
      note: notesDatabase[noteIndex]
    });
    
  } catch (error) {
    // Return error message without detailed logging
    res.status(500).json({ 
      error: 'Failed to regenerate summary. Using basic extraction method.'
    });
  }
});

// Add diagnostic endpoint to check Ollama status
app.get('/api/ollama-status', async (req, res) => {
  try {
    const isOllamaRunning = await getOllamaAvailability();
    res.json({
      status: isOllamaRunning ? 'connected' : 'disconnected',
      lastChecked: ollamaAvailabilityCache.lastChecked,
      cacheStatus: ollamaAvailabilityCache
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Error checking Ollama status',
      message: error.message 
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app; 