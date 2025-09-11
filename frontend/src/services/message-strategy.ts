import type { Message, ProcessResponse } from '../types';
import { notifications } from '@mantine/notifications';

/**
 * Strategy interface for message handling
 * Follows Open/Closed Principle - open for extension, closed for modification
 */
export interface MessageStrategy {
  handleUserMessage(content: string): void;
  handleAssistantResponse(content: string, data?: ProcessResponse): void;
  getDescription(): string;
}

/**
 * Persistent message strategy for components that need conversation history
 * Used by: ChatPanel for maintaining chat context
 */
export class PersistentMessageStrategy implements MessageStrategy {
  constructor(
    private addUserMessage: (content: string) => void,
    private addAssistantMessage: (content: string, data?: ProcessResponse) => void
  ) {}

  handleUserMessage(content: string): void {
    this.addUserMessage(content);
  }

  handleAssistantResponse(content: string, data?: ProcessResponse): void {
    this.addAssistantMessage(content, data);
  }

  getDescription(): string {
    return "Persistent messages - adds to chat history";
  }
}

/**
 * Silent message strategy for stateless components
 * Used by: NavigationAssistant for independent navigation without chat pollution
 */
export class SilentMessageStrategy implements MessageStrategy {
  handleUserMessage(content: string): void {
    // Silent - don't add to chat history
    // User feedback is provided through navigation itself and notifications
  }

  handleAssistantResponse(content: string, data?: ProcessResponse): void {
    // Silent - don't add to chat history
    // Response feedback is provided through navigation and notifications
    // The navigation/transaction results are already shown via notifications in handleProcessResponse
  }

  getDescription(): string {
    return "Silent messages - provides feedback via notifications only";
  }
}

/**
 * Factory for creating message strategies
 * Follows Single Responsibility Principle
 */
export class MessageStrategyFactory {
  static createPersistent(
    addUserMessage: (content: string) => void,
    addAssistantMessage: (content: string, data?: ProcessResponse) => void
  ): MessageStrategy {
    return new PersistentMessageStrategy(addUserMessage, addAssistantMessage);
  }
  
  static createSilent(): MessageStrategy {
    return new SilentMessageStrategy();
  }
}
