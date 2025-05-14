# Setting up Ollama for NoteNova

NoteNova can use [Ollama](https://ollama.com/) to generate high-quality AI-powered flashcards and summaries. This guide will help you set up Ollama on your system.

## Installing Ollama

1. **Download and install Ollama** from the official website: [https://ollama.com/download](https://ollama.com/download)
   - Windows: Download the installer and follow the setup instructions
   - macOS: Download the macOS app
   - Linux: Follow the installation instructions on the website

2. **Start Ollama** 
   - On Windows: Run the Ollama application from the Start Menu
   - On macOS: Open the Ollama app from Applications
   - On Linux: Run `ollama serve` in your terminal

## Installing a Language Model

After installing Ollama, you need to download a language model. NoteNova works best with Llama models, but other models like Mistral can also work.

1. **Open a terminal or command prompt**

2. **Run one of these commands to download a model** (choose one):

   ```
   ollama pull llama3
   ```

   or

   ```
   ollama pull llama2
   ```
   
   or for a smaller model:
   
   ```
   ollama pull mistral
   ```

3. **Wait for the download to complete**
   - This may take some time depending on your internet connection and computer
   - The model files are large (several GB)

## Verifying Ollama is Working

1. **Ensure Ollama is running** in the background

2. **Run a test command**:
   ```
   ollama run llama3 "Hello, world!"
   ```
   (Replace `llama3` with the name of the model you downloaded)

3. **You should see a response** from the model

## Using Ollama with NoteNova

Once Ollama is set up and running:

1. NoteNova will automatically detect Ollama
2. The "Regenerate Summary" button will use Ollama to create better summaries
3. Flashcard generation will use Ollama to create high-quality learning flashcards

If you encounter any issues:
- Make sure Ollama is running
- Check that you have downloaded at least one language model
- Restart NoteNova

## Troubleshooting

- **"No model available" error**: Make sure you've downloaded a model using `ollama pull`
- **"Cannot connect to Ollama" error**: Ensure Ollama is running in the background
- **Slow generation**: This is normal for the first generation as the model loads into memory

For more help, visit [ollama.com/help](https://ollama.com/help) 