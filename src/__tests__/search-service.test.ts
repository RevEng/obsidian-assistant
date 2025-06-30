import { SearchService, SearchOptions, ChunkingOptions, NoteDocument } from '../search-service';
import { App, TFile } from 'obsidian';
import {
  create,
  insertMultiple,
  search,
  remove,
} from '@orama/orama';
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

// Mock EmbeddingService
jest.mock('../embedding-service', () => {
  return {
    EmbeddingService: jest.fn().mockImplementation(() => {
      return {
        getEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
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

    // Create mock files
    mockFiles = [
      { path: 'test-file-path', basename: 'Test File', extension: 'md' } as TFile,
      { path: 'another-file-path', basename: 'Another File', extension: 'md' } as TFile,
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

    // Set up mock workspace for getCurrentNoteContent testing
    (mockApp.workspace as any).getActiveFile = jest.fn().mockReturnValue(mockFiles[0]);

    // Create a new instance for each test
    searchService = new SearchService(mockApp);
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

  test('should initialize index correctly', async () => {
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
        limit: 100,
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
});
