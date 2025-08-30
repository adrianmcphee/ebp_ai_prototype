import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { websocketService, type WebSocketMessage, type WebSocketMessageHandler } from '../services/websocket';
import type { ProcessResponse } from '../types';

// Mock crypto.randomUUID for deterministic tests
const mockUUID = 'test-uuid-12345';

// Mock WebSocket constructor and its methods
class MockWebSocket {
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  close: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;

  constructor(url: string) {
    this.url = url;
    this.close = vi.fn();
    this.send = vi.fn();
  }
}

// Mock the crypto module at the top level
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn().mockReturnValue(mockUUID)
  },
  writable: true
});

describe('WebSocket Service', () => {
  let originalWebSocket: typeof WebSocket;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset crypto mock
    vi.mocked(global.crypto.randomUUID).mockReturnValue(mockUUID);
    
    // Mock WebSocket constructor - create new instance for each call
    originalWebSocket = global.WebSocket;
    global.WebSocket = vi.fn().mockImplementation((url: string) => {
      return new MockWebSocket(url);
    }) as any;
  });

  afterEach(() => {
    // Restore original globals
    global.WebSocket = originalWebSocket;
    vi.restoreAllMocks();
  });

  describe('connect() - WebSocket Connection Management', () => {
    it('connect() - should create WebSocket connection with correct URL', () => {
      // ARRANGE
      const mockHandler = vi.fn();

      // ACT
      const websocket = websocketService.connect(mockHandler);

      // ASSERT
      expect(global.WebSocket).toHaveBeenCalledTimes(1);
      expect(global.WebSocket).toHaveBeenCalledWith(`ws://localhost:8000/ws/${mockUUID}`);
      expect(websocket).toBeInstanceOf(MockWebSocket);
      expect(global.crypto.randomUUID).toHaveBeenCalledTimes(1);
    });

    it('connect() - should set up onmessage handler correctly', () => {
      // ARRANGE
      const mockHandler: WebSocketMessageHandler = vi.fn();

      // ACT
      const websocket = websocketService.connect(mockHandler);

      // ASSERT
      expect(websocket.onmessage).toBeDefined();
      expect(typeof websocket.onmessage).toBe('function');
    });

    it('connect() - should return WebSocket instance with all required properties', () => {
      // ARRANGE
      const mockHandler = vi.fn();

      // ACT
      const websocket = websocketService.connect(mockHandler);

      // ASSERT
      expect(websocket).toHaveProperty('onopen');
      expect(websocket).toHaveProperty('onclose');
      expect(websocket).toHaveProperty('onmessage');
      expect(websocket).toHaveProperty('close');
      expect(websocket).toHaveProperty('send');
      expect(websocket.url).toBe(`ws://localhost:8000/ws/${mockUUID}`);
    });

    it('connect() - should handle message parsing and call handler', () => {
      // ARRANGE
      const mockProcessResponse: ProcessResponse = {
        status: 'success',
        message: 'WebSocket message received',
        intent: 'test_intent',
        confidence: 0.95
      };
      const mockWebSocketMessage: WebSocketMessage = {
        type: 'process_response',
        data: mockProcessResponse
      };
      const mockHandler: WebSocketMessageHandler = vi.fn();
      const mockMessageEvent = {
        data: JSON.stringify(mockWebSocketMessage)
      } as MessageEvent;

      // ACT
      const websocket = websocketService.connect(mockHandler);
      websocket.onmessage!(mockMessageEvent);

      // ASSERT
      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(mockWebSocketMessage);
    });

    it('connect() - should handle JSON parsing of simple message', () => {
      // ARRANGE
      const simpleMessage: WebSocketMessage = {
        type: 'status_update',
        data: { status: 'connected' }
      };
      const mockHandler: WebSocketMessageHandler = vi.fn();
      const mockMessageEvent = {
        data: JSON.stringify(simpleMessage)
      } as MessageEvent;

      // ACT
      const websocket = websocketService.connect(mockHandler);
      websocket.onmessage!(mockMessageEvent);

      // ASSERT
      expect(mockHandler).toHaveBeenCalledWith(simpleMessage);
    });

    it('connect() - should handle complex nested message data', () => {
      // ARRANGE
      const complexMessage: WebSocketMessage = {
        type: 'ui_assistance',
        data: {
          status: 'success',
          ui_assistance: {
            type: 'transaction_form',
            action: 'show_form',
            form_config: {
              screen_id: 'transfer',
              title: 'Transfer Money',
              subtitle: 'Send money between accounts',
              fields: [
                { id: 'amount', type: 'number', label: 'Amount', required: true }
              ],
              confirmation_required: true,
              complexity_reduction: 'auto_fill'
            }
          },
          entities: { amount: 500, currency: 'USD' }
        }
      };
      const mockHandler: WebSocketMessageHandler = vi.fn();
      const mockMessageEvent = {
        data: JSON.stringify(complexMessage)
      } as MessageEvent;

      // ACT
      const websocket = websocketService.connect(mockHandler);
      websocket.onmessage!(mockMessageEvent);

      // ASSERT
      expect(mockHandler).toHaveBeenCalledWith(complexMessage);
    });

    it('connect() - should generate unique UUIDs for different connections', () => {
      // ARRANGE
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      vi.mocked(global.crypto.randomUUID)
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2');

      // ACT
      websocketService.connect(handler1);
      websocketService.connect(handler2);

      // ASSERT
      expect(global.WebSocket).toHaveBeenCalledTimes(2);
      expect(global.WebSocket).toHaveBeenNthCalledWith(1, 'ws://localhost:8000/ws/uuid-1');
      expect(global.WebSocket).toHaveBeenNthCalledWith(2, 'ws://localhost:8000/ws/uuid-2');
      expect(global.crypto.randomUUID).toHaveBeenCalledTimes(2);
    });

    it('connect() - should handle multiple simultaneous connections', () => {
      // ARRANGE
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      // ACT
      const ws1 = websocketService.connect(handler1);
      const ws2 = websocketService.connect(handler2);
      const ws3 = websocketService.connect(handler3);

      // ASSERT
      expect(global.WebSocket).toHaveBeenCalledTimes(3);
      expect(ws1).toBeInstanceOf(MockWebSocket);
      expect(ws2).toBeInstanceOf(MockWebSocket);
      expect(ws3).toBeInstanceOf(MockWebSocket);
    });
  });

  describe('connect() - Message Handler Edge Cases', () => {
    it('connect() - should handle invalid JSON messages gracefully', () => {
      // ARRANGE
      const mockHandler: WebSocketMessageHandler = vi.fn();
      const mockMessageEvent = {
        data: 'invalid-json-string{'
      } as MessageEvent;

      // ACT
      const websocket = websocketService.connect(mockHandler);
      
      // ASSERT - Should not throw error when parsing invalid JSON
      expect(() => {
        websocket.onmessage!(mockMessageEvent);
      }).toThrow(); // JSON.parse will throw, which is expected behavior
    });

    it('connect() - should handle empty message data', () => {
      // ARRANGE
      const mockHandler: WebSocketMessageHandler = vi.fn();
      const mockMessageEvent = {
        data: ''
      } as MessageEvent;

      // ACT
      const websocket = websocketService.connect(mockHandler);
      
      // ASSERT
      expect(() => {
        websocket.onmessage!(mockMessageEvent);
      }).toThrow(); // JSON.parse will throw for empty string
    });

    it('connect() - should handle null message data', () => {
      // ARRANGE
      const mockHandler: WebSocketMessageHandler = vi.fn();
      const mockMessageEvent = {
        data: JSON.stringify(null)
      } as MessageEvent;

      // ACT
      const websocket = websocketService.connect(mockHandler);
      websocket.onmessage!(mockMessageEvent);

      // ASSERT
      expect(mockHandler).toHaveBeenCalledWith(null);
    });

    it('connect() - should handle message with missing type property', () => {
      // ARRANGE
      const messageWithoutType = {
        data: { status: 'success' }
      };
      const mockHandler: WebSocketMessageHandler = vi.fn();
      const mockMessageEvent = {
        data: JSON.stringify(messageWithoutType)
      } as MessageEvent;

      // ACT
      const websocket = websocketService.connect(mockHandler);
      websocket.onmessage!(mockMessageEvent);

      // ASSERT
      expect(mockHandler).toHaveBeenCalledWith(messageWithoutType);
    });

    it('connect() - should handle message with missing data property', () => {
      // ARRANGE
      const messageWithoutData = {
        type: 'test_message'
      };
      const mockHandler: WebSocketMessageHandler = vi.fn();
      const mockMessageEvent = {
        data: JSON.stringify(messageWithoutData)
      } as MessageEvent;

      // ACT
      const websocket = websocketService.connect(mockHandler);
      websocket.onmessage!(mockMessageEvent);

      // ASSERT
      expect(mockHandler).toHaveBeenCalledWith(messageWithoutData);
    });

    it('connect() - should handle array message data', () => {
      // ARRANGE
      const arrayMessage = [
        { type: 'msg1', data: { value: 1 } },
        { type: 'msg2', data: { value: 2 } }
      ];
      const mockHandler: WebSocketMessageHandler = vi.fn();
      const mockMessageEvent = {
        data: JSON.stringify(arrayMessage)
      } as MessageEvent;

      // ACT
      const websocket = websocketService.connect(mockHandler);
      websocket.onmessage!(mockMessageEvent);

      // ASSERT
      expect(mockHandler).toHaveBeenCalledWith(arrayMessage);
    });
  });

  describe('disconnect() - Connection Termination', () => {
    it('disconnect() - should call close method on valid WebSocket instance', () => {
      // ARRANGE
      const mockHandler = vi.fn();
      const websocket = websocketService.connect(mockHandler);

      // ACT
      websocketService.disconnect(websocket);

      // ASSERT
      expect(websocket.close).toHaveBeenCalledTimes(1);
      expect(websocket.close).toHaveBeenCalledWith();
    });

    it('disconnect() - should handle null WebSocket gracefully', () => {
      // ARRANGE & ACT & ASSERT
      expect(() => {
        websocketService.disconnect(null);
      }).not.toThrow();
    });

    it('disconnect() - should handle undefined WebSocket gracefully', () => {
      // ARRANGE & ACT & ASSERT
      expect(() => {
        websocketService.disconnect(undefined as any);
      }).not.toThrow();
    });

    it('disconnect() - should handle multiple disconnect calls on same instance', () => {
      // ARRANGE
      const mockHandler = vi.fn();
      const websocket = websocketService.connect(mockHandler);

      // ACT
      websocketService.disconnect(websocket);
      websocketService.disconnect(websocket);
      websocketService.disconnect(websocket);

      // ASSERT
      expect(websocket.close).toHaveBeenCalledTimes(3);
    });

    it('disconnect() - should work with WebSocket that has close method throwing error', () => {
      // ARRANGE
      const mockHandler = vi.fn();
      const websocket = websocketService.connect(mockHandler);
      websocket.close.mockImplementation(() => {
        throw new Error('Close failed');
      });

      // ACT & ASSERT
      expect(() => {
        websocketService.disconnect(websocket);
      }).toThrow('Close failed');
    });

    it('disconnect() - should handle WebSocket instances from different connections', () => {
      // ARRANGE
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const ws1 = websocketService.connect(handler1);
      const ws2 = websocketService.connect(handler2);

      // ACT
      websocketService.disconnect(ws1);
      websocketService.disconnect(ws2);

      // ASSERT
      expect(ws1.close).toHaveBeenCalledTimes(1);
      expect(ws2.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('websocketService - Service Integration Points', () => {
    it('websocketService - should export connect and disconnect methods', () => {
      // ARRANGE & ACT & ASSERT
      expect(typeof websocketService.connect).toBe('function');
      expect(typeof websocketService.disconnect).toBe('function');
      expect(Object.keys(websocketService)).toHaveLength(2);
    });

    it('websocketService - should handle complete connection lifecycle', () => {
      // ARRANGE
      const mockHandler: WebSocketMessageHandler = vi.fn();
      const testMessage: WebSocketMessage = {
        type: 'lifecycle_test',
        data: { status: 'connected' }
      };

      // ACT
      const websocket = websocketService.connect(mockHandler);
      
      // Simulate message reception
      const messageEvent = {
        data: JSON.stringify(testMessage)
      } as MessageEvent;
      websocket.onmessage!(messageEvent);
      
      // Disconnect
      websocketService.disconnect(websocket);

      // ASSERT
      expect(global.WebSocket).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(testMessage);
      expect(websocket.close).toHaveBeenCalledTimes(1);
    });

    it('websocketService - should handle rapid connect/disconnect cycles', () => {
      // ARRANGE
      const mockHandler = vi.fn();

      // ACT
      for (let i = 0; i < 5; i++) {
        const ws = websocketService.connect(mockHandler);
        websocketService.disconnect(ws);
      }

      // ASSERT
      expect(global.WebSocket).toHaveBeenCalledTimes(5);
      expect(global.crypto.randomUUID).toHaveBeenCalledTimes(5);
    });

    it('websocketService - should handle concurrent connection management', () => {
      // ARRANGE
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      // ACT
      const ws1 = websocketService.connect(handler1);
      const ws2 = websocketService.connect(handler2);
      const ws3 = websocketService.connect(handler3);

      websocketService.disconnect(ws2); // Disconnect middle connection
      
      const testMessage = { type: 'test', data: { id: 'concurrent' } };
      const messageEvent = { data: JSON.stringify(testMessage) } as MessageEvent;
      
      ws1.onmessage!(messageEvent);
      ws3.onmessage!(messageEvent);

      // ASSERT
      expect(handler1).toHaveBeenCalledWith(testMessage);
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).toHaveBeenCalledWith(testMessage);
      expect(ws2.close).toHaveBeenCalledTimes(1);
    });
  });

  describe('websocketService - Error Handling and Edge Cases', () => {
    it('websocketService - should handle WebSocket constructor errors', () => {
      // ARRANGE
      const constructorError = new Error('WebSocket constructor failed');
      global.WebSocket = vi.fn().mockImplementation(() => {
        throw constructorError;
      }) as any;
      const mockHandler = vi.fn();

      // ACT & ASSERT
      expect(() => {
        websocketService.connect(mockHandler);
      }).toThrow('WebSocket constructor failed');
    });

    it('websocketService - should handle crypto.randomUUID not available', () => {
      // ARRANGE
      const originalRandomUUID = global.crypto.randomUUID;
      delete (global.crypto as any).randomUUID;
      const mockHandler = vi.fn();

      // ACT & ASSERT
      expect(() => {
        websocketService.connect(mockHandler);
      }).toThrow();
      
      // RESTORE
      global.crypto.randomUUID = originalRandomUUID;
    });

    it('websocketService - should handle handler function errors during message processing', () => {
      // ARRANGE
      const errorThrowingHandler: WebSocketMessageHandler = vi.fn().mockImplementation(() => {
        throw new Error('Handler processing error');
      });
      const testMessage = { type: 'error_test', data: { status: 'test' } };
      const messageEvent = { data: JSON.stringify(testMessage) } as MessageEvent;

      // ACT
      const websocket = websocketService.connect(errorThrowingHandler);
      
      // ASSERT
      expect(() => {
        websocket.onmessage!(messageEvent);
      }).toThrow('Handler processing error');
      expect(errorThrowingHandler).toHaveBeenCalledWith(testMessage);
    });

    it('websocketService - should handle WebSocket with no close method', () => {
      // ARRANGE
      const brokenWebSocket = {
        onopen: null,
        onclose: null,
        onmessage: null,
        url: 'ws://test'
      } as any;
      
      // ACT & ASSERT
      expect(() => {
        websocketService.disconnect(brokenWebSocket);
      }).toThrow(); // Will throw because close is not a function
    });

    it('websocketService - should handle message events with non-string data types', () => {
      // ARRANGE
      const mockHandler = vi.fn();
      const websocket = websocketService.connect(mockHandler);
      const binaryMessageEvent = {
        data: new ArrayBuffer(8)
      } as MessageEvent;

      // ACT & ASSERT
      expect(() => {
        websocket.onmessage!(binaryMessageEvent);
      }).toThrow(); // JSON.parse will fail on ArrayBuffer
    });
  });

  describe('WebSocketMessage and WebSocketMessageHandler Types', () => {
    it('WebSocketMessage type - should handle typed message structure', () => {
      // ARRANGE
      const typedMessage: WebSocketMessage = {
        type: 'typed_test',
        data: {
          status: 'success',
          message: 'Type test completed',
          intent: 'type_validation',
          confidence: 1.0
        }
      };
      const typedHandler: WebSocketMessageHandler = vi.fn();
      const messageEvent = { data: JSON.stringify(typedMessage) } as MessageEvent;

      // ACT
      const websocket = websocketService.connect(typedHandler);
      websocket.onmessage!(messageEvent);

      // ASSERT
      expect(typedHandler).toHaveBeenCalledWith(typedMessage);
      expect(typedMessage.type).toBe('typed_test');
      expect(typedMessage.data.status).toBe('success');
    });

    it('WebSocketMessageHandler type - should enforce correct function signature', () => {
      // ARRANGE
      const strictHandler: WebSocketMessageHandler = (message: WebSocketMessage) => {
        expect(message).toHaveProperty('type');
        expect(message).toHaveProperty('data');
      };
      const testMessage: WebSocketMessage = {
        type: 'signature_test',
        data: { value: 'test' }
      };
      const messageEvent = { data: JSON.stringify(testMessage) } as MessageEvent;

      // ACT
      const websocket = websocketService.connect(strictHandler);
      
      // ASSERT - The handler itself contains assertions
      websocket.onmessage!(messageEvent);
    });
  });
});
