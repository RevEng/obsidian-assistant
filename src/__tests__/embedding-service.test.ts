import { EmbeddingService, EmbeddingServiceConfig } from '../embedding-service';
import { requestUrl } from 'obsidian';

// Mock requestUrl is already set up in __mocks__/obsidian.js
jest.mock('obsidian');

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;
  const mockConfig: EmbeddingServiceConfig = {
    service: 'ollama',
    serviceUrl: 'http://localhost:11434',
    model: 'nomic-embed-text',
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create a new instance for each test
    embeddingService = new EmbeddingService(mockConfig);

    // Mock successful requestUrl response
    (requestUrl as jest.Mock).mockResolvedValue({
      status: 200,
      text: '',
      json: {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
      },
    });
  });

  test('should initialize with the provided config', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((embeddingService as any).config).toEqual(mockConfig);
  });

  test('should update config correctly', () => {
    const newConfig: EmbeddingServiceConfig = {
      service: 'ollama',
      serviceUrl: 'http://localhost:8000',
      model: 'different-model',
    };

    embeddingService.updateConfig(newConfig);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((embeddingService as any).config).toEqual(newConfig);
  });

  test('should get document embeddings correctly', async () => {
    const text = 'This is a test document text';
    const embedding = await embeddingService.getDocumentEmbedding(text);

    // Check that requestUrl was called with the correct parameters
    expect(requestUrl).toHaveBeenCalledWith({
      url: 'http://localhost:11434/api/embeddings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: text,
        input_type: 'passage',
      }),
    });

    // Check that the embedding is returned correctly
    expect(embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
  });

  test('should get query embeddings correctly', async () => {
    const text = 'This is a test query text';
    const embedding = await embeddingService.getQueryEmbedding(text);

    // Check that requestUrl was called with the correct parameters
    expect(requestUrl).toHaveBeenCalledWith({
      url: 'http://localhost:11434/api/embeddings',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'nomic-embed-text',
        prompt: text,
        input_type: 'query',
      }),
    });

    // Check that the embedding is returned correctly
    expect(embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
  });

  test('should handle API errors', async () => {
    // Mock a failed requestUrl response
    (requestUrl as jest.Mock).mockResolvedValue({
      status: 500,
      text: 'Internal Server Error',
      json: {},
    });

    const text = 'This is a test text';

    // The getDocumentEmbedding method should throw an error
    await expect(embeddingService.getDocumentEmbedding(text)).rejects.toThrow();
  });

  test('should calculate cosine similarity correctly', () => {
    const vec1 = [1, 0, 0, 0];
    const vec2 = [0, 1, 0, 0];
    const vec3 = [1, 1, 0, 0];

    // Orthogonal vectors should have similarity 0
    expect(embeddingService.cosineSimilarity(vec1, vec2)).toBe(0);

    // Same vector should have similarity 1
    expect(embeddingService.cosineSimilarity(vec1, vec1)).toBe(1);

    // 45-degree angle should have similarity 0.7071 (approximately)
    const similarity = embeddingService.cosineSimilarity(vec1, vec3);
    expect(similarity).toBeCloseTo(0.7071, 4);
  });

  test('should throw error for vectors of different lengths', () => {
    const vec1 = [1, 2, 3];
    const vec2 = [1, 2, 3, 4];

    expect(() => embeddingService.cosineSimilarity(vec1, vec2)).toThrow();
  });
});
