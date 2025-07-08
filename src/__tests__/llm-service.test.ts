import { LLMService, LLMServiceConfig, ChatMessage } from '../llm-service';
import { requestUrl } from 'obsidian';

// Mock requestUrl is already set up in __mocks__/obsidian.js
jest.mock('obsidian');

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

    (requestUrl as jest.Mock).mockResolvedValueOnce({
      status: 200,
      text: '',
      json: mockResponse,
    });

    const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];

    const response = await llmService.sendMessage(messages);

    // Check that requestUrl was called with the correct arguments
    expect(requestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'http://localhost:11434/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: expect.any(String),
      })
    );

    // Check that the body contains the correct data
    const body = JSON.parse((requestUrl as jest.Mock).mock.calls[0][0].body);
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
    (requestUrl as jest.Mock).mockResolvedValueOnce({
      status: 500,
      text: 'Internal Server Error',
      json: {},
    });

    const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];

    // Expect the sendMessage call to throw an error
    await expect(llmService.sendMessage(messages)).rejects.toThrow(
      'Failed to get response from LLM: Failed to call Ollama API'
    );
  });

  test('should handle network errors', async () => {
    // Mock network error
    (requestUrl as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

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

    (requestUrl as jest.Mock).mockResolvedValueOnce({
      status: 200,
      text: '',
      json: mockResponse,
    });

    const messages: ChatMessage[] = [{ role: 'user', content: 'Tell me about my notes' }];

    const contextData = 'This is some context data from the vault';

    await llmService.sendMessage(messages, contextData);

    // Check that the body contains a single system message with both system prompt and context data
    const body = JSON.parse((requestUrl as jest.Mock).mock.calls[0][0].body);

    // Find the system message
    const systemMessage = body.messages.find((msg: ChatMessage) => msg.role === 'system');
    expect(systemMessage).toBeDefined();
    expect(systemMessage.content).toContain('You are a helpful assistant.');
    expect(systemMessage.content).toContain(
      '<CONTEXT>\nThis is some context data from the vault</CONTEXT>'
    );
  });

  test('should call Anthropic API correctly', async () => {
    // Create a new instance with Anthropic config
    const anthropicConfig: LLMServiceConfig = {
      service: 'anthropic',
      model: 'anthropic-3-opus-20240229',
      serviceUrl: 'https://api.anthropic.com',
      systemPrompt: 'You are a helpful assistant.',
      apiKey: 'test-api-key',
    };

    const anthropicService = new LLMService(anthropicConfig);

    // Mock successful response
    const mockResponse = {
      content: [
        {
          text: 'This is a response from Anthropic',
          type: 'text',
        },
      ],
      id: 'msg_123456',
      model: 'anthropic-3-opus-20240229',
      role: 'assistant',
      type: 'message',
    };

    (requestUrl as jest.Mock).mockResolvedValueOnce({
      status: 200,
      text: '',
      json: mockResponse,
    });

    const messages: ChatMessage[] = [{ role: 'user', content: 'Hello' }];

    const response = await anthropicService.sendMessage(messages);

    // Check that requestUrl was called with the correct arguments
    expect(requestUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://api.anthropic.com/v1/messages',
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
    const body = JSON.parse((requestUrl as jest.Mock).mock.calls[0][0].body);
    expect(body).toEqual({
      model: 'anthropic-3-opus-20240229',
      max_tokens: 4096,
      messages: [{ role: 'user', content: 'Hello' }],
      system: 'You are a helpful assistant.',
    });

    // Check the response
    expect(response).toBe('This is a response from Anthropic');
  });
});
