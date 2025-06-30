# Obsidian Assistant

This application is a plugin for the note-taking app Obsidian. It uses LLM services to chat with your Obsidian vault, allowing you to ask questions about your notes and get intelligent responses.

## Features

- Side-panel that provides chat with an LLM
- Support for multiple LLM services (currently just Ollama)
- Configuration options:
  - LLM service selection (currently just Ollama)
  - LLM model selection
  - LLM service URL
  - LLM system prompt (optional; default is to use the API's default system prompt)
- Responsive design that works well on desktop and mobile

## Requirements

- Obsidian version 1.8 or later
- LLM service (currently supports Ollama)
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
2. Make sure you have an LLM service running (e.g., Ollama)
3. Go to Settings > Obsidian Assistant to configure:
   - LLM service (currently only Ollama is supported)
   - LLM model (e.g., llama3)
   - LLM service URL (e.g., http://localhost:11434 for Ollama)
   - Optional system prompt

### Using the Chat

1. Click the chat icon in the ribbon or use the command "Open Assistant Chat"
2. A side panel will open with the chat interface
3. Type your question about your current note and press Enter or click Send
4. The assistant will use the contents of your current note to provide an intelligent response

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
