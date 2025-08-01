import { App, TFile } from 'obsidian';
import { create, insertMultiple, search, remove } from '@orama/orama';
import { persist, restore } from '@orama/plugin-data-persistence';
import { EmbeddingService, EmbeddingServiceConfig } from './embedding-service';

/**
 * Interface for document in the search index
 */
export interface NoteDocument {
  id: string;
  title: string;
  content: string;
  path: string;
  embedding?: number[];
}

/**
 * Interface for search options
 */
export interface SearchOptions {
  useCurrentNote: boolean;
  useVaultSearch: boolean;
  useVectorSearch?: boolean;
}

/**
 * Interface for chunking options
 */
export interface ChunkingOptions {
  chunkSize: number;
  chunkOverlap: number;
}

/**
 * Class for handling search functionality using Orama
 */
export class SearchService {
  private app: App;
  private index: any | null = null;
  private indexReady = false;
  private indexingInProgress = false;
  private indexingFailed = false;
  private chunkingOptions: ChunkingOptions;
  private embeddingService: EmbeddingService | null = null;
  private documentEmbeddings: Map<string, number[]> = new Map();
  private useVectorSearch = false;
  private maxSearchResults = 5;
  private currentFileIndex = 0;
  private totalFiles = 0;
  private lastError: string = '';
  private fileModificationTimes: Map<string, number> = new Map();
  private indexFilePath: string = '';
  private isDirty = false;
  private dirtyTimestamp = 0;
  private saveTimer: NodeJS.Timeout | null = null;

  /**
   * Constructor
   * @param app - Obsidian app instance
   * @param chunkingOptions - Options for document chunking
   * @param embeddingConfig - Optional configuration for embedding service
   * @param useVectorSearch - Whether to use vector search
   * @param maxSearchResults - Maximum number of search results to return
   */
  constructor(
    app: App,
    chunkingOptions: ChunkingOptions = { chunkSize: 1000, chunkOverlap: 200 },
    embeddingConfig?: EmbeddingServiceConfig,
    useVectorSearch = false,
    maxSearchResults = 5
  ) {
    this.app = app;
    this.chunkingOptions = chunkingOptions;
    this.useVectorSearch = useVectorSearch;
    this.maxSearchResults = maxSearchResults;

    // Set the index file path in the .obsidian directory
    this.indexFilePath = `${this.app.vault.configDir}/search-index.json`;

    // Initialize embedding service if config is provided
    if (embeddingConfig) {
      this.embeddingService = new EmbeddingService(embeddingConfig);
    }
  }

  /**
   * Mark the index as dirty and set up a timer to save it
   * @private
   */
  private markDirty(): void {
    if (!this.isDirty) {
      this.isDirty = true;
      this.dirtyTimestamp = Date.now();
      console.log('Search index marked as dirty');
    }

    // If no save timer is running, set up a timer to save the index
    if (!this.saveTimer) {
      this.saveTimer = setInterval(() => {
        // Check if the index has been dirty for more than 5 seconds
        if (this.isDirty && Date.now() - this.dirtyTimestamp > 5000) {
          console.log('Search index has been dirty for more than 5 seconds, saving...');

          // Check if the index is ready to save
          if (this.index && this.indexReady) {
            this.save().catch((error) => {
              console.error('Error auto-saving search index:', error);
            });
          } else {
            // If the index is not ready to save, restart the saveTimer
            if (this.saveTimer) {
              clearInterval(this.saveTimer);
              this.saveTimer = null;
            }
            this.markDirty(); // This will set up a new timer
          }
        }
      }, 1000); // Check every second
      // Unref the timer to allow the process to exit if needed, but only if running in Node.js
      if (typeof this.saveTimer.unref === 'function') {
        this.saveTimer.unref();
      }
    }
  }

  /**
   * Update chunking options
   * @param options - New chunking options
   */
  updateChunkingOptions(options: ChunkingOptions): void {
    this.chunkingOptions = options;
  }

  /**
   * Update embedding service configuration
   * @param config - New embedding service configuration
   * @param useVectorSearch - Whether to use vector search
   */
  updateEmbeddingConfig(config: EmbeddingServiceConfig, useVectorSearch: boolean): void {
    this.useVectorSearch = useVectorSearch;

    if (useVectorSearch) {
      if (this.embeddingService) {
        this.embeddingService.updateConfig(config);
      } else {
        this.embeddingService = new EmbeddingService(config);
      }
    }
  }

  /**
   * Update maximum search results
   * @param maxSearchResults - New maximum search results
   */
  updateMaxSearchResults(maxSearchResults: number): void {
    this.maxSearchResults = maxSearchResults;
  }

  /**
   * Split a document into chunks
   * @param document - The document to split
   * @returns Array of document chunks
   */
  private chunkDocument(document: NoteDocument): NoteDocument[] {
    const { chunkSize, chunkOverlap } = this.chunkingOptions;
    const { id, title, content, path } = document;

    // If content is smaller than chunk size, return the document as is
    if (content.length <= chunkSize) {
      return [document];
    }

    const chunks: NoteDocument[] = [];
    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < content.length) {
      // Calculate end index for this chunk
      const endIndex = Math.min(startIndex + chunkSize, content.length);

      // Extract chunk content
      const chunkContent = content.substring(startIndex, endIndex);

      // Create chunk document with same title and path but unique ID
      chunks.push({
        id: `${id}-chunk-${chunkIndex}`,
        title,
        content: chunkContent,
        path,
      });

      if (endIndex >= content.length) {
        break;
      }

      startIndex = endIndex - chunkOverlap;

      // Ensure we make progress even with large overlap
      if (startIndex <= 0 || startIndex >= content.length - 1) {
        break;
      }

      chunkIndex++;
    }

    return chunks;
  }

  /**
   * Initialize the search index
   */
  async initializeIndex(): Promise<void> {
    try {
      if (this.indexingInProgress) {
        console.log('Indexing already in progress');
        return;
      }

      this.indexingFailed = false;
      this.indexReady = false;
      this.indexingInProgress = true;
      this.lastError = '';
      console.log('Initializing Orama search index');

      // Try to load the index from disk first
      const loaded = await this.load();

      // If loading failed, create a new index
      if (!loaded) {
        console.log('Creating a new search index');
        this.index = await create({
          schema: {
            id: 'string',
            title: 'string',
            content: 'string',
            path: 'string',
          },
          components: {
            tokenizer: {
              stemming: true,
            },
          },
        });

        // Index all markdown files in the vault
        await this.indexVault();
      } else {
        // If we loaded the index, check for any new or modified files
        console.log('Checking for new or modified files');
        await this.indexVault();
      }

      this.indexReady = true;
      this.indexingInProgress = false;

      // Save the index to disk
      await this.save();

      console.log('Orama search index initialized');
    } catch (error) {
      console.error('Error initializing search index:', error);
      this.indexingInProgress = false;
      this.indexingFailed = true;
      this.lastError = error instanceof Error ? error.message : String(error);
      throw new Error('Failed to initialize search index', { cause: error });
    }
  }

  /**
   * Index all markdown files in the vault
   */
  async indexVault(): Promise<void> {
    if (!this.index) {
      throw new Error('Search index not initialized');
    }

    try {
      console.log('Indexing vault...');

      const markdownFiles = this.app.vault.getMarkdownFiles();
      this.totalFiles = markdownFiles.length;
      this.currentFileIndex = 0;
      let filesIndexed = 0;

      for (const file of markdownFiles) {
        this.currentFileIndex++;
        try {
          // Track the number of files before indexing
          const beforeSize = this.fileModificationTimes.size;

          await this.indexFile(file);

          // If a new file was indexed or an existing file was updated
          if (
            beforeSize !== this.fileModificationTimes.size ||
            this.fileModificationTimes.get(file.path) === file.stat.mtime
          ) {
            filesIndexed++;
          }

          // Check if indexing has failed after each file
          if (this.indexingFailed) {
            console.log('Stopping indexing due to previous error');
            break;
          }
        } catch (error) {
          console.error(`Error indexing file ${file.path}:`, error);
          this.indexingFailed = true;
          this.lastError = error instanceof Error ? error.message : String(error);
          throw new Error('Error indexing files', { cause: error });
        }
      }

      console.log(`Indexed ${filesIndexed} files out of ${markdownFiles.length} total files`);
    } catch (error) {
      console.error('Error indexing vault:', error);
      this.lastError = error instanceof Error ? error.message : String(error);
      throw new Error('Failed to index vault', { cause: error });
    }
  }

  /**
   * Index a single file
   * @param file - The file to index
   */
  async indexFile(file: TFile): Promise<void> {
    if (!this.index) {
      throw new Error('Search index not initialized');
    }

    if (this.indexingFailed) {
      return;
    }

    try {
      // Get the file's last modified time
      const currentMtime = file.stat.mtime;

      // Check if the file is already indexed and if its modification time hasn't changed
      const lastMtime = this.fileModificationTimes.get(file.path);
      if (lastMtime && lastMtime === currentMtime) {
        console.log(`File ${file.path} hasn't changed since last indexing, skipping`);
        return;
      }

      // Check if the file already exists in the index by searching for its path
      const searchResults = await search(this.index, {
        term: file.path,
        properties: ['path'],
        exact: true,
      });

      // If the file already exists in the index, remove all its chunks
      if (searchResults.hits.length > 0) {
        console.log(`File ${file.path} has changed, removing existing chunks...`);

        // Remove each chunk from the index
        for (const hit of searchResults.hits) {
          const document = hit.document as NoteDocument;
          await remove(this.index, document.id);

          // Also remove from embeddings map if vector search is enabled
          if (this.useVectorSearch) {
            this.documentEmbeddings.delete(document.id);
          }
        }

        // Mark the index as dirty after removing chunks
        this.markDirty();

        console.log(`Removed ${searchResults.hits.length} existing chunks for file ${file.path}`);
      }

      const content = await this.app.vault.read(file);

      // Create the document object
      const document: NoteDocument = {
        id: file.path,
        title: file.basename,
        content: content,
        path: file.path,
      };

      // Split the document into chunks
      const chunks = this.chunkDocument(document);

      // Generate embeddings for chunks if vector search is enabled
      if (this.useVectorSearch && this.embeddingService) {
        for (const chunk of chunks) {
          try {
            // Generate embedding for the chunk (document/passage)
            const embedding = await this.embeddingService.getDocumentEmbedding(chunk.content);

            // Store the embedding in the chunk and in the map
            chunk.embedding = embedding;
            this.documentEmbeddings.set(chunk.id, embedding);
          } catch (error) {
            console.error(`Error generating embedding for chunk ${chunk.id}:`, error);
            // Rethrow the error to stop the indexing process
            throw new Error(`Failed to generate embedding for chunk ${chunk.id}`, { cause: error });
          }
        }
      }

      // Insert chunks into the index
      await insertMultiple(this.index, chunks);

      // Update the file modification time in our map
      this.fileModificationTimes.set(file.path, currentMtime);

      // Mark the index as dirty
      this.markDirty();

      console.log(`Indexed file ${file.path} with ${chunks.length} chunks`);
    } catch (error) {
      console.error(`Error indexing file ${file.path}:`, error);
      throw new Error(`Failed to index file ${file.path}`, { cause: error });
    }
  }

  /**
   * Perform vector similarity search
   * @param query - The search query
   * @param limit - Maximum number of results to return
   * @returns Promise with the search results
   */
  private async vectorSearch(
    query: string,
    limit?: number
  ): Promise<{ document: NoteDocument; score: number }[]> {
    // Use provided limit or fall back to class property
    const searchLimit = limit || this.maxSearchResults;
    if (!this.embeddingService || this.documentEmbeddings.size === 0) {
      console.warn(
        'Vector search not available: embedding service not initialized or no embeddings stored'
      );
      return [];
    }

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddingService.getQueryEmbedding(query);

      // Calculate similarity scores for all documents
      const results: { document: NoteDocument; score: number }[] = [];

      // Get all documents from the index
      const allDocs = await search(this.index, { limit: 1000 });

      for (const hit of allDocs.hits) {
        const document = hit.document as NoteDocument;
        const docId = document.id;

        // Get the embedding for this document
        const docEmbedding = this.documentEmbeddings.get(docId);

        if (docEmbedding) {
          // Calculate cosine similarity
          const similarity = this.embeddingService.cosineSimilarity(queryEmbedding, docEmbedding);

          results.push({
            document,
            score: similarity,
          });
        }
      }

      // Sort by similarity score (highest first)
      results.sort((a, b) => b.score - a.score);

      // Return top results
      return results.slice(0, searchLimit);
    } catch (error) {
      console.error('Error performing vector search:', error);
      return [];
    }
  }

  /**
   * Search the vault for relevant content
   * @param query - The search query
   * @returns Promise with the search results as formatted context
   */
  async searchVault(query: string): Promise<string> {
    try {
      let contextData = '';

      // Search vault if index is ready
      if (this.indexReady && this.index) {
        console.log('Searching vault...');

        let results;

        // Use hybrid search (vector + keyword) if vector search is enabled, otherwise use keyword search
        if (this.useVectorSearch && this.embeddingService) {
          console.log('Using hybrid search (vector + keyword)...');

          // Get vector search results
          const vectorResults = await this.vectorSearch(query, this.maxSearchResults * 2);

          // Get keyword search results
          const keywordSearchResults = await search(this.index, {
            term: query,
            limit: this.maxSearchResults * 2, // Increase limit for better hybrid results
          });

          // Convert keyword results to our format
          const keywordResults = keywordSearchResults.hits.map((hit) => ({
            document: hit.document as NoteDocument,
            score: hit.score,
          }));

          // Combine results, using a Map to avoid duplicates (by document ID)
          const combinedResultsMap = new Map<string, { document: NoteDocument; score: number }>();

          // Add vector results to the map
          for (const result of vectorResults) {
            combinedResultsMap.set(result.document.id, result);
          }

          // Add or update with keyword results
          for (const result of keywordResults) {
            const docId = result.document.id;
            if (combinedResultsMap.has(docId)) {
              // If document exists in both results, use the higher score
              const existingResult = combinedResultsMap.get(docId)!;
              if (result.score > existingResult.score) {
                combinedResultsMap.set(docId, result);
              }
            } else {
              combinedResultsMap.set(docId, result);
            }
          }

          // Convert map back to array and sort by score
          results = Array.from(combinedResultsMap.values())
            .sort((a, b) => b.score - a.score)
            .slice(0, this.maxSearchResults);
        } else {
          console.log('Using keyword search...');
          const searchResults = await search(this.index, {
            term: query,
            limit: this.maxSearchResults, // Limit to configured number of results
          });

          // Convert Orama results to our format
          results = searchResults.hits.map((hit) => ({
            document: hit.document as NoteDocument,
            score: hit.score,
          }));
        }

        console.log(`Found ${results.length} results`);

        if (results.length > 0) {
          contextData += 'Search results from vault:\n\n';

          for (const result of results) {
            const document = result.document;
            contextData += `## ${document.title}\n`;
            contextData += `Path: ${document.path}\n`;
            contextData += `Score: ${result.score.toFixed(4)}\n`;

            // Extract a relevant snippet from the content
            const content = document.content;
            const maxSnippetLength = 500; // Limit snippet length

            if (content.length <= maxSnippetLength) {
              contextData += `\n${content}\n\n`;
            } else {
              // Try to find the query in the content for better context
              const queryIndex = content.toLowerCase().indexOf(query.toLowerCase());

              if (queryIndex >= 0) {
                // Extract content around the query
                const start = Math.max(0, queryIndex - 200);
                const end = Math.min(content.length, queryIndex + 300);
                contextData += `\n${content.substring(start, end)}...\n\n`;
              } else {
                // If query not found, just take the beginning
                contextData += `\n${content.substring(0, maxSnippetLength)}...\n\n`;
              }
            }

            contextData += '---\n\n';
          }
        }
      }

      return contextData || 'No relevant content found in the vault.';
    } catch (error) {
      console.error('Error searching vault:', error);
      return 'Error searching vault.';
    }
  }

  /**
   * Check if the index is ready
   * @returns Boolean indicating if the index is ready
   */
  isIndexReady(): boolean {
    return this.indexReady;
  }

  /**
   * Check if indexing has failed
   * @returns Boolean indicating if indexing has failed
   */
  isIndexingFailed(): boolean {
    return this.indexingFailed;
  }

  /**
   * Get the current indexing status
   * @returns Object with status information
   */
  getIndexingStatus(): { status: string; message: string } {
    if (this.indexingInProgress) {
      return {
        status: 'indexing',
        message: `Indexing ${this.currentFileIndex} of ${this.totalFiles}...`,
      };
    }

    if (this.indexingFailed) {
      return {
        status: 'error',
        message: this.lastError || 'An error occurred during indexing',
      };
    }

    if (this.indexReady) {
      return {
        status: 'ready',
        message: 'Ready',
      };
    }

    return {
      status: 'initializing',
      message: 'Initializing...',
    };
  }

  /**
   * Clear the index and reindex all documents
   * @returns Promise that resolves when reindexing is complete
   */
  async reindexAll(): Promise<void> {
    try {
      console.log('Clearing index and reindexing all documents...');

      // Reset state
      this.indexReady = false;
      this.documentEmbeddings.clear();
      this.fileModificationTimes.clear();
      this.indexingFailed = false;

      // Delete the index file from disk
      const exists = await this.app.vault.adapter.exists(this.indexFilePath);
      if (exists) {
        console.log(`Deleting existing index file: ${this.indexFilePath}`);
        await this.app.vault.adapter.remove(this.indexFilePath);
      }

      // Initialize a new index (this will create a fresh one)
      await this.initializeIndex();

      console.log('Reindexing completed successfully');
    } catch (error) {
      console.error('Error during reindexing:', error);
      throw new Error('Failed to reindex all documents', { cause: error });
    }
  }

  /**
   * Save the search index to disk
   * @returns Promise that resolves when the index is saved
   */
  async save(): Promise<void> {
    if (!this.index || !this.indexReady) {
      throw new Error("Can't save index: index not ready");
    }

    try {
      console.log(`Saving search index to ${this.indexFilePath}...`);

      // Serialize the index to a JSON-formatted string
      const serializedIndex = await persist(this.index, 'json');

      // Create an object with both the serialized index and the file modification times
      const dataToSave = {
        serializedIndex,
        fileModificationTimes: Object.fromEntries(this.fileModificationTimes),
        documentEmbeddings: this.useVectorSearch ? Object.fromEntries(this.documentEmbeddings) : {},
      };

      // Convert the object to a JSON string
      const jsonData = JSON.stringify(dataToSave);

      // Write the data to a file using Obsidian's API
      await this.app.vault.adapter.write(this.indexFilePath, jsonData);

      // Clear the dirty mark after saving
      this.isDirty = false;
      this.dirtyTimestamp = 0;
      // Stop the save timer if it exists
      if (this.saveTimer) {
        clearInterval(this.saveTimer);
        this.saveTimer = null;
      }

      console.log('Search index saved successfully');
    } catch (error) {
      console.error('Error saving search index:', error);
      throw new Error('Failed to save search index', { cause: error });
    }
  }

  /**
   * Load the search index from disk
   * @returns Promise that resolves when the index is loaded
   */
  async load(): Promise<boolean> {
    try {
      console.log(`Loading search index from ${this.indexFilePath}...`);

      // Check if the index file exists
      const exists = await this.app.vault.adapter.exists(this.indexFilePath);
      if (!exists) {
        console.log('No saved index found, creating a new one');
        return false;
      }

      // Read the data from the file using Obsidian's API
      const jsonData = await this.app.vault.adapter.read(this.indexFilePath);

      // Parse the JSON string to an object
      const parsedData = JSON.parse(jsonData);

      // Restore the index using the serialized data
      this.index = await restore('json', parsedData.serializedIndex);

      // Extract the file modification times
      this.fileModificationTimes = new Map(Object.entries(parsedData.fileModificationTimes));

      // Restore document embeddings if vector search is enabled
      if (this.useVectorSearch && parsedData.documentEmbeddings) {
        this.documentEmbeddings = new Map(Object.entries(parsedData.documentEmbeddings));
      }

      this.indexReady = true;
      console.log('Search index loaded successfully');
      return true;
    } catch (error) {
      console.error('Error loading search index:', error);
      return false;
    }
  }

  /**
   * Clean up resources used by the search service
   */
  cleanup(): void {
    // Clear the save timer if it exists
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }

    // Save the index if it's dirty
    if (this.isDirty && this.indexReady) {
      this.save().catch((error) => {
        console.error('Error saving index during cleanup:', error);
      });
    }
  }
}
