import { SearchService, SearchOptions, ChunkingOptions, NoteDocument } from '../search-service';
import { App, TFile } from 'obsidian';
import { create, insertMultiple, search, remove } from '@orama/orama';
import { persist, restore } from '@orama/plugin-data-persistence';
import { EmbeddingService, EmbeddingServiceConfig } from '../embedding-service';

// Mock @orama/orama functions
jest.mock('@orama/orama', () => ({
  create: jest.fn().mockResolvedValue({ id: 'mock-index' }),
  insertMultiple: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  search: jest.fn().mockResolvedValue({
    hits: [
      {
        document: {
          id: 'test-file-path-chunk-0',
          title: 'Test File',
          content: 'This is test content that matches the search query.',
          path: 'test-file-path',
        },
        score: 0.75,
      },
    ],
  }),
}));

// Mock @orama/plugin-data-persistence functions
jest.mock('@orama/plugin-data-persistence', () => ({
  persist: jest.fn().mockResolvedValue('serialized-index-data'),
  restore: jest.fn().mockResolvedValue({ id: 'mock-loaded-index' }),
}));

// Mock EmbeddingService
jest.mock('../embedding-service', () => {
  return {
    EmbeddingService: jest.fn().mockImplementation(() => {
      return {
        getDocumentEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
        getQueryEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
        cosineSimilarity: jest.fn().mockReturnValue(0.85),
        updateConfig: jest.fn(),
      };
    }),
  };
});

// Mock for testing reindexing
const mockSearchResultsWithExistingFile = {
  hits: [
    {
      document: {
        id: 'test-file-path-chunk-0',
        title: 'Test File',
        content: 'This is test content that matches the search query.',
        path: 'test-file-path',
      },
      score: 0.75,
    },
    {
      document: {
        id: 'test-file-path-chunk-1',
        title: 'Test File',
        content: 'This is more test content for the same file.',
        path: 'test-file-path',
      },
      score: 0.65,
    },
  ],
};

describe('SearchService', () => {
  let searchService: SearchService;
  let mockApp: App;
  let mockFiles: TFile[];

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock files with stat property including mtime
    mockFiles = [
      {
        path: 'test-file-path',
        basename: 'Test File',
        extension: 'md',
        stat: {
          ctime: 1234567890000,
          mtime: 1234567890000,
          size: 1000,
        },
      } as TFile,
      {
        path: 'another-file-path',
        basename: 'Another File',
        extension: 'md',
        stat: {
          ctime: 1234567890000,
          mtime: 1234567890000,
          size: 1000,
        },
      } as TFile,
    ];

    // Set up mock app
    mockApp = new App();
    (mockApp.vault.getMarkdownFiles as jest.Mock).mockReturnValue(mockFiles);
    (mockApp.vault.read as jest.Mock).mockImplementation(async (file: TFile) => {
      if (file.path === 'test-file-path') {
        return 'This is test content for the first file.';
      } else if (file.path === 'another-file-path') {
        return 'This is test content for the second file.';
      }
      return '';
    });

    // Set up mock vault.configDir and adapter methods
    (mockApp.vault as any).configDir = '.obsidian';
    (mockApp.vault.adapter as any) = {
      exists: jest.fn().mockResolvedValue(true),
      read: jest.fn().mockResolvedValue(
        JSON.stringify({
          serializedIndex: 'serialized-index-data',
          fileModificationTimes: { 'test-file-path': 1234567890000 },
          documentEmbeddings: { 'test-file-path-chunk-0': [0.1, 0.2, 0.3, 0.4, 0.5] },
        })
      ),
      write: jest.fn().mockResolvedValue(undefined),
    };

    // Set up mock workspace for getCurrentNoteContent testing
    (mockApp.workspace as any).getActiveFile = jest.fn().mockReturnValue(mockFiles[0]);

    // Create a new instance for each test
    searchService = new SearchService(mockApp);
  });

  afterEach(() => {
    // Clean up any timers to prevent memory leaks
    if (searchService) {
      searchService.cleanup();
    }
  });

  test('should initialize with default chunking options', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((searchService as any).chunkingOptions).toEqual({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
  });

  test('should update chunking options correctly', () => {
    const newOptions: ChunkingOptions = {
      chunkSize: 500,
      chunkOverlap: 100,
    };

    searchService.updateChunkingOptions(newOptions);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((searchService as any).chunkingOptions).toEqual(newOptions);
  });

  test('should initialize index correctly by loading from disk', async () => {
    // Mock adapter.exists to return true to simulate existing index file
    (mockApp.vault.adapter.exists as jest.Mock).mockResolvedValue(true);

    await searchService.initializeIndex();

    // Check that the adapter.read and restore were called to load the index
    expect(mockApp.vault.adapter.read).toHaveBeenCalledWith('.obsidian/search-index.json');
    expect(restore).toHaveBeenCalled();

    // Check that indexVault was called to update the index
    expect(mockApp.vault.getMarkdownFiles).toHaveBeenCalled();

    // Check that persist and adapter.write were called to save the updated index
    expect(persist).toHaveBeenCalled();
    expect(mockApp.vault.adapter.write).toHaveBeenCalled();

    // Check that indexReady is set to true
    expect(searchService.isIndexReady()).toBe(true);
  });

  test('should initialize index correctly by creating new when no saved index exists', async () => {
    // Mock adapter.exists to return false to simulate no existing index file
    (mockApp.vault.adapter.exists as jest.Mock).mockResolvedValue(false);

    await searchService.initializeIndex();

    // Check that create was called with the correct schema
    expect(create).toHaveBeenCalledWith({
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

    // Check that indexVault was called
    expect(mockApp.vault.getMarkdownFiles).toHaveBeenCalled();
    expect(insertMultiple).toHaveBeenCalled();

    // Check that persist and adapter.write were called to save the new index
    expect(persist).toHaveBeenCalled();
    expect(mockApp.vault.adapter.write).toHaveBeenCalled();

    // Check that indexReady is set to true
    expect(searchService.isIndexReady()).toBe(true);
  });

  test('should search vault correctly with keyword search', async () => {
    // Initialize the index first
    await searchService.initializeIndex();

    const searchOptions: SearchOptions = {
      useCurrentNote: false,
      useVaultSearch: true,
      useVectorSearch: false,
    };

    const result = await searchService.searchVault('test query', searchOptions);

    // Check that search was called
    expect(search).toHaveBeenCalled();

    // Check that the result contains the expected content
    expect(result).toContain('Search results from vault:');
    expect(result).toContain('Test File');
  });

  test('should initialize with embedding configuration', () => {
    const embeddingConfig: EmbeddingServiceConfig = {
      service: 'ollama',
      serviceUrl: 'http://localhost:11434',
      model: 'nomic-embed-text',
    };

    const searchServiceWithEmbedding = new SearchService(
      mockApp,
      { chunkSize: 1000, chunkOverlap: 200 },
      embeddingConfig,
      true
    );

    // Check that the embedding service was initialized
    expect(EmbeddingService).toHaveBeenCalledWith(embeddingConfig);

    // Check that useVectorSearch is set correctly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((searchServiceWithEmbedding as any).useVectorSearch).toBe(true);
  });

  test('should update embedding configuration correctly', () => {
    const embeddingConfig: EmbeddingServiceConfig = {
      service: 'ollama',
      serviceUrl: 'http://localhost:11434',
      model: 'nomic-embed-text',
    };

    searchService.updateEmbeddingConfig(embeddingConfig, true);

    // Check that the embedding service was initialized
    expect(EmbeddingService).toHaveBeenCalledWith(embeddingConfig);

    // Check that useVectorSearch is set correctly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((searchService as any).useVectorSearch).toBe(true);
  });

  test('should search vault correctly with hybrid search (vector + keyword)', async () => {
    // Initialize the index first
    await searchService.initializeIndex();

    // Mock the search function to return documents for vector search
    (search as jest.Mock).mockResolvedValueOnce({
      hits: [
        {
          document: {
            id: 'test-file-path-chunk-0',
            title: 'Test File',
            content: 'This is test content that matches the search query.',
            path: 'test-file-path',
          },
          score: 0.75,
        },
      ],
    });

    // Set up embedding service
    const embeddingConfig: EmbeddingServiceConfig = {
      service: 'ollama',
      serviceUrl: 'http://localhost:11434',
      model: 'nomic-embed-text',
    };
    searchService.updateEmbeddingConfig(embeddingConfig, true);

    // Mock the documentEmbeddings Map
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (searchService as any).documentEmbeddings.set(
      'test-file-path-chunk-0',
      [0.1, 0.2, 0.3, 0.4, 0.5]
    );

    const searchOptions: SearchOptions = {
      useCurrentNote: false,
      useVaultSearch: true,
      useVectorSearch: true,
    };

    const result = await searchService.searchVault('test query', searchOptions);

    // Check that search was called to get all documents
    expect(search).toHaveBeenCalled();

    // Check that the result contains the expected content
    expect(result).toContain('Search results from vault:');
    expect(result).toContain('Test File');
    expect(result).toContain('Score:');
  });

  test('should chunk large documents correctly', () => {
    // Create a document with 100 words of lorem ipsum
    const loremIpsum =
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.';

    const document: NoteDocument = {
      id: 'test-long-doc',
      title: 'Test Long Document',
      content: loremIpsum,
      path: 'test-long-doc-path',
    };

    // Set chunking options to 200 size with 50 overlap
    searchService.updateChunkingOptions({
      chunkSize: 200,
      chunkOverlap: 50,
    });

    // Call the private chunkDocument method
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chunks = (searchService as any).chunkDocument(document);

    // Verify that the document is chunked correctly
    expect(chunks.length).toBeGreaterThan(0);

    // Verify the IDs of chunks
    chunks.forEach((chunk: NoteDocument, index: number) => {
      expect(chunk.id).toBe(`test-long-doc-chunk-${index}`);
      expect(chunk.title).toBe('Test Long Document');
      expect(chunk.path).toBe('test-long-doc-path');
    });

    // Verify first chunk starts at the beginning of the document
    expect(chunks[0].content.startsWith('Lorem ipsum')).toBe(true);

    // Verify that chunks have the correct size (except possibly the last one)
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(chunks[i].content.length).toBe(200);
    }

    // Verify that chunks have the correct overlap
    for (let i = 1; i < chunks.length; i++) {
      const prevChunkEnd = chunks[i - 1].content.substring(chunks[i - 1].content.length - 50);
      const currentChunkStart = chunks[i].content.substring(0, 50);
      expect(prevChunkEnd).toBe(currentChunkStart);
    }

    // Verify that the chunks cover the entire document
    let reconstructedContent = chunks[0].content;
    for (let i = 1; i < chunks.length; i++) {
      reconstructedContent += chunks[i].content.substring(50);
    }
    expect(reconstructedContent).toBe(loremIpsum);
  });

  test('should remove existing chunks when reindexing a file', async () => {
    // Create a standalone test that doesn't depend on other tests

    // Create a new instance of SearchService for this test
    const testSearchService = new SearchService(mockApp);

    // Mock the index property directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).index = { id: 'mock-index-for-reindex-test' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).indexReady = true;

    // Reset all mocks
    jest.clearAllMocks();

    // Set up the search mock to return existing chunks for the first call
    // and empty results for subsequent calls
    (search as jest.Mock)
      .mockResolvedValueOnce(mockSearchResultsWithExistingFile) // First call returns existing chunks
      .mockResolvedValue({ hits: [] }); // Subsequent calls return empty results

    // Call indexFile to reindex the file
    await testSearchService.indexFile(mockFiles[0]);

    // Verify that search was called to check for existing chunks
    expect(search).toHaveBeenCalledWith(
      { id: 'mock-index-for-reindex-test' }, // The mock index we set
      {
        term: 'test-file-path',
        properties: ['path'],
        exact: true,
      }
    );

    // Verify that remove was called for each existing chunk
    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledWith(
      { id: 'mock-index-for-reindex-test' },
      'test-file-path-chunk-0'
    );
    expect(remove).toHaveBeenCalledWith(
      { id: 'mock-index-for-reindex-test' },
      'test-file-path-chunk-1'
    );

    // Verify that insertMultiple was called to add the new chunks
    expect(insertMultiple).toHaveBeenCalled();
  });

  test('should stop indexing when error occurs', async () => {
    // Create a new instance of SearchService
    const testSearchService = new SearchService(mockApp, { chunkSize: 1000, chunkOverlap: 200 });

    // Mock the index property directly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).index = { id: 'mock-index-for-error-test' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).indexReady = true;

    // Reset all mocks
    jest.clearAllMocks();

    // Set up the search mock to return no existing chunks
    (search as jest.Mock).mockResolvedValue({ hits: [] });

    // Mock the app.vault.read method to throw a generic error
    (mockApp.vault.read as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Generic error occurred while reading file');
    });

    // Call indexFile and expect it to throw an error
    await expect(testSearchService.indexFile(mockFiles[0])).rejects.toThrow(
      'Generic error occurred while reading file'
    );

    // Verify that insertMultiple was not called, which means indexing was stopped
    expect(insertMultiple).not.toHaveBeenCalled();
  });

  test('should stop indexing all files when error occurs in embedding service', async () => {
    // Create a new instance of SearchService with vector search enabled
    const embeddingConfig: EmbeddingServiceConfig = {
      service: 'ollama',
      serviceUrl: 'http://localhost:11434',
      model: 'nomic-embed-text',
    };

    const testSearchService = new SearchService(
      mockApp,
      { chunkSize: 1000, chunkOverlap: 200 },
      embeddingConfig,
      true
    );

    // Reset all mocks
    jest.clearAllMocks();

    // Mock the create function to return a mock index
    (create as jest.Mock).mockResolvedValue({ id: 'mock-index-for-embedding-error-test' });

    // Set up the search mock to return no existing chunks
    (search as jest.Mock).mockResolvedValue({ hits: [] });

    // Mock the EmbeddingService.getDocumentEmbedding to throw an error on the first call
    const mockEmbeddingService = new EmbeddingService(embeddingConfig);
    (mockEmbeddingService.getDocumentEmbedding as jest.Mock).mockImplementationOnce(() => {
      throw new Error('Ollama embedding service error');
    });

    // Replace the embedding service in the search service with our mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).embeddingService = mockEmbeddingService;

    // Call initializeIndex and expect it to throw an error
    await expect(testSearchService.initializeIndex()).rejects.toThrow(
      'Ollama embedding service error'
    );

    // Verify that the indexingFailed flag is set to true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((testSearchService as any).indexingFailed).toBe(true);

    // Verify that app.vault.read was called only once
    // This confirms that indexing stopped after the first file
    expect(mockApp.vault.read).toHaveBeenCalledTimes(1);

    // Verify that only one of the files was processed
    // The exact order of processing might vary, so we check that exactly one file was processed
    const mockRead = mockApp.vault.read as jest.Mock;
    const firstFileProcessed = mockRead.mock.calls.some(
      (call: any[]) => call[0] === mockFiles[0]
    );
    const secondFileProcessed = mockRead.mock.calls.some(
      (call: any[]) => call[0] === mockFiles[1]
    );

    // Exactly one of the files should have been processed
    expect(firstFileProcessed || secondFileProcessed).toBe(true);
    expect(firstFileProcessed && secondFileProcessed).toBe(false);
  });

  test('should save index to disk', async () => {
    // Create a new instance of SearchService
    const testSearchService = new SearchService(mockApp);

    // Mock the index property and set indexReady to true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).index = { id: 'mock-index-for-save-test' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).indexReady = true;

    // Add some file modification times
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).fileModificationTimes.set('test-file-path', 1234567890000);

    // Reset all mocks
    jest.clearAllMocks();

    // Call save method
    await testSearchService.save();

    // Verify that persist was called with the correct arguments
    expect(persist).toHaveBeenCalledWith({ id: 'mock-index-for-save-test' }, 'json');

    // Verify that adapter.write was called with the correct arguments
    expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
      '.obsidian/search-index.json',
      expect.any(String) // The JSON string containing the serialized index and metadata
    );
  });

  test('should load index from disk', async () => {
    // Create a new instance of SearchService
    const testSearchService = new SearchService(mockApp);

    // Reset all mocks
    jest.clearAllMocks();

    // Mock adapter.exists to return true
    (mockApp.vault.adapter.exists as jest.Mock).mockResolvedValue(true);

    // Call load method
    const result = await testSearchService.load();

    // Verify that adapter.read was called with the correct arguments
    expect(mockApp.vault.adapter.read).toHaveBeenCalledWith('.obsidian/search-index.json');

    // Verify that restore was called with the correct arguments
    expect(restore).toHaveBeenCalledWith('json', expect.any(String));

    // Verify that the index was loaded correctly
    expect(result).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((testSearchService as any).index).toEqual({ id: 'mock-loaded-index' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((testSearchService as any).fileModificationTimes.get('test-file-path')).toBe(
      1234567890000
    );
    expect(testSearchService.isIndexReady()).toBe(true);
  });

  test('should handle case when no saved index exists', async () => {
    // Create a new instance of SearchService
    const testSearchService = new SearchService(mockApp);

    // Reset all mocks
    jest.clearAllMocks();

    // Mock adapter.exists to return false
    (mockApp.vault.adapter.exists as jest.Mock).mockResolvedValue(false);

    // Call load method
    const result = await testSearchService.load();

    // Verify that adapter.read and restore were not called
    expect(mockApp.vault.adapter.read).not.toHaveBeenCalled();
    expect(restore).not.toHaveBeenCalled();

    // Verify that the result is false
    expect(result).toBe(false);
  });

  test('should skip indexing unchanged files', async () => {
    // Create a new instance of SearchService
    const testSearchService = new SearchService(mockApp);

    // Mock the index property
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).index = { id: 'mock-index-for-mtime-test' };

    // Add the file to the fileModificationTimes map with the same mtime as the file
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).fileModificationTimes.set('test-file-path', 1234567890000);

    // Reset all mocks
    jest.clearAllMocks();

    // Call indexFile
    await testSearchService.indexFile(mockFiles[0]);

    // Verify that search was not called (file was skipped)
    expect(search).not.toHaveBeenCalled();

    // Verify that insertMultiple was not called (file was skipped)
    expect(insertMultiple).not.toHaveBeenCalled();
  });

  test('should reindex files with changed modification time', async () => {
    // Create a new instance of SearchService
    const testSearchService = new SearchService(mockApp);

    // Mock the index property
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).index = { id: 'mock-index-for-mtime-test' };

    // Add the file to the fileModificationTimes map with a different mtime
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).fileModificationTimes.set('test-file-path', 1234567890001); // Different mtime

    // Reset all mocks
    jest.clearAllMocks();

    // Set up the search mock to return existing chunks
    (search as jest.Mock).mockResolvedValueOnce(mockSearchResultsWithExistingFile);

    // Call indexFile
    await testSearchService.indexFile(mockFiles[0]);

    // Verify that search was called (file was not skipped)
    expect(search).toHaveBeenCalled();

    // Verify that remove was called for each existing chunk
    expect(remove).toHaveBeenCalledTimes(2);

    // Verify that insertMultiple was called to add the new chunks
    expect(insertMultiple).toHaveBeenCalled();

    // Verify that the file modification time was updated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((testSearchService as any).fileModificationTimes.get('test-file-path')).toBe(
      1234567890000
    );
  });

  test('should mark index as dirty after modifications', async () => {
    // Create a new instance of SearchService
    const testSearchService = new SearchService(mockApp);

    // Mock the index property and set indexReady to true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).index = { id: 'mock-index-for-dirty-test' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).indexReady = true;

    // Reset all mocks
    jest.clearAllMocks();

    // Set up the search mock to return no existing chunks
    (search as jest.Mock).mockResolvedValue({ hits: [] });

    // Call indexFile to modify the index
    await testSearchService.indexFile(mockFiles[0]);

    // Verify that the index is marked as dirty
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((testSearchService as any).isDirty).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((testSearchService as any).dirtyTimestamp).toBeGreaterThan(0);
  });

  test('should clear dirty mark after saving', async () => {
    // Create a new instance of SearchService
    const testSearchService = new SearchService(mockApp);

    // Mock the index property and set indexReady to true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).index = { id: 'mock-index-for-save-dirty-test' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).indexReady = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).isDirty = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).dirtyTimestamp = Date.now();

    // Reset all mocks
    jest.clearAllMocks();

    // Call save method
    await testSearchService.save();

    // Verify that the dirty mark is cleared
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((testSearchService as any).isDirty).toBe(false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((testSearchService as any).dirtyTimestamp).toBe(0);
  });

  test('should clean up timer and save dirty index on cleanup', async () => {
    // Create a new instance of SearchService
    const testSearchService = new SearchService(mockApp);

    // Mock the index property and set indexReady to true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).index = { id: 'mock-index-for-cleanup-test' };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).indexReady = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).isDirty = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).dirtyTimestamp = Date.now();

    // Create a mock timer
    const mockTimer = setInterval(() => {}, 1000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (testSearchService as any).saveTimer = mockTimer;

    // Spy on clearInterval
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    // Reset all mocks
    jest.clearAllMocks();

    // Call cleanup method
    testSearchService.cleanup();

    // Verify that clearInterval was called with the timer
    expect(clearIntervalSpy).toHaveBeenCalledWith(mockTimer);

    // Verify that save was called because the index was dirty
    expect(persist).toHaveBeenCalled();

    // Clean up spy
    clearIntervalSpy.mockRestore();
  });
});
