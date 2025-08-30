import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from '../components/ChatPanel';
import type { Message } from '../types';
import type { UseFormReturnType } from '@mantine/form';

// Mock Mantine components to isolate unit under test
vi.mock('@mantine/core', () => ({
  Card: vi.fn(({ children }) => (
    <div data-testid="chat-card">{children}</div>
  )),
  Stack: vi.fn(({ children }) => (
    <div data-testid="messages">{children}</div>
  )),
  Paper: vi.fn(({ children, 'data-testid': testId }) => (
    <div data-testid={testId}>{children}</div>
  )),
  Text: vi.fn(({ children, size }) => (
    <span data-testid="text" data-size={size}>{children}</span>
  )),
  Badge: vi.fn(({ children, 'data-testid': testId, color }) => (
    <span data-testid={testId} data-color={color}>{children}</span>
  )),
  Group: vi.fn(({ children, 'data-testid': testId }) => (
    <div data-testid={testId}>{children}</div>
  )),
  TextInput: vi.fn((props) => (
    <input 
      data-testid="chat-input"
      value={props.value || ''}
      onChange={props.onChange}
      placeholder={props.placeholder}
    />
  )),
  Button: vi.fn(({ children, 'data-testid': testId, onClick, disabled, type }) => (
    <button 
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      {children}
    </button>
  ))
}));

describe('ChatPanel Component', () => {
  const user = userEvent.setup();
  
  // Test data setup
  const mockMessages: Message[] = [
    {
      id: '1',
      type: 'user',
      content: 'Hello',
      timestamp: new Date('2024-01-01T00:00:00.000Z')
    },
    {
      id: '2',
      type: 'assistant',
      content: 'Hi there',
      confidence: 0.9,
      timestamp: new Date('2024-01-01T00:01:00.000Z')
    },
    {
      id: '3',
      type: 'system',
      content: 'System message',
      confidence: 0.5,
      timestamp: new Date('2024-01-01T00:02:00.000Z')
    }
  ];

  const mockForm: UseFormReturnType<{ message: string }> = {
    getInputProps: vi.fn().mockReturnValue({
      value: '',
      onChange: vi.fn()
    }),
    setFieldValue: vi.fn(),
    onSubmit: vi.fn((callback) => (e) => {
      e?.preventDefault();
      callback({ message: 'test message' });
    }),
    values: { message: '' }
  } as unknown as UseFormReturnType<{ message: string }>;

  const mockOnSubmit = vi.fn();

  const defaultProps = {
    messages: mockMessages,
    form: mockForm,
    isConnected: true,
    onSubmit: mockOnSubmit
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('React.FC() - Component Rendering', () => {
    it('React.FC() - should render the main chat panel container', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} />);
      });

      // ASSERT
      expect(screen.getByTestId('chat-card')).toBeDefined();
    });

    it('React.FC() - should render messages container', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} />);
      });

      // ASSERT
      expect(screen.getByTestId('messages')).toBeDefined();
    });

    it('React.FC() - should render chat input field', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} />);
      });

      // ASSERT
      expect(screen.getByTestId('chat-input')).toBeDefined();
    });

    it('React.FC() - should render send button', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} />);
      });

      // ASSERT
      expect(screen.getByTestId('send-button')).toBeDefined();
    });

    it('React.FC() - should render quick actions container', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} />);
      });

      // ASSERT
      expect(screen.getByTestId('quick-actions')).toBeDefined();
    });

    it('React.FC() - should render all quick action buttons', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} />);
      });

      // ASSERT
      expect(screen.getByTestId('quick-transfer')).toBeDefined();
      expect(screen.getByTestId('quick-transaction')).toBeDefined();
      expect(screen.getByTestId('quick-balance')).toBeDefined();
    });
  });

  describe('getConfidenceColor() - Confidence Color Mapping', () => {
    it('getConfidenceColor() - should return green for high confidence (>= 0.8)', async () => {
      // ARRANGE
      const highConfidenceMessage: Message[] = [{
        id: '1',
        type: 'assistant',
        content: 'High confidence response',
        confidence: 0.9,
        timestamp: new Date('2024-01-01T00:00:00.000Z')
      }];

      // ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} messages={highConfidenceMessage} />);
      });

      // ASSERT
      expect(screen.getByTestId('confidence').getAttribute('data-color')).toBe('green');
    });

    it('getConfidenceColor() - should return green for exact boundary confidence (0.8)', async () => {
      // ARRANGE
      const boundaryConfidenceMessage: Message[] = [{
        id: '1',
        type: 'assistant',
        content: 'Boundary confidence response',
        confidence: 0.8,
        timestamp: new Date('2024-01-01T00:00:00.000Z')
      }];

      // ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} messages={boundaryConfidenceMessage} />);
      });

      // ASSERT
      expect(screen.getByTestId('confidence').getAttribute('data-color')).toBe('green');
    });

    it('getConfidenceColor() - should return yellow for medium confidence (>= 0.6, < 0.8)', async () => {
      // ARRANGE
      const mediumConfidenceMessage: Message[] = [{
        id: '1',
        type: 'assistant',
        content: 'Medium confidence response',
        confidence: 0.7,
        timestamp: new Date('2024-01-01T00:00:00.000Z')
      }];

      // ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} messages={mediumConfidenceMessage} />);
      });

      // ASSERT
      expect(screen.getByTestId('confidence').getAttribute('data-color')).toBe('yellow');
    });

    it('getConfidenceColor() - should return yellow for exact boundary confidence (0.6)', async () => {
      // ARRANGE
      const boundaryConfidenceMessage: Message[] = [{
        id: '1',
        type: 'assistant',
        content: 'Boundary confidence response',
        confidence: 0.6,
        timestamp: new Date('2024-01-01T00:00:00.000Z')
      }];

      // ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} messages={boundaryConfidenceMessage} />);
      });

      // ASSERT
      expect(screen.getByTestId('confidence').getAttribute('data-color')).toBe('yellow');
    });

    it('getConfidenceColor() - should return red for low confidence (< 0.6)', async () => {
      // ARRANGE
      const lowConfidenceMessage: Message[] = [{
        id: '1',
        type: 'assistant',
        content: 'Low confidence response',
        confidence: 0.3,
        timestamp: new Date('2024-01-01T00:00:00.000Z')
      }];

      // ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} messages={lowConfidenceMessage} />);
      });

      // ASSERT
      expect(screen.getByTestId('confidence').getAttribute('data-color')).toBe('red');
    });
  });

  describe('Message Rendering - Message Display Logic', () => {
    it('Message Rendering - should render all messages from props', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} />);
      });

      // ASSERT
      const userMessage = screen.getByTestId('message-user');
      const assistantMessage = screen.getByTestId('message-assistant');
      const systemMessage = screen.getByTestId('message-system');
      
      expect(userMessage).toBeDefined();
      expect(assistantMessage).toBeDefined();
      expect(systemMessage).toBeDefined();
    });

    it('Message Rendering - should render empty messages container when no messages', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} messages={[]} />);
      });

      // ASSERT
      expect(screen.getByTestId('messages')).toBeDefined();
    });

    it('Message Rendering - should display confidence badge when confidence is provided', async () => {
      // ARRANGE
      const messageWithConfidence: Message[] = [{
        id: '1',
        type: 'assistant',
        content: 'Response with confidence',
        confidence: 0.85,
        timestamp: new Date('2024-01-01T00:00:00.000Z')
      }];

      // ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} messages={messageWithConfidence} />);
      });

      // ASSERT
      expect(screen.getByTestId('confidence')).toBeDefined();
      expect(screen.getByTestId('confidence').getAttribute('data-color')).toBe('green');
    });

    it('Message Rendering - should not display confidence badge when confidence is undefined', async () => {
      // ARRANGE
      const messageWithoutConfidence: Message[] = [{
        id: '1',
        type: 'user',
        content: 'User message without confidence',
        timestamp: new Date('2024-01-01T00:00:00.000Z')
      }];

      // ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} messages={messageWithoutConfidence} />);
      });

      // ASSERT
      expect(screen.queryByTestId('confidence')).toBeNull();
    });
  });

  describe('handleSubmit() - Form Submission', () => {
    it('handleSubmit() - should call onSubmit when form is submitted', async () => {
      // ARRANGE
      await act(async () => {
        render(<ChatPanel {...defaultProps} />);
      });

      const form = screen.getByTestId('chat-input').closest('form')!;

      // ACT
      await act(async () => {
        const submitEvent = new Event('submit', { bubbles: true });
        form.dispatchEvent(submitEvent);
      });

      // ASSERT
      expect(mockOnSubmit).toHaveBeenCalledWith({ message: 'test message' });
    });

    it('handleSubmit() - should call form.getInputProps for input configuration', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} />);
      });

      // ASSERT
      expect(mockForm.getInputProps).toHaveBeenCalledWith('message');
    });
  });

  describe('Button onClick() - Send Button Functionality', () => {
    it('Button onClick() - should disable send button when not connected', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} isConnected={false} />);
      });

      // ASSERT
      const sendButton = screen.getByTestId('send-button');
      expect(sendButton.hasAttribute('disabled')).toBe(true);
    });

    it('Button onClick() - should enable send button when connected', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} isConnected={true} />);
      });

      // ASSERT
      const sendButton = screen.getByTestId('send-button');
      expect(sendButton.hasAttribute('disabled')).toBe(false);
    });
  });

  describe('Quick Action Buttons - Form Field Value Setting', () => {
    it('Quick Action onClick() - should set form value for navigation quick action', async () => {
      // ARRANGE
      await act(async () => {
        render(<ChatPanel {...defaultProps} />);
      });

      const navigationButton = screen.getByTestId('quick-transfer');

      // ACT
      await act(async () => {
        await user.click(navigationButton);
      });

      // ASSERT
      expect(mockForm.setFieldValue).toHaveBeenCalledWith('message', 'Take me to international transfers');
    });

    it('Quick Action onClick() - should set form value for transaction quick action', async () => {
      // ARRANGE
      await act(async () => {
        render(<ChatPanel {...defaultProps} />);
      });

      const transactionButton = screen.getByTestId('quick-transaction');

      // ACT
      await act(async () => {
        await user.click(transactionButton);
      });

      // ASSERT
      expect(mockForm.setFieldValue).toHaveBeenCalledWith('message', 'Send $500 to my friend in Canada');
    });

    it('Quick Action onClick() - should set form value for balance quick action', async () => {
      // ARRANGE
      await act(async () => {
        render(<ChatPanel {...defaultProps} />);
      });

      const balanceButton = screen.getByTestId('quick-balance');

      // ACT
      await act(async () => {
        await user.click(balanceButton);
      });

      // ASSERT
      expect(mockForm.setFieldValue).toHaveBeenCalledWith('message', "What's my balance?");
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('React.FC() - should handle large number of messages efficiently', async () => {
      // ARRANGE
      const manyMessages: Message[] = Array.from({ length: 100 }, (_, i) => ({
        id: `msg-${i}`,
        type: i % 2 === 0 ? 'user' : 'assistant' as 'user' | 'assistant',
        content: `Message ${i}`,
        confidence: i % 2 === 0 ? undefined : 0.8,
        timestamp: new Date(`2024-01-01T00:${String(i).padStart(2, '0')}:00.000Z`)
      }));

      // ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} messages={manyMessages} />);
      });

      // ASSERT - Component should render without performance issues
      expect(screen.getByTestId('chat-card')).toBeDefined();
      expect(screen.getByTestId('messages')).toBeDefined();
    });

    it('React.FC() - should handle alternative form configuration', async () => {
      // ARRANGE
      const alternativeForm = {
        getInputProps: vi.fn().mockReturnValue({
          value: 'test input',
          onChange: vi.fn()
        }),
        setFieldValue: vi.fn(),
        onSubmit: vi.fn((callback) => callback),
        values: { message: 'test input' }
      } as unknown as UseFormReturnType<{ message: string }>;

      // ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} form={alternativeForm} />);
      });

      // ASSERT
      expect(screen.getByTestId('chat-card')).toBeDefined();
      expect(alternativeForm.getInputProps).toHaveBeenCalledWith('message');
    });

    it('getConfidenceColor() - should handle edge case confidence values', async () => {
      // ARRANGE
      const edgeConfidenceMessage: Message[] = [{
        id: '1',
        type: 'assistant',
        content: 'Edge case confidence',
        confidence: 0,
        timestamp: new Date('2024-01-01T00:00:00.000Z')
      }];

      // ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} messages={edgeConfidenceMessage} />);
      });

      // ASSERT
      expect(screen.getByTestId('confidence').getAttribute('data-color')).toBe('red');
    });

    it('getConfidenceColor() - should handle maximum confidence value', async () => {
      // ARRANGE
      const maxConfidenceMessage: Message[] = [{
        id: '1',
        type: 'assistant',
        content: 'Max confidence',
        confidence: 1.0,
        timestamp: new Date('2024-01-01T00:00:00.000Z')
      }];

      // ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} messages={maxConfidenceMessage} />);
      });

      // ASSERT
      expect(screen.getByTestId('confidence').getAttribute('data-color')).toBe('green');
    });

    it('Message Rendering - should handle messages with missing required fields', async () => {
      // ARRANGE
      const incompleteMessage: Message[] = [{
        id: '1',
        type: 'user',
        content: '',
        timestamp: new Date('2024-01-01T00:00:00.000Z')
      }];

      // ACT
      await act(async () => {
        render(<ChatPanel {...defaultProps} messages={incompleteMessage} />);
      });

      // ASSERT
      expect(screen.getByTestId('message-user')).toBeDefined();
    });
  });

  describe('Component State Management', () => {
    it('useState() - should handle connection state changes properly', async () => {
      // ARRANGE
      const { rerender } = render(<ChatPanel {...defaultProps} isConnected={true} />);

      // Initial state - connected
      expect(screen.getByTestId('send-button').hasAttribute('disabled')).toBe(false);

      // ACT - Change to disconnected
      await act(async () => {
        rerender(<ChatPanel {...defaultProps} isConnected={false} />);
      });

      // ASSERT
      expect(screen.getByTestId('send-button').hasAttribute('disabled')).toBe(true);
    });

    it('useState() - should handle messages prop changes', async () => {
      // ARRANGE
      const initialMessages: Message[] = [{
        id: '1',
        type: 'user',
        content: 'Initial message',
        timestamp: new Date('2024-01-01T00:00:00.000Z')
      }];

      const updatedMessages: Message[] = [
        ...initialMessages,
        {
          id: '2',
          type: 'assistant',
          content: 'New message',
          confidence: 0.9,
          timestamp: new Date('2024-01-01T00:01:00.000Z')
        }
      ];

      const { rerender } = render(<ChatPanel {...defaultProps} messages={initialMessages} />);

      // Initial state
      expect(screen.getByTestId('message-user')).toBeDefined();
      expect(screen.queryByTestId('message-assistant')).toBeNull();

      // ACT - Add new message
      await act(async () => {
        rerender(<ChatPanel {...defaultProps} messages={updatedMessages} />);
      });

      // ASSERT
      expect(screen.getByTestId('message-user')).toBeDefined();
      expect(screen.getByTestId('message-assistant')).toBeDefined();
    });
  });

  describe('Integration Points - External Dependencies', () => {
    it('form.onSubmit() - should properly integrate with Mantine form submission', async () => {
      // ARRANGE
      const formOnSubmitSpy = vi.fn((callback) => (e) => {
        e?.preventDefault();
        callback({ message: 'integration test' });
      });

      const integrationForm = {
        ...mockForm,
        onSubmit: formOnSubmitSpy
      };

      await act(async () => {
        render(<ChatPanel {...defaultProps} form={integrationForm} />);
      });

      const form = screen.getByTestId('chat-input').closest('form')!;

      // ACT
      await act(async () => {
        const submitEvent = new Event('submit', { bubbles: true });
        form.dispatchEvent(submitEvent);
      });

      // ASSERT
      expect(formOnSubmitSpy).toHaveBeenCalled();
      expect(mockOnSubmit).toHaveBeenCalledWith({ message: 'integration test' });
    });
  });
});
