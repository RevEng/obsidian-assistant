import { LLMService, LLMServiceConfig, ChatMessage } from '../llm-service';

// Mock fetch globally
global.fetch = jest.fn();

describe('LLMService', () => {
  let llmService: LLMService;
  const mockConfig: LLMServiceConfig = {
    service: 'ollama',
    model: 'llama3',
    serviceUrl: 'http://localhost:11434',
    systemPrompt: 'You are a helpful assistant.',
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create a new instance for each test
    llmService = new LLMService(mockConfig);
  });

  test('should initialize with the provided config', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // Using 'any' is necessary here to access private property for testing
    expect((llmService as any).config).toEqual(mockConfig);
  });

  test('should update config correctly', () => {
    const newConfig: LLMServiceConfig = {
      service: 'ollama',
      model: 'mistral',
      serviceUrl: 'http://localhost:11434',
      systemPrompt: 'New system prompt',
    };

    llmService.updateConfig(newConfig);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // Using 'any' is necessary here to access private property for testing
    expect((llmService as any).config).toEqual(newConfig);
  });

  test('should call Ollama API correctly', async () => {
    // Mock successful response
    const mockResponse = {
      message: {
        content: 'This is a response from Ollama',
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];

    const response = await llmService.sendMessage(messages);

    // Check that fetch was called with the correct arguments
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.any(String),
      })
    );

    // Check that the body contains the correct data
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({
      model: 'llama3',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello' },
      ],
      stream: false,
    });

    // Check the response
    expect(response).toBe('This is a response from Ollama');
  });

  test('should handle API errors', async () => {
    // Mock error response
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];

    // Expect the sendMessage call to throw an error
    await expect(llmService.sendMessage(messages)).rejects.toThrow(
      'Failed to get response from LLM: Failed to call Ollama API'
    );
  });

  test('should handle network errors', async () => {
    // Mock network error
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];

    // Expect the sendMessage call to throw an error
    await expect(llmService.sendMessage(messages)).rejects.toThrow();
  });

  test('should include context data when provided', async () => {
    // Mock successful response
    const mockResponse = {
      message: {
        content: 'Response with context',
      },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const messages: ChatMessage[] = [{ role: 'user', content: 'Tell me about my notes' }];

    const contextData = 'This is some context data from the vault';

    await llmService.sendMessage(messages, contextData);

    // Check that the body contains a single system message with both system prompt and context data
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);

    // Find the system message
    const systemMessage = body.messages.find((msg: ChatMessage) => msg.role === 'system');
    expect(systemMessage).toBeDefined();
    expect(systemMessage.content).toContain('You are a helpful assistant.');
    expect(systemMessage.content).toContain(
      '<CONTEXT>\nThis is some context data from the vault</CONTEXT>'
    );
  });

  test('should call Claude API correctly', async () => {
    // Create a new instance with Claude config
    const claudeConfig: LLMServiceConfig = {
      service: 'claude',
      model: 'claude-3-opus-20240229',
      serviceUrl: 'https://api.anthropic.com',
      systemPrompt: 'You are a helpful assistant.',
      apiKey: 'test-api-key',
    };

    const claudeService = new LLMService(claudeConfig);

    // Mock successful response
    const mockResponse = {
      content: [
        {
          text: 'This is a response from Claude',
          type: 'text',
        },
      ],
      id: 'msg_123456',
      model: 'claude-3-opus-20240229',
      role: 'assistant',
      type: 'message',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];

    const response = await claudeService.sendMessage(messages);

    // Check that fetch was called with the correct arguments
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-api-key',
          'anthropic-version': '2023-06-01',
        },
        body: expect.any(String),
      })
    );

    // Check that the body contains the correct data
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toEqual({
      model: 'claude-3-opus-20240229',
      max_tokens: 4096,
      messages: [{ role: 'user', content: 'Hello' }],
      system: 'You are a helpful assistant.',
    });

    // Check the response
    expect(response).toBe('This is a response from Claude');
  });
});
