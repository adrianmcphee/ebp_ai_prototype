import { sessionService } from './session';

/**
 * Interface for session service dependency
 * Follows Dependency Inversion Principle
 */
interface ISessionService {
  getSessionId(): string | null;
}

/**
 * Strategy interface for session management
 * Follows Open/Closed Principle - open for extension, closed for modification
 */
export interface SessionStrategy {
  getSessionForRequest(): string | null;
  getDescription(): string;
}

/**
 * Persistent session strategy for components that need conversation continuity
 * Used by: ChatPanel for maintaining conversation context
 */
export class PersistentSessionStrategy implements SessionStrategy {
  private sessionService: ISessionService;
  
  constructor(sessionService: ISessionService) {
    this.sessionService = sessionService;
  }
  
  getSessionForRequest(): string | null {
    return this.sessionService.getSessionId();
  }
  
  getDescription(): string {
    return "Uses persistent session for conversation continuity";
  }
}

/**
 * Ephemeral session strategy for stateless components
 * Used by: NavigationAssistant for independent navigation requests
 */
export class EphemeralSessionStrategy implements SessionStrategy {
  getSessionForRequest(): string | null {
    return null; // Let backend create new session per request
  }
  
  getDescription(): string {
    return "No session - creates new session per request";
  }
}

/**
 * Factory for creating session strategies
 * Follows Single Responsibility Principle
 */
export class SessionStrategyFactory {
  static createPersistent(): SessionStrategy {
    return new PersistentSessionStrategy(sessionService);
  }
  
  static createEphemeral(): SessionStrategy {
    return new EphemeralSessionStrategy();
  }
}
