import { Notice } from 'obsidian';

/**
 * Interface for embedding service configuration
 */
export interface EmbeddingServiceConfig {
  service: string;
  serviceUrl: string;
  model: string;
  apiKey?: string;
}

/**
 * Class for handling embedding service interactions
 */
export class EmbeddingService {
  private config: EmbeddingServiceConfig;

  /**
   * Constructor
   * @param config - Embedding service configuration
   */
  constructor(config: EmbeddingServiceConfig) {
    this.config = config;
  }

  /**
   * Update the service configuration
   * @param config - New embedding service configuration
   */
  updateConfig(config: EmbeddingServiceConfig): void {
    this.config = config;
  }

  /**
   * Get embeddings for a text
   * @param text - Text to get embeddings for
   * @returns Promise with the embedding vector
   */
  async getEmbedding(text: string): Promise<number[]> {
    try {
      // Handle different embedding services
      switch (this.config.service) {
        case 'ollama':
          return await this.getOllamaEmbedding(text);
        case 'openai':
          return await this.getOpenAIEmbedding(text);
        default:
          throw new Error(`Unsupported embedding service: ${this.config.service}`);
      }
    } catch (error) {
      console.error('Error getting embedding:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Error getting embedding: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get embeddings from Ollama API
   * @param text - Text to get embeddings for
   * @returns Promise with the embedding vector
   */
  private async getOllamaEmbedding(text: string): Promise<number[]> {
    // Prepare request to Ollama API
    const body = JSON.stringify({
      model: this.config.model,
      prompt: text,
    });

    const response = await fetch(`${this.config.serviceUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.embedding || [];
  }

  /**
   * Get embeddings from OpenAI API
   * @param text - Text to get embeddings for
   * @returns Promise with the embedding vector
   */
  private async getOpenAIEmbedding(text: string): Promise<number[]> {
    // Prepare headers with API key if provided
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    // Prepare request to OpenAI API
    const body = JSON.stringify({
      model: this.config.model,
      input: text,
    });

    const response = await fetch(`${this.config.serviceUrl}/v1/embeddings`, {
      method: 'POST',
      headers: headers,
      body: body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.data?.[0]?.embedding || [];
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param vec1 - First vector
   * @param vec2 - Second vector
   * @returns Cosine similarity score (between -1 and 1)
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let mag1 = 0;
    let mag2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      mag1 += vec1[i] * vec1[i];
      mag2 += vec2[i] * vec2[i];
    }

    mag1 = Math.sqrt(mag1);
    mag2 = Math.sqrt(mag2);

    if (mag1 === 0 || mag2 === 0) {
      return 0;
    }

    return dotProduct / (mag1 * mag2);
  }
}
