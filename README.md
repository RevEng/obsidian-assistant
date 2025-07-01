# Obsidian Assistant

This application is a plugin for the note-taking app Obsidian. It uses LLM services to chat with your Obsidian vault, allowing you to ask questions about your notes and get intelligent responses.

## Features

- Side-panel that provides chat with an LLM
- Support for multiple LLM services (Ollama and OpenAI API-compatible services)
- Vector search of chunks using embedding models from Ollama or OpenAI API-compatible services
- Configuration options:
  - LLM service selection (Ollama or OpenAI API-compatible)
  - LLM model selection
  - LLM service URL
  - LLM API key (for OpenAI API-compatible services)
  - LLM system prompt (optional; default is to use the API's default system prompt)
  - Vector search settings:
    - Toggle on/off
    - Maximum search results to return
    - Embedding service selection (Ollama or OpenAI API-compatible)
    - Embedding model selection
    - Embedding API key (for OpenAI API-compatible services)
  - Document chunking settings (chunk size, overlap)
- Responsive design that works well on desktop and mobile

## Requirements

- Obsidian version 1.8 or later
- One of the following LLM services:
  - Ollama (local, free)
  - OpenAI API or compatible service (requires API key)
- Node.js version 22.17.0 or later (for development only)

## Installation

### From Obsidian Community Plugins

1. Open Obsidian
2. Go to Settings > Community plugins
3. Turn off Safe mode if it's on
4. Click "Browse" and search for "Obsidian Assistant"
5. Install the plugin
6. Enable the plugin after installation

### Manual Installation

1. Download the latest release from the GitHub releases page (or build it yourself using `npm run package`)
2. Extract the zip file into your Obsidian vault's `.obsidian/plugins/` directory
   - Alternatively, if you're on Windows and have the source code, you can run `npm run install` to automatically extract the zip file to the location specified in package.json under "config.obsidianPluginsDir"
3. Reload Obsidian
4. Enable the plugin in Settings > Community plugins

## Usage

### Setting Up

1. Install and enable the plugin
2. Choose your LLM service:
   - For Ollama:
     - Make sure you have Ollama installed and running
     - Pull your desired models (e.g., `ollama pull llama3` and `ollama pull nomic-embed-text`)
   - For OpenAI API or compatible service:
     - Obtain an API key from your provider
3. Go to Settings > Obsidian Assistant to configure:
   - LLM service:
     - Select "Ollama" or "OpenAI API Compatible"
     - For Ollama:
       - LLM model (e.g., llama3)
       - LLM service URL (e.g., http://localhost:11434)
     - For OpenAI API Compatible:
       - LLM model (e.g., gpt-3.5-turbo, gpt-4)
       - LLM service URL (e.g., https://api.openai.com)
       - LLM API key
   - Optional system prompt
   - Vector search settings:
     - Enable/disable vector search
     - Maximum search results (default: 5)
     - Embedding service:
       - Select "Ollama" or "OpenAI API Compatible"
     - Embedding model:
       - For Ollama: e.g., nomic-embed-text
       - For OpenAI: e.g., text-embedding-3-small
     - Embedding API key (for OpenAI)
   - Document chunking settings:
     - Chunk size (default: 1000 characters)
     - Chunk overlap (default: 200 characters)
   - Index management:
     - Reindex All Documents: Button to manually trigger reindexing of all documents, clearing the index of any existing documents

### Using the Chat

1. Click the chat icon in the ribbon or use the command "Open Assistant Chat"
2. A side panel will open with the chat interface
3. Type your question about your vault and press Enter or click Send
4. The assistant will search your vault for relevant information:
   - If vector search is enabled, it will use hybrid search (combining semantic similarity and keyword-based search) to find relevant content
   - If vector search is disabled, it will use keyword-based search only
5. The assistant will use the search results and/or your current note to provide an intelligent response

### Hybrid Search

When vector search is enabled, the plugin uses a hybrid search approach:

1. Each document chunk is converted to a vector embedding using the specified embedding model
2. When you ask a question, your query is also converted to a vector embedding
3. The system performs both:
   - Vector search: Finding semantically similar chunks by calculating cosine similarity
   - Keyword search: Finding chunks that contain keywords from your query
4. The results from both search methods are combined, with duplicates removed and the best scores preserved
5. This hybrid approach provides more comprehensive results by leveraging both semantic similarity and keyword matching
6. This allows the assistant to find relevant content even when it doesn't contain the exact keywords from your query, while still maintaining the precision of keyword-based search

## Development

### Prerequisites

- Node.js 22.17.0 or later
- npm or a compatible package manager

### Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the plugin: `npm run build`

### Development Commands

- `npm run dev`: Start development mode with auto-reload
- `npm run build`: Build the plugin for production
- `npm run package`: Create a zip file for manual installation
- `npm run install`: Unzip the release file into the Obsidian plugins directory (configurable in package.json under "config.obsidianPluginsDir")
- `npm run lint`: Run ESLint
- `npm run format`: Format code with Prettier
- `npm run test`: Run tests

## License

MIT License

## Disclaimer: AI generated content

Most of the code in this plugin was generated using Jetbrains Junie. I'm a professional software engineer, but I'm not experienced in JavaScript / TypeScript. I used Junie to speed up development and focus on the plugin's architecture and features. The code should be high quality, but please report any issues you find, including common design patterns in TypeScript.
