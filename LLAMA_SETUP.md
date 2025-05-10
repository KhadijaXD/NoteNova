# Setting Up Llama for Smart Note Organizer

This guide will help you set up Llama to enhance your Smart Note Organizer application with better summaries and flashcards.

## Installing Ollama

The easiest way to use Llama is through Ollama, which provides a simple interface for running Llama models locally.

### Step 1: Install Ollama

Download and install Ollama from [https://ollama.ai/](https://ollama.ai/)

- **Windows**: Download the installer from the website
- **macOS**: Download the app from the website
- **Linux**: Run `curl -fsSL https://ollama.ai/install.sh | sh`

### Step 2: Pull the Llama Model

After installing Ollama, open a terminal or command prompt and run:

```bash
ollama pull llama3
```

This will download the Llama 3 model. You can also choose different sizes based on your hardware capabilities:

- `ollama pull llama3:8b` (smaller, faster, less accurate)
- `ollama pull llama3:70b` (larger, slower, more accurate)

### Step 3: Start the Ollama Server

Ollama should start automatically after installation. If it doesn't, you can start it manually:

- **Windows**: Run Ollama from the Start menu
- **macOS**: Open the Ollama app
- **Linux**: Run `ollama serve` in your terminal

Verify the server is running by opening a browser and visiting: `http://localhost:11434`

## Testing Your Setup

Before using Smart Note Organizer, test that your Llama setup is working correctly:

```bash
ollama run llama3 "Summarize this paragraph in 2 sentences: The Smart Note Organizer is an application designed to help students manage their academic notes. It includes features for importing PDFs, auto-tagging content, generating summaries, and creating flashcards for study sessions."
```

You should receive a concise summary response.

## Troubleshooting

If you encounter issues:

1. **Server not running**: Ensure Ollama is running by checking `http://localhost:11434`
2. **Out of memory errors**: Try using a smaller model like `llama3:8b`
3. **Slow responses**: This is normal for the first few requests as the model loads into memory

## Advanced Configuration

For better performance, you can modify the Ollama server settings in the application:

- Open `smart-note-organizer/backend/server.js`
- Find the `generateSummary` function
- Adjust the model, temperature, or max_tokens parameters to tune the output

## Using with Smart Note Organizer

Once Ollama is running with Llama 3, your Smart Note Organizer application will automatically:

1. Generate concise, focused summaries of your notes
2. Create better-quality flashcards for studying
3. Provide the option to regenerate summaries for existing notes

Enjoy your enhanced note-taking experience with Llama-powered AI features! 