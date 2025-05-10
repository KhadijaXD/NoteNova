# Smart Note Organizer

A powerful tool to organize, search, and summarize academic notes. The application uses AI to automatically tag content, generate summaries, and create flashcards from your notes.

## Key Features

1. **Rich-Text & PDF Import**
   - Upload text files or PDFs (including scanned documents)
   - OCR processing for scanned documents using Tesseract.js

2. **Auto-Tagging & Linking**
   - Automatically analyze note content and assign relevant tags
   - Suggest links between related notes

3. **AI-Powered Summaries**
   - Generate concise 2-3 sentence summaries of lengthy notes

4. **Global Search**
   - Search across tags, keywords, and summaries in one interface

5. **Flashcard Export**
   - Export key note highlights into Anki-compatible JSON format for spaced repetition

## Project Structure

The project is divided into frontend and backend:

- **Frontend**: React.js with IndexedDB for local storage
- **Backend**: Node.js with Express for file processing and AI features

## Installation

### Prerequisites

- Node.js (v14 or higher)
- NPM (v6 or higher)

### Backend Setup

1. Navigate to the backend directory:
   ```
   cd smart-note-organizer/backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm run dev
   ```

The backend server will run on http://localhost:5000.

### Frontend Setup

1. Navigate to the frontend directory:
   ```
   cd smart-note-organizer/frontend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

The frontend application will run on http://localhost:3000.

## Usage

1. **Uploading Notes**
   - Use the drag-and-drop area on the home page to upload PDF or text files
   - The system will process the file, extract text, generate tags, and create a summary

2. **Viewing and Editing Notes**
   - Click on a note card to view its content
   - Use the "Edit Note" button to modify the content, title, or tags

3. **Searching and Filtering**
   - Use the search bar to find notes by content, title, or tags
   - Filter notes by selecting tags from the tags section

4. **Generating Flashcards**
   - Open a note and click "Generate Flashcards"
   - Download the flashcards in Anki-compatible JSON format

## Technologies Used

- **Frontend**:
  - React.js
  - IndexedDB (via idb)
  - React Router
  - CodeMirror for text editing
  - React Dropzone for file uploads

- **Backend**:
  - Node.js
  - Express
  - Tesseract.js for OCR
  - pdf-parse for PDF text extraction

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature-name`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 