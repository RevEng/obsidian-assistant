import { Notice } from 'obsidian';

/**
 * Interface for embedding service configuration
 */
export interface EmbeddingServiceConfig {
  serviceUrl: string;
  model: string;
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
      // Prepare request to Ollama API
      const body = JSON.stringify({
        model: this.config.model,
        prompt: text,
      });

      console.log(
        `Getting embedding for text (${text.length} chars) using model ${this.config.model}`
      );

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
    } catch (error) {
      console.error('Error getting embedding:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Error getting embedding: ${errorMessage}`);
      throw error;
    }
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
