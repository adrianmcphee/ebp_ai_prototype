import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ProcessResponse } from '../types';
import { 
  MessageStrategy,
  PersistentMessageStrategy,
  SilentMessageStrategy,
  MessageStrategyFactory
} from '../services/message-strategy';

// Mock the notifications module
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn()
  }
}));

describe('MessageStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('PersistentMessageStrategy() - Persistent Message Handling', () => {
    it('constructor() - should create instance with callback dependencies', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();

      // ACT
      const strategy = new PersistentMessageStrategy(mockAddUserMessage, mockAddAssistantMessage);

      // ASSERT
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(PersistentMessageStrategy);
    });

    it('handleUserMessage() - should call addUserMessage callback with content', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();
      const strategy = new PersistentMessageStrategy(mockAddUserMessage, mockAddAssistantMessage);
      const testContent = 'User message content';

      // ACT
      strategy.handleUserMessage(testContent);

      // ASSERT
      expect(mockAddUserMessage).toHaveBeenCalledTimes(1);
      expect(mockAddUserMessage).toHaveBeenCalledWith(testContent);
      expect(mockAddAssistantMessage).not.toHaveBeenCalled();
    });

    it('handleUserMessage() - should handle empty string content', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();
      const strategy = new PersistentMessageStrategy(mockAddUserMessage, mockAddAssistantMessage);

      // ACT
      strategy.handleUserMessage('');

      // ASSERT
      expect(mockAddUserMessage).toHaveBeenCalledTimes(1);
      expect(mockAddUserMessage).toHaveBeenCalledWith('');
    });

    it('handleUserMessage() - should handle very long content', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();
      const strategy = new PersistentMessageStrategy(mockAddUserMessage, mockAddAssistantMessage);
      const longContent = 'x'.repeat(10000);

      // ACT
      strategy.handleUserMessage(longContent);

      // ASSERT
      expect(mockAddUserMessage).toHaveBeenCalledTimes(1);
      expect(mockAddUserMessage).toHaveBeenCalledWith(longContent);
    });

    it('handleAssistantResponse() - should call addAssistantMessage callback with content only', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();
      const strategy = new PersistentMessageStrategy(mockAddUserMessage, mockAddAssistantMessage);
      const testContent = 'Assistant response content';

      // ACT
      strategy.handleAssistantResponse(testContent);

      // ASSERT
      expect(mockAddAssistantMessage).toHaveBeenCalledTimes(1);
      expect(mockAddAssistantMessage).toHaveBeenCalledWith(testContent, undefined);
      expect(mockAddUserMessage).not.toHaveBeenCalled();
    });

    it('handleAssistantResponse() - should call addAssistantMessage callback with content and data', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();
      const strategy = new PersistentMessageStrategy(mockAddUserMessage, mockAddAssistantMessage);
      const testContent = 'Assistant response content';
      const testData: ProcessResponse = {
        status: 'success',
        intent: 'test_intent',
        confidence: 0.95,
        message: 'Test response'
      };

      // ACT
      strategy.handleAssistantResponse(testContent, testData);

      // ASSERT
      expect(mockAddAssistantMessage).toHaveBeenCalledTimes(1);
      expect(mockAddAssistantMessage).toHaveBeenCalledWith(testContent, testData);
      expect(mockAddUserMessage).not.toHaveBeenCalled();
    });

    it('handleAssistantResponse() - should handle complex ProcessResponse data', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();
      const strategy = new PersistentMessageStrategy(mockAddUserMessage, mockAddAssistantMessage);
      const testContent = 'Complex response';
      const complexData: ProcessResponse = {
        status: 'success',
        intent: 'transfer_money',
        confidence: 0.88,
        entities: { amount: 100, account: 'savings' },
        message: 'Transfer initiated',
        ui_assistance: {
          type: 'transaction_form',
          action: 'show_form',
          form_config: {
            screen_id: 'transfer',
            title: 'Transfer Money',
            subtitle: 'Complete your transfer',
            fields: [],
            confirmation_required: true,
            complexity_reduction: 'simplified'
          }
        },
        execution: { transaction_id: 'tx-123' }
      };

      // ACT
      strategy.handleAssistantResponse(testContent, complexData);

      // ASSERT
      expect(mockAddAssistantMessage).toHaveBeenCalledTimes(1);
      expect(mockAddAssistantMessage).toHaveBeenCalledWith(testContent, complexData);
    });

    it('getDescription() - should return persistent message description', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();
      const strategy = new PersistentMessageStrategy(mockAddUserMessage, mockAddAssistantMessage);

      // ACT
      const description = strategy.getDescription();

      // ASSERT
      expect(description).toBeDefined();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
      expect(mockAddUserMessage).not.toHaveBeenCalled();
      expect(mockAddAssistantMessage).not.toHaveBeenCalled();
    });

    it('should handle callback exceptions gracefully', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn().mockImplementation(() => {
        throw new Error('User message callback failed');
      });
      const mockAddAssistantMessage = vi.fn().mockImplementation(() => {
        throw new Error('Assistant message callback failed');
      });
      const strategy = new PersistentMessageStrategy(mockAddUserMessage, mockAddAssistantMessage);

      // ACT & ASSERT
      expect(() => strategy.handleUserMessage('test')).toThrow('User message callback failed');
      expect(() => strategy.handleAssistantResponse('test')).toThrow('Assistant message callback failed');
    });

    it('should handle multiple consecutive calls', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();
      const strategy = new PersistentMessageStrategy(mockAddUserMessage, mockAddAssistantMessage);

      // ACT
      strategy.handleUserMessage('message 1');
      strategy.handleUserMessage('message 2');
      strategy.handleAssistantResponse('response 1');
      strategy.handleAssistantResponse('response 2');

      // ASSERT
      expect(mockAddUserMessage).toHaveBeenCalledTimes(2);
      expect(mockAddAssistantMessage).toHaveBeenCalledTimes(2);
      expect(mockAddUserMessage).toHaveBeenNthCalledWith(1, 'message 1');
      expect(mockAddUserMessage).toHaveBeenNthCalledWith(2, 'message 2');
      expect(mockAddAssistantMessage).toHaveBeenNthCalledWith(1, 'response 1', undefined);
      expect(mockAddAssistantMessage).toHaveBeenNthCalledWith(2, 'response 2', undefined);
    });
  });

  describe('SilentMessageStrategy() - Silent Message Handling', () => {
    it('constructor() - should create instance without dependencies', () => {
      // ACT
      const strategy = new SilentMessageStrategy();

      // ASSERT
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(SilentMessageStrategy);
    });

    it('handleUserMessage() - should handle message silently without side effects', () => {
      // ARRANGE
      const strategy = new SilentMessageStrategy();
      const testContent = 'Silent user message';

      // ACT
      strategy.handleUserMessage(testContent);

      // ASSERT - No assertions needed as method should do nothing
      // The test passes if no exceptions are thrown
    });

    it('handleUserMessage() - should handle empty string content silently', () => {
      // ARRANGE
      const strategy = new SilentMessageStrategy();

      // ACT
      strategy.handleUserMessage('');

      // ASSERT - No side effects expected
    });

    it('handleUserMessage() - should handle special characters and unicode silently', () => {
      // ARRANGE
      const strategy = new SilentMessageStrategy();
      const specialContent = '🔥💻🚀 Special chars & unicode: αβγ δεζ 中文 العربية';

      // ACT
      strategy.handleUserMessage(specialContent);

      // ASSERT - No side effects expected
    });

    it('handleAssistantResponse() - should handle response silently without side effects', () => {
      // ARRANGE
      const strategy = new SilentMessageStrategy();
      const testContent = 'Silent assistant response';

      // ACT
      strategy.handleAssistantResponse(testContent);

      // ASSERT - No assertions needed as method should do nothing
    });

    it('handleAssistantResponse() - should handle response with data silently', () => {
      // ARRANGE
      const strategy = new SilentMessageStrategy();
      const testContent = 'Silent response with data';
      const testData: ProcessResponse = {
        status: 'success',
        intent: 'silent_test',
        confidence: 0.9,
        message: 'Silent test response'
      };

      // ACT
      strategy.handleAssistantResponse(testContent, testData);

      // ASSERT - No side effects expected
    });

    it('getDescription() - should return silent message description', () => {
      // ARRANGE
      const strategy = new SilentMessageStrategy();

      // ACT
      const description = strategy.getDescription();

      // ASSERT
      expect(description).toBeDefined();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
    });

    it('should handle multiple consecutive calls silently', () => {
      // ARRANGE
      const strategy = new SilentMessageStrategy();

      // ACT - Multiple calls should all work silently
      for (let i = 0; i < 10; i++) {
        strategy.handleUserMessage(`message ${i}`);
        strategy.handleAssistantResponse(`response ${i}`);
      }

      // ASSERT - Test passes if no exceptions thrown
    });

    it('should handle null and undefined content gracefully', () => {
      // ARRANGE
      const strategy = new SilentMessageStrategy();

      // ACT & ASSERT - Should not throw errors
      expect(() => strategy.handleUserMessage(null as unknown as string)).not.toThrow();
      expect(() => strategy.handleUserMessage(undefined as unknown as string)).not.toThrow();
      expect(() => strategy.handleAssistantResponse(null as unknown as string)).not.toThrow();
      expect(() => strategy.handleAssistantResponse(undefined as unknown as string)).not.toThrow();
    });
  });

  describe('MessageStrategyFactory() - Strategy Factory', () => {
    it('createPersistent() - should create PersistentMessageStrategy instance', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();

      // ACT
      const strategy = MessageStrategyFactory.createPersistent(mockAddUserMessage, mockAddAssistantMessage);

      // ASSERT
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(PersistentMessageStrategy);
    });

    it('createPersistent() - should create strategy that uses provided callbacks', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();
      const testUserContent = 'Factory user test';
      const testAssistantContent = 'Factory assistant test';

      // ACT
      const strategy = MessageStrategyFactory.createPersistent(mockAddUserMessage, mockAddAssistantMessage);
      strategy.handleUserMessage(testUserContent);
      strategy.handleAssistantResponse(testAssistantContent);

      // ASSERT
      expect(mockAddUserMessage).toHaveBeenCalledTimes(1);
      expect(mockAddUserMessage).toHaveBeenCalledWith(testUserContent);
      expect(mockAddAssistantMessage).toHaveBeenCalledTimes(1);
      expect(mockAddAssistantMessage).toHaveBeenCalledWith(testAssistantContent, undefined);
    });

    it('createSilent() - should create SilentMessageStrategy instance', () => {
      // ACT
      const strategy = MessageStrategyFactory.createSilent();

      // ASSERT
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(SilentMessageStrategy);
    });

    it('createSilent() - should create strategy that handles messages silently', () => {
      // ACT
      const strategy = MessageStrategyFactory.createSilent();
      
      // ACT - Should work without throwing
      strategy.handleUserMessage('Silent factory test');
      strategy.handleAssistantResponse('Silent factory response');

      // ASSERT - Test passes if no exceptions
    });

    it('createPersistent() - should create independent strategy instances', () => {
      // ARRANGE
      const mockAddUserMessage1 = vi.fn();
      const mockAddAssistantMessage1 = vi.fn();
      const mockAddUserMessage2 = vi.fn();
      const mockAddAssistantMessage2 = vi.fn();

      // ACT
      const strategy1 = MessageStrategyFactory.createPersistent(mockAddUserMessage1, mockAddAssistantMessage1);
      const strategy2 = MessageStrategyFactory.createPersistent(mockAddUserMessage2, mockAddAssistantMessage2);

      // ASSERT
      expect(strategy1).toBeDefined();
      expect(strategy2).toBeDefined();
      expect(strategy1).not.toBe(strategy2);
      expect(strategy1).toBeInstanceOf(PersistentMessageStrategy);
      expect(strategy2).toBeInstanceOf(PersistentMessageStrategy);
    });

    it('createSilent() - should create independent strategy instances', () => {
      // ACT
      const strategy1 = MessageStrategyFactory.createSilent();
      const strategy2 = MessageStrategyFactory.createSilent();

      // ASSERT
      expect(strategy1).toBeDefined();
      expect(strategy2).toBeDefined();
      expect(strategy1).not.toBe(strategy2);
      expect(strategy1).toBeInstanceOf(SilentMessageStrategy);
      expect(strategy2).toBeInstanceOf(SilentMessageStrategy);
    });

    it('createPersistent() - should handle different callback combinations', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();
      const noop = () => {};

      // ACT
      const strategy1 = MessageStrategyFactory.createPersistent(mockAddUserMessage, noop);
      const strategy2 = MessageStrategyFactory.createPersistent(noop, mockAddAssistantMessage);

      // ASSERT
      expect(strategy1).toBeInstanceOf(PersistentMessageStrategy);
      expect(strategy2).toBeInstanceOf(PersistentMessageStrategy);
      
      // Test that callbacks work independently
      strategy1.handleUserMessage('test1');
      strategy2.handleAssistantResponse('test2');
      
      expect(mockAddUserMessage).toHaveBeenCalledWith('test1');
      expect(mockAddAssistantMessage).toHaveBeenCalledWith('test2', undefined);
    });
  });

  describe('MessageStrategy Interface Compliance', () => {
    it('PersistentMessageStrategy - should implement MessageStrategy interface', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();
      const strategy: MessageStrategy = new PersistentMessageStrategy(mockAddUserMessage, mockAddAssistantMessage);

      // ACT & ASSERT
      expect(typeof strategy.handleUserMessage).toBe('function');
      expect(typeof strategy.handleAssistantResponse).toBe('function');
      expect(typeof strategy.getDescription).toBe('function');
      expect(typeof strategy.getDescription()).toBe('string');
    });

    it('SilentMessageStrategy - should implement MessageStrategy interface', () => {
      // ARRANGE
      const strategy: MessageStrategy = new SilentMessageStrategy();

      // ACT & ASSERT
      expect(typeof strategy.handleUserMessage).toBe('function');
      expect(typeof strategy.handleAssistantResponse).toBe('function');
      expect(typeof strategy.getDescription).toBe('function');
      expect(typeof strategy.getDescription()).toBe('string');
    });

    it('Factory methods - should return objects implementing MessageStrategy interface', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();

      // ACT
      const persistentStrategy: MessageStrategy = MessageStrategyFactory.createPersistent(mockAddUserMessage, mockAddAssistantMessage);
      const silentStrategy: MessageStrategy = MessageStrategyFactory.createSilent();

      // ASSERT
      expect(typeof persistentStrategy.handleUserMessage).toBe('function');
      expect(typeof persistentStrategy.handleAssistantResponse).toBe('function');
      expect(typeof persistentStrategy.getDescription).toBe('function');
      expect(typeof silentStrategy.handleUserMessage).toBe('function');
      expect(typeof silentStrategy.handleAssistantResponse).toBe('function');
      expect(typeof silentStrategy.getDescription).toBe('function');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('PersistentMessageStrategy - should handle null callback functions gracefully', () => {
      // ARRANGE & ACT & ASSERT
      expect(() => new PersistentMessageStrategy(null as unknown as () => void, null as unknown as () => void)).not.toThrow();
    });

    it('PersistentMessageStrategy - should handle undefined callback functions gracefully', () => {
      // ARRANGE & ACT & ASSERT
      expect(() => new PersistentMessageStrategy(undefined as unknown as () => void, undefined as unknown as () => void)).not.toThrow();
    });

    it('description methods - should never return empty strings', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();
      const persistentStrategy = new PersistentMessageStrategy(mockAddUserMessage, mockAddAssistantMessage);
      const silentStrategy = new SilentMessageStrategy();

      // ACT
      const persistentDesc = persistentStrategy.getDescription();
      const silentDesc = silentStrategy.getDescription();

      // ASSERT
      expect(persistentDesc.length).toBeGreaterThan(0);
      expect(silentDesc.length).toBeGreaterThan(0);
    });

    it('Factory methods - should be callable multiple times without side effects', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();

      // ACT & ASSERT
      for (let i = 0; i < 5; i++) {
        const persistent = MessageStrategyFactory.createPersistent(mockAddUserMessage, mockAddAssistantMessage);
        const silent = MessageStrategyFactory.createSilent();
        
        expect(persistent).toBeInstanceOf(PersistentMessageStrategy);
        expect(silent).toBeInstanceOf(SilentMessageStrategy);
      }
    });

    it('should handle very large message content without performance issues', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();
      const persistentStrategy = new PersistentMessageStrategy(mockAddUserMessage, mockAddAssistantMessage);
      const silentStrategy = new SilentMessageStrategy();
      const largeContent = 'x'.repeat(100000); // 100KB string

      // ACT
      const startTime = Date.now();
      persistentStrategy.handleUserMessage(largeContent);
      silentStrategy.handleUserMessage(largeContent);
      const endTime = Date.now();

      // ASSERT
      expect(endTime - startTime).toBeLessThan(100); // Should complete in under 100ms
      expect(mockAddUserMessage).toHaveBeenCalledWith(largeContent);
    });

    it('should handle ProcessResponse with all optional fields', () => {
      // ARRANGE
      const mockAddUserMessage = vi.fn();
      const mockAddAssistantMessage = vi.fn();
      const strategy = new PersistentMessageStrategy(mockAddUserMessage, mockAddAssistantMessage);
      const fullResponse: ProcessResponse = {
        status: 'success',
        intent: 'complex_intent',
        confidence: 0.92,
        entities: { 
          account_id: 'acc-123',
          amount: 500.50,
          currency: 'USD'
        },
        message: 'Complex operation completed',
        ui_assistance: {
          type: 'transaction_form',
          action: 'show_form',
          form_config: {
            screen_id: 'complex_form',
            title: 'Complex Form',
            subtitle: 'Handle complex data',
            fields: [
              { name: 'amount', type: 'number', required: true },
              { name: 'account', type: 'select', required: true }
            ],
            confirmation_required: true,
            complexity_reduction: 'guided'
          }
        },
        execution: { 
          transaction_id: 'tx-456',
          status: 'pending',
          estimated_completion: '2024-01-01T12:00:00Z'
        }
      };

      // ACT
      strategy.handleAssistantResponse('Complex response', fullResponse);

      // ASSERT
      expect(mockAddAssistantMessage).toHaveBeenCalledWith('Complex response', fullResponse);
    });
  });
});
