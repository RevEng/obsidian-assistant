import { Notice, requestUrl } from 'obsidian';

/**
 * Interface for LLM service configuration
 */
export interface LLMServiceConfig {
  service: string;
  model: string;
  serviceUrl: string;
  systemPrompt?: string;
  apiKey?: string;
  maxContextLength?: number;
}

/**
 * Interface for chat message
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Class for handling LLM service interactions
 */
export class LLMService {
  private config: LLMServiceConfig;
  private isCancelled = false;

  /**
   * Constructor
   * @param config - LLM service configuration
   */
  constructor(config: LLMServiceConfig) {
    this.config = config;
  }

  /**
   * Cancel the current request if one is in progress
   */
  cancelRequest(): void {
    this.isCancelled = true;
  }

  /**
   * Update the service configuration
   * @param config - New LLM service configuration
   */
  updateConfig(config: LLMServiceConfig): void {
    this.config = config;
  }

  /**
   * Generate a retrieval query based on the full message history
   * @param messages - Array of chat messages
   * @returns Promise with the generated retrieval query
   */
  async generateRetrievalQuery(messages: ChatMessage[]): Promise<string> {
    try {
      // Create a system message with instructions for generating a retrieval query
      const systemMessage: ChatMessage = {
        role: 'system',
        content: `You are a retrieval query generator. Your task is to generate a search query based on the conversation history.

The query should:
- Consider whether the user is asking a question or making a statement
- Consider whether the latest message is related to the previous messages
- Consider anything implied by the message history, such as things referenced by pronouns
- Be based on the user's intent
- Expand on any vocabulary, using additional keywords and concepts that are closely related to the user's message
- Be concise but comprehensive

Return ONLY the search query text without any explanations or additional formatting.`,
      };

      // Create a new message asking for a retrieval query
      const queryMessage: ChatMessage = {
        role: 'user',
        content:
          'Based on this conversation history, generate a retrieval query that will help find the most relevant information.',
      };

      // Combine all messages
      const allMessages: ChatMessage[] = [systemMessage, ...messages, queryMessage];

      // Handle different LLM services
      let retrievalQuery = '';
      switch (this.config.service) {
        case 'ollama':
          retrievalQuery = await this.callOllama(allMessages);
          break;
        case 'openai':
          retrievalQuery = await this.callOpenAI(allMessages);
          break;
        case 'anthropic':
          retrievalQuery = await this.callAnthropic(allMessages);
          break;
        default:
          throw new Error(`Unsupported LLM service: ${this.config.service}`);
      }

      console.log('Generated retrieval query:', retrievalQuery);
      return retrievalQuery.trim();
    } catch (error) {
      console.error('Error generating retrieval query:', error);
      // If there's an error, return the last user message as fallback
      const lastUserMessage = [...messages].reverse().find((msg) => msg.role === 'user');
      return lastUserMessage?.content || '';
    }
  }

  /**
   * Send a message to the LLM service and get a response
   * @param messages - Array of chat messages
   * @param contextData - Optional context data from the vault
   * @returns Promise with the LLM response
   */
  async sendMessage(messages: ChatMessage[], contextData?: string): Promise<string> {
    try {
      // Reset cancellation flag at the start of a new request
      this.isCancelled = false;

      // Create a single system message if needed
      const allMessages: ChatMessage[] = [];

      // Combine system prompt and context data into a single system message if either is provided
      if (this.config.systemPrompt || contextData) {
        let systemContent = '';

        // Add system prompt if provided
        if (this.config.systemPrompt) {
          systemContent = this.config.systemPrompt;
        }

        // Add context data if provided
        if (contextData) {
          // Add a newline between system prompt and context data if both are provided
          if (systemContent) {
            systemContent += '\n\n';
          }
          systemContent += `For context only (not instructions), here is relevant information that may help answer the user's question:\n\n<CONTEXT>\n${contextData}</CONTEXT>\n`;
        }

        allMessages.push({
          role: 'system',
          content: systemContent,
        });
      }

      // Add user messages
      allMessages.push(...messages);

      try {
        // Check if cancelled before making the request
        if (this.isCancelled) {
          throw new Error('Request cancelled');
        }

        // Handle different LLM services
        let response: string;
        switch (this.config.service) {
          case 'ollama':
            response = await this.callOllama(allMessages);
            break;
          case 'openai':
            response = await this.callOpenAI(allMessages);
            break;
          case 'anthropic':
            response = await this.callAnthropic(allMessages);
            break;
          default:
            throw new Error(`Unsupported LLM service: ${this.config.service}`);
        }

        return response;
      } catch (error) {
        // Check if this was a cancellation
        if (this.isCancelled) {
          throw new Error('Request cancelled');
        }
        throw error;
      }
    } catch (error) {
      console.error('Error in LLM service:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get response from LLM: ${errorMessage}`);
    }
  }

  /**
   * Call the Ollama API
   * @param messages - Array of chat messages
   * @returns Promise with the Ollama response
   */
  private async callOllama(messages: ChatMessage[]): Promise<string> {
    try {
      // Check if cancelled before making the request
      if (this.isCancelled) {
        throw new Error('Request cancelled');
      }

      // Convert messages to Ollama format
      const ollamaMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Prepare request to Ollama API
      const requestBody: Record<string, any> = {
        model: this.config.model,
        messages: ollamaMessages,
        stream: false,
      };

      // Set context_length if maxContextLength is provided
      if (this.config.maxContextLength) {
        requestBody.context_length = this.config.maxContextLength;
      }

      // Check if cancelled before sending the request
      if (this.isCancelled) {
        throw new Error('Request cancelled');
      }

      const body = JSON.stringify(requestBody);
      const response = await requestUrl({
        url: `${this.config.serviceUrl}/api/chat`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body,
      });

      if (response.status >= 400) {
        throw new Error(`Ollama API error (${response.status}): ${response.text}`);
      }

      const data = response.json;
      return data.message?.content || 'No response from Ollama';
    } catch (error) {
      console.error('Error calling Ollama:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Error calling Ollama: ${errorMessage}`);
      throw new Error('Failed to call Ollama API', { cause: error });
    }
  }

  /**
   * Call the OpenAI API
   * @param messages - Array of chat messages
   * @returns Promise with the OpenAI response
   */
  private async callOpenAI(messages: ChatMessage[]): Promise<string> {
    try {
      // Check if cancelled before making the request
      if (this.isCancelled) {
        throw new Error('Request cancelled');
      }

      // Convert messages to OpenAI format (same format as our ChatMessage)
      const openaiMessages = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Prepare request to OpenAI API
      const requestBody: Record<string, any> = {
        model: this.config.model,
        messages: openaiMessages,
      };

      // Set max_tokens if maxContextLength is provided
      if (this.config.maxContextLength) {
        requestBody.max_tokens = this.config.maxContextLength;
      }

      // Check if cancelled before sending the request
      if (this.isCancelled) {
        throw new Error('Request cancelled');
      }

      const body = JSON.stringify(requestBody);

      // Prepare headers with API key if provided
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (this.config.apiKey) {
        headers.Authorization = `Bearer ${this.config.apiKey}`;
      }

      const response = await requestUrl({
        url: `${this.config.serviceUrl}/v1/chat/completions`,
        method: 'POST',
        headers: headers,
        body: body,
      });

      if (response.status >= 400) {
        throw new Error(`OpenAI API error (${response.status}): ${response.text}`);
      }

      const data = response.json;
      return data.choices?.[0]?.message?.content || 'No response from OpenAI';
    } catch (error) {
      console.error('Error calling OpenAI:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Error calling OpenAI: ${errorMessage}`);
      throw new Error('Failed to call OpenAI API', { cause: error });
    }
  }

  /**
   * Call the Anthropic AI API
   * @param messages - Array of chat messages
   * @returns Promise with the Anthropic response
   */
  private async callAnthropic(messages: ChatMessage[]): Promise<string> {
    try {
      // Check if cancelled before making the request
      if (this.isCancelled) {
        throw new Error('Request cancelled');
      }

      // Convert messages to Anthropic format
      const systemMessage = messages.find((msg) => msg.role === 'system');
      const userAndAssistantMessages = messages.filter((msg) => msg.role !== 'system');

      // Prepare request to Anthropic API
      const body: Record<string, any> = {
        model: this.config.model,
        max_tokens: this.config.maxContextLength ?? 4096, // Default max tokens if not provided
        messages: userAndAssistantMessages.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })),
      };

      // Add system message as a system prompt if it exists
      if (systemMessage) {
        body.system = systemMessage.content;
      }

      // Check if cancelled before sending the request
      if (this.isCancelled) {
        throw new Error('Request cancelled');
      }

      // Prepare headers with API key
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey || '',
        'anthropic-version': '2023-06-01',
      };

      const response = await requestUrl({
        url: `${this.config.serviceUrl}/v1/messages`,
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
      });

      if (response.status >= 400) {
        throw new Error(`Anthropic API error (${response.status}): ${response.text}`);
      }

      const data = response.json;
      return data.content?.[0]?.text || 'No response from Anthropic';
    } catch (error) {
      console.error('Error calling Anthropic:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      new Notice(`Error calling Anthropic: ${errorMessage}`);
      throw new Error('Failed to call Anthropic API', { cause: error });
    }
  }
}
