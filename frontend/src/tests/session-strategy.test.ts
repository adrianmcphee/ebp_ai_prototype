import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  SessionStrategy,
  PersistentSessionStrategy,
  EphemeralSessionStrategy,
  SessionStrategyFactory
} from '../services/session-strategy';

// Mock the session service module
vi.mock('../services/session', () => ({
  sessionService: {
    getSessionId: vi.fn()
  }
}));

// Import the mocked session service
import { sessionService } from '../services/session';

const mockedSessionService = vi.mocked(sessionService);

describe('SessionStrategy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('PersistentSessionStrategy() - Persistent Session Management', () => {
    it('constructor() - should create instance with session service dependency', () => {
      // ARRANGE
      const mockSessionService = {
        getSessionId: vi.fn().mockReturnValue('test-session-123')
      };

      // ACT
      const strategy = new PersistentSessionStrategy(mockSessionService);

      // ASSERT
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(PersistentSessionStrategy);
    });

    it('getSessionForRequest() - should return session ID from session service', () => {
      // ARRANGE
      const testSessionId = 'persistent-session-456';
      const mockSessionService = {
        getSessionId: vi.fn().mockReturnValue(testSessionId)
      };
      const strategy = new PersistentSessionStrategy(mockSessionService);

      // ACT
      const result = strategy.getSessionForRequest();

      // ASSERT
      expect(mockSessionService.getSessionId).toHaveBeenCalledTimes(1);
      expect(result).toBe(testSessionId);
    });

    it('getSessionForRequest() - should return null when session service returns null', () => {
      // ARRANGE
      const mockSessionService = {
        getSessionId: vi.fn().mockReturnValue(null)
      };
      const strategy = new PersistentSessionStrategy(mockSessionService);

      // ACT
      const result = strategy.getSessionForRequest();

      // ASSERT
      expect(mockSessionService.getSessionId).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });

    it('getSessionForRequest() - should handle session service returning undefined', () => {
      // ARRANGE
      const mockSessionService = {
        getSessionId: vi.fn().mockReturnValue(undefined)
      };
      const strategy = new PersistentSessionStrategy(mockSessionService);

      // ACT
      const result = strategy.getSessionForRequest();

      // ASSERT
      expect(mockSessionService.getSessionId).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it('getDescription() - should return persistent session description', () => {
      // ARRANGE
      const mockSessionService = {
        getSessionId: vi.fn()
      };
      const strategy = new PersistentSessionStrategy(mockSessionService);

      // ACT
      const description = strategy.getDescription();

      // ASSERT
      expect(description).toBeDefined();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
      expect(mockSessionService.getSessionId).not.toHaveBeenCalled();
    });

    it('getSessionForRequest() - should handle session service exceptions gracefully', () => {
      // ARRANGE
      const mockSessionService = {
        getSessionId: vi.fn().mockImplementation(() => {
          throw new Error('Session service unavailable');
        })
      };
      const strategy = new PersistentSessionStrategy(mockSessionService);

      // ACT & ASSERT
      expect(() => strategy.getSessionForRequest()).toThrow('Session service unavailable');
      expect(mockSessionService.getSessionId).toHaveBeenCalledTimes(1);
    });

    it('getSessionForRequest() - should call session service multiple times independently', () => {
      // ARRANGE
      const mockSessionService = {
        getSessionId: vi.fn()
          .mockReturnValueOnce('session-1')
          .mockReturnValueOnce('session-2')
          .mockReturnValueOnce('session-3')
      };
      const strategy = new PersistentSessionStrategy(mockSessionService);

      // ACT
      const result1 = strategy.getSessionForRequest();
      const result2 = strategy.getSessionForRequest();
      const result3 = strategy.getSessionForRequest();

      // ASSERT
      expect(mockSessionService.getSessionId).toHaveBeenCalledTimes(3);
      expect(result1).toBe('session-1');
      expect(result2).toBe('session-2');
      expect(result3).toBe('session-3');
    });
  });

  describe('EphemeralSessionStrategy() - Ephemeral Session Management', () => {
    it('constructor() - should create instance without dependencies', () => {
      // ACT
      const strategy = new EphemeralSessionStrategy();

      // ASSERT
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(EphemeralSessionStrategy);
    });

    it('getSessionForRequest() - should always return null for ephemeral strategy', () => {
      // ARRANGE
      const strategy = new EphemeralSessionStrategy();

      // ACT
      const result1 = strategy.getSessionForRequest();
      const result2 = strategy.getSessionForRequest();
      const result3 = strategy.getSessionForRequest();

      // ASSERT
      expect(result1).toBeNull();
      expect(result2).toBeNull();
      expect(result3).toBeNull();
    });

    it('getDescription() - should return ephemeral session description', () => {
      // ARRANGE
      const strategy = new EphemeralSessionStrategy();

      // ACT
      const description = strategy.getDescription();

      // ASSERT
      expect(description).toBeDefined();
      expect(typeof description).toBe('string');
      expect(description.length).toBeGreaterThan(0);
    });

    it('getSessionForRequest() - should be consistent across multiple calls', () => {
      // ARRANGE
      const strategy = new EphemeralSessionStrategy();

      // ACT & ASSERT
      for (let i = 0; i < 10; i++) {
        expect(strategy.getSessionForRequest()).toBeNull();
      }
    });
  });

  describe('SessionStrategyFactory() - Strategy Factory', () => {
    it('createPersistent() - should create PersistentSessionStrategy instance', () => {
      // ARRANGE
      mockedSessionService.getSessionId.mockReturnValue('factory-test-session');

      // ACT
      const strategy = SessionStrategyFactory.createPersistent();

      // ASSERT
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(PersistentSessionStrategy);
    });

    it('createPersistent() - should create strategy that uses real session service', () => {
      // ARRANGE
      const testSessionId = 'factory-session-789';
      mockedSessionService.getSessionId.mockReturnValue(testSessionId);

      // ACT
      const strategy = SessionStrategyFactory.createPersistent();
      const result = strategy.getSessionForRequest();

      // ASSERT
      expect(mockedSessionService.getSessionId).toHaveBeenCalledTimes(1);
      expect(result).toBe(testSessionId);
    });

    it('createEphemeral() - should create EphemeralSessionStrategy instance', () => {
      // ACT
      const strategy = SessionStrategyFactory.createEphemeral();

      // ASSERT
      expect(strategy).toBeDefined();
      expect(strategy).toBeInstanceOf(EphemeralSessionStrategy);
    });

    it('createEphemeral() - should create strategy that returns null for session', () => {
      // ACT
      const strategy = SessionStrategyFactory.createEphemeral();
      const result = strategy.getSessionForRequest();

      // ASSERT
      expect(result).toBeNull();
    });

    it('createPersistent() - should create independent strategy instances', () => {
      // ACT
      const strategy1 = SessionStrategyFactory.createPersistent();
      const strategy2 = SessionStrategyFactory.createPersistent();

      // ASSERT
      expect(strategy1).toBeDefined();
      expect(strategy2).toBeDefined();
      expect(strategy1).not.toBe(strategy2);
      expect(strategy1).toBeInstanceOf(PersistentSessionStrategy);
      expect(strategy2).toBeInstanceOf(PersistentSessionStrategy);
    });

    it('createEphemeral() - should create independent strategy instances', () => {
      // ACT
      const strategy1 = SessionStrategyFactory.createEphemeral();
      const strategy2 = SessionStrategyFactory.createEphemeral();

      // ASSERT
      expect(strategy1).toBeDefined();
      expect(strategy2).toBeDefined();
      expect(strategy1).not.toBe(strategy2);
      expect(strategy1).toBeInstanceOf(EphemeralSessionStrategy);
      expect(strategy2).toBeInstanceOf(EphemeralSessionStrategy);
    });

    it('createPersistent() - should handle session service returning different values', () => {
      // ARRANGE
      mockedSessionService.getSessionId
        .mockReturnValueOnce('session-a')
        .mockReturnValueOnce('session-b');

      // ACT
      const strategy1 = SessionStrategyFactory.createPersistent();
      const strategy2 = SessionStrategyFactory.createPersistent();
      const result1 = strategy1.getSessionForRequest();
      const result2 = strategy2.getSessionForRequest();

      // ASSERT
      expect(result1).toBe('session-a');
      expect(result2).toBe('session-b');
    });
  });

  describe('SessionStrategy Interface Compliance', () => {
    it('PersistentSessionStrategy - should implement SessionStrategy interface', () => {
      // ARRANGE
      const mockSessionService = {
        getSessionId: vi.fn().mockReturnValue('interface-test')
      };
      const strategy: SessionStrategy = new PersistentSessionStrategy(mockSessionService);

      // ACT & ASSERT
      expect(typeof strategy.getSessionForRequest).toBe('function');
      expect(typeof strategy.getDescription).toBe('function');
      expect(strategy.getSessionForRequest()).toBe('interface-test');
      expect(typeof strategy.getDescription()).toBe('string');
    });

    it('EphemeralSessionStrategy - should implement SessionStrategy interface', () => {
      // ARRANGE
      const strategy: SessionStrategy = new EphemeralSessionStrategy();

      // ACT & ASSERT
      expect(typeof strategy.getSessionForRequest).toBe('function');
      expect(typeof strategy.getDescription).toBe('function');
      expect(strategy.getSessionForRequest()).toBeNull();
      expect(typeof strategy.getDescription()).toBe('string');
    });

    it('Factory methods - should return objects implementing SessionStrategy interface', () => {
      // ACT
      const persistentStrategy: SessionStrategy = SessionStrategyFactory.createPersistent();
      const ephemeralStrategy: SessionStrategy = SessionStrategyFactory.createEphemeral();

      // ASSERT
      expect(typeof persistentStrategy.getSessionForRequest).toBe('function');
      expect(typeof persistentStrategy.getDescription).toBe('function');
      expect(typeof ephemeralStrategy.getSessionForRequest).toBe('function');
      expect(typeof ephemeralStrategy.getDescription).toBe('function');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('PersistentSessionStrategy - should handle empty string session ID', () => {
      // ARRANGE
      const mockSessionService = {
        getSessionId: vi.fn().mockReturnValue('')
      };
      const strategy = new PersistentSessionStrategy(mockSessionService);

      // ACT
      const result = strategy.getSessionForRequest();

      // ASSERT
      expect(result).toBe('');
      expect(mockSessionService.getSessionId).toHaveBeenCalledTimes(1);
    });

    it('PersistentSessionStrategy - should handle very long session IDs', () => {
      // ARRANGE
      const longSessionId = 'x'.repeat(1000);
      const mockSessionService = {
        getSessionId: vi.fn().mockReturnValue(longSessionId)
      };
      const strategy = new PersistentSessionStrategy(mockSessionService);

      // ACT
      const result = strategy.getSessionForRequest();

      // ASSERT
      expect(result).toBe(longSessionId);
      expect(result?.length).toBe(1000);
    });

    it('PersistentSessionStrategy - should handle session service returning non-string values', () => {
      // ARRANGE
      const mockSessionService = {
        getSessionId: vi.fn().mockReturnValue(12345 as unknown as string)
      };
      const strategy = new PersistentSessionStrategy(mockSessionService);

      // ACT
      const result = strategy.getSessionForRequest();

      // ASSERT
      expect(result).toBe(12345);
      expect(mockSessionService.getSessionId).toHaveBeenCalledTimes(1);
    });

    it('description methods - should never return empty strings', () => {
      // ARRANGE
      const mockSessionService = { getSessionId: vi.fn() };
      const persistentStrategy = new PersistentSessionStrategy(mockSessionService);
      const ephemeralStrategy = new EphemeralSessionStrategy();

      // ACT
      const persistentDesc = persistentStrategy.getDescription();
      const ephemeralDesc = ephemeralStrategy.getDescription();

      // ASSERT
      expect(persistentDesc.length).toBeGreaterThan(0);
      expect(ephemeralDesc.length).toBeGreaterThan(0);
    });

    it('Factory methods - should be callable multiple times without side effects', () => {
      // ACT & ASSERT
      for (let i = 0; i < 5; i++) {
        const persistent = SessionStrategyFactory.createPersistent();
        const ephemeral = SessionStrategyFactory.createEphemeral();
        
        expect(persistent).toBeInstanceOf(PersistentSessionStrategy);
        expect(ephemeral).toBeInstanceOf(EphemeralSessionStrategy);
      }
    });
  });
});
