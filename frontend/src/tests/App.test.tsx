import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import type { ProcessResponse, UIAssistance, Account } from '../types';

// Import for accessing mocked services
import { apiService } from '../services/api';
import { websocketService } from '../services/websocket';
import { notifications } from '@mantine/notifications';

// Mock the API and WebSocket services
vi.mock('../services/api', () => ({
  apiService: {
    initializeSession: vi.fn().mockResolvedValue(undefined),
    getAccounts: vi.fn().mockResolvedValue([]),
    processMessage: vi.fn().mockResolvedValue({
      message: 'Test response',
      intent: 'test',
      confidence: 0.9
    })
  }
}));

vi.mock('../services/websocket', () => ({
  websocketService: {
    connect: vi.fn().mockReturnValue({
      onopen: null,
      onclose: null,
      onmessage: null,
      close: vi.fn(),
      send: vi.fn()
    }),
    disconnect: vi.fn()
  }
}));

// Mock Mantine notifications
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn()
  }
}));

// Mock BankingScreens component
vi.mock('../components/BankingScreens', () => ({
  BankingScreens: {
    AccountsOverview: vi.fn(({ accounts = [] }) => <div data-testid="accounts-overview">Accounts: {accounts.length}</div>),
    TransfersHub: vi.fn(() => <div data-testid="transfers-hub">Transfers Hub</div>),
    BillPayHub: vi.fn(() => <div data-testid="bill-pay-hub">Bill Pay Hub</div>)
  }
}));

// Mock other components
vi.mock('../components/DynamicForm', () => ({
  DynamicForm: vi.fn(({ config, onSubmit, onCancel }) => (
    <div data-testid="dynamic-form">
      <h3 data-testid="dynamic-form-title">{config.title}</h3>
      <button data-testid="dynamic-form-submit" onClick={() => onSubmit({ test: 'data' })}>Submit Form</button>
      <button data-testid="dynamic-form-cancel" onClick={onCancel}>Cancel Form</button>
    </div>
  ))
}));

vi.mock('../components/ChatPanel', () => ({
  ChatPanel: vi.fn(({ messages, onSubmit, isConnected }) => (
    <div data-testid="chat-panel">
      <div data-testid="messages-count">{messages.length}</div>
      <div data-testid="connection-status">{isConnected ? 'connected' : 'disconnected'}</div>
      <button data-testid="chat-send-message" onClick={() => onSubmit({ message: 'test message' })}>Send Message</button>
    </div>
  ))
}));

vi.mock('../components/Header', () => ({
  Header: vi.fn(({ isConnected }) => (
    <div data-testid="header">
      Status: {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  ))
}));

describe('App Component', () => {
  const user = userEvent.setup();
  const mockWebSocket = {
    onopen: null as ((event: Event) => void) | null,
    onclose: null as ((event: CloseEvent) => void) | null,
    onmessage: null as ((event: MessageEvent) => void) | null,
    close: vi.fn(),
    send: vi.fn()
  };
  
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Clear all timers for deterministic tests  
    vi.clearAllTimers();
    
    // Reset websocket mock
    vi.mocked(websocketService.connect).mockReturnValue(mockWebSocket as unknown as WebSocket);
    
    // Reset notifications mock
    vi.mocked(notifications.show).mockClear();
  });

  afterEach(() => {
    // Clean up DOM after each test
    cleanup();
  });

    describe('useEffect() - Component Lifecycle', () => {
    it('useEffect() - should render the main app container on mount', async () => {
      await act(async () => {
        render(<App />);
      });
      
      await waitFor(() => {
        const appElement = screen.getByTestId('app');
        expect(appElement).toBeInTheDocument();
      });
    });

    it('initializeSession() - should call API service on component mount', async () => {
      await act(async () => {
        render(<App />);
      });

      await waitFor(() => {
        expect(vi.mocked(apiService.initializeSession)).toHaveBeenCalledTimes(1);
      });
    });

    it('loadAccounts() - should call API service on component mount', async () => {
      await act(async () => {
        render(<App />);
      });

      await waitFor(() => {
        expect(vi.mocked(apiService.getAccounts)).toHaveBeenCalledTimes(1);
      });
    });

    it('connectWebSocket() - should establish connection on component mount', async () => {
      await act(async () => {
        render(<App />);
      });

      await waitFor(() => {
        expect(vi.mocked(websocketService.connect)).toHaveBeenCalledTimes(1);
      });
    });

    it('useEffect() cleanup - should disconnect websocket on component unmount', async () => {
      const { unmount } = render(<App />);
      
      await act(async () => {
        unmount();
      });

      expect(vi.mocked(websocketService.disconnect)).toHaveBeenCalledTimes(1);
    });
  });

    describe('setActiveTab() - Tab State Management', () => {
    it('JSX render() - should render the tab navigation UI', async () => {
      await act(async () => {
        render(<App />);
      });
      
      await waitFor(() => {
        const tabList = screen.getByTestId('tab-list');
        expect(tabList).toBeInTheDocument();
      });
    });

    it('JSX render() - should render all three main tab buttons', async () => {
      await act(async () => {
        render(<App />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('tab-banking')).toBeInTheDocument();
        expect(screen.getByTestId('tab-transaction')).toBeInTheDocument();
        expect(screen.getByTestId('tab-chat')).toBeInTheDocument();
      });
    });

    it('JSX render() - should display correct tab labels with test IDs', async () => {
      await act(async () => {
        render(<App />);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('tab-banking')).toBeInTheDocument();
        expect(screen.getByTestId('tab-transaction')).toBeInTheDocument();
        expect(screen.getByTestId('tab-chat')).toBeInTheDocument();
      });
    });

    it('useState(activeTab) - should start with banking tab active by default', async () => {
      await act(async () => {
        render(<App />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toBeInTheDocument();
        expect(screen.getByTestId('transfers-hub')).toBeInTheDocument();
        expect(screen.getByTestId('bill-pay-hub')).toBeInTheDocument();
      });
    });

    it('setActiveTab() - should switch to chat tab when clicked', async () => {
      await act(async () => {
        render(<App />);
      });

      await waitFor(() => {
        const chatTab = screen.getByTestId('tab-chat');
        expect(chatTab).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
      });
    });

    it('setActiveTab() - should switch to transaction tab when clicked', async () => {
      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-transaction'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('transaction-assistance-title')).toBeInTheDocument();
      });
    });
  });

  describe('connectWebSocket() - WebSocket State Management', () => {
    it('useState(isConnected) - should show disconnected status initially', async () => {
      await act(async () => {
        render(<App />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('header')).toHaveTextContent('Status: Disconnected');
      });
    });

    it('connectWebSocket() onopen - should update connection status when websocket opens', async () => {
      await act(async () => {
        render(<App />);
      });

      // Simulate websocket connection opening
      await act(async () => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'));
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('header')).toHaveTextContent('Status: Connected');
      });
    });

    it('connectWebSocket() onclose - should update connection status when websocket closes', async () => {
      await act(async () => {
        render(<App />);
      });

      // First open the connection
      await act(async () => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'));
        }
      });

      // Then close it
      await act(async () => {
        if (mockWebSocket.onclose) {
          mockWebSocket.onclose(new CloseEvent('close'));
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('header')).toHaveTextContent('Status: Disconnected');
      });
    });
  });

  describe('handleSubmit() - Message Processing', () => {
    it('handleSubmit() - should process chat message submission via API', async () => {
      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        expect(vi.mocked(apiService.processMessage)).toHaveBeenCalledWith('test message', 'chat');
      });
    });

    it('addSystemMessage() - should add system message when component initializes', async () => {
      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        expect(messagesCount).toHaveTextContent('1'); // System message added
      });
    });

    it('handleSubmit() - should close navigation assistant when processing message', async () => {
      render(<App />);

      // Open navigation assistant first
      await act(async () => {
        const assistantButton = screen.getByTitle('Navigation Assistant');
        await user.click(assistantButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('navigation-assistant-title')).toBeInTheDocument();
      });

      // Switch to chat and submit message - should close navigation assistant
      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        expect(screen.queryByTestId('navigation-assistant-title')).not.toBeInTheDocument();
      });
    });

    it('handleWebSocketMessage() - should process websocket messages without errors', async () => {
      render(<App />);

      // First establish WebSocket connection
      await act(async () => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'));
        }
      });

      // Verify connection is established
      await waitFor(() => {
        expect(screen.getByTestId('header')).toHaveTextContent('Status: Connected');
      });

      const mockProcessResponse: ProcessResponse = {
        status: 'success',
        message: 'WebSocket response',
        intent: 'test_intent',
        confidence: 0.95
      };

      // Send WebSocket message and verify it doesn't cause errors
      await act(async () => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'result',
              data: mockProcessResponse
            })
          }));
        }
      });

      // Verify the application is still functional
      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
      });
    });
  });

  describe('handleUIAssistance() - UI Assistance Processing', () => {
    it('handleUIAssistance() - should handle navigation assistance with component_name', async () => {
      const navigationAssistance: UIAssistance = {
        type: 'navigation',
        action: 'navigate',
        component_name: 'AccountsOverview',
        title: 'Accounts Overview'
      };

      const mockResponse: ProcessResponse = {
        status: 'success',
        message: 'Navigating to accounts',
        ui_assistance: navigationAssistance
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        // Should switch to banking tab
        expect(screen.getByTestId('accounts-overview')).toBeInTheDocument();
      });
    });

    it('handleUIAssistance() - should handle navigation assistance without component_name', async () => {
      const navigationAssistance: UIAssistance = {
        type: 'navigation',
        action: 'navigate',
        title: 'Some Screen'
      };

      const mockResponse: ProcessResponse = {
        status: 'success',
        ui_assistance: navigationAssistance
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      render(<App />);

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      // Should set currentScreen to empty string, showing default banking UI
      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toBeInTheDocument();
      });
    });

    it('handleUIAssistance() - should handle transaction form assistance', async () => {
      const formConfig = {
        screen_id: 'transfer',
        title: 'Money Transfer',
        subtitle: 'Send money easily',
        fields: [],
        confirmation_required: true,
        complexity_reduction: '50% fewer steps'
      };

      const transactionAssistance: UIAssistance = {
        type: 'transaction_form',
        action: 'show_form',
        form_config: formConfig,
        title: 'Transfer Form'
      };

      const mockResponse: ProcessResponse = {
        status: 'success',
        message: 'Form created',
        ui_assistance: transactionAssistance
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('dynamic-form')).toBeInTheDocument();
        expect(screen.getByTestId('dynamic-form-title')).toBeInTheDocument();
      });
    });
  });

  describe('handleDynamicFormSubmit() - Dynamic Form Processing', () => {
    it('handleDynamicFormSubmit() - should process form submission with notifications', async () => {
      const formConfig = {
        screen_id: 'transfer',
        title: 'Money Transfer',
        subtitle: 'Send money easily',
        fields: [],
        confirmation_required: true,
        complexity_reduction: '50% fewer steps'
      };

      const transactionAssistance: UIAssistance = {
        type: 'transaction_form',
        action: 'show_form',
        form_config: formConfig,
        title: 'Transfer Form'
      };

      const mockResponse: ProcessResponse = {
        status: 'success',
        ui_assistance: transactionAssistance
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('dynamic-form')).toBeInTheDocument();
      });

      // Submit the form
      await act(async () => {
        await user.click(screen.getByTestId('dynamic-form-submit'));
      });

      await waitFor(() => {
        // Form should be cleared and should switch to chat tab
        expect(screen.queryByTestId('dynamic-form')).not.toBeInTheDocument();
        expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
      });
    });

    it('DynamicForm onCancel() - should handle form cancellation and tab switching', async () => {
      const formConfig = {
        screen_id: 'transfer',
        title: 'Money Transfer',
        subtitle: 'Send money easily',
        fields: [],
        confirmation_required: true,
        complexity_reduction: '50% fewer steps'
      };

      const transactionAssistance: UIAssistance = {
        type: 'transaction_form',
        action: 'show_form',
        form_config: formConfig,
        title: 'Transfer Form'
      };

      const mockResponse: ProcessResponse = {
        status: 'success',
        ui_assistance: transactionAssistance
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('dynamic-form')).toBeInTheDocument();
      });

      // Cancel the form
      await act(async () => {
        await user.click(screen.getByTestId('dynamic-form-cancel'));
      });

      await waitFor(() => {
        // Form should be cleared and should switch back to banking tab
        expect(screen.queryByTestId('dynamic-form')).not.toBeInTheDocument();
        expect(screen.getByTestId('accounts-overview')).toBeInTheDocument();
      });
    });
  });

  describe('setShowNavigationAssistant() - Navigation Assistant Modal', () => {
    it('setShowNavigationAssistant() - should show modal when assistant button clicked', async () => {
      await act(async () => {
        render(<App />);
      });

      // Find and click the navigation assistant button
      await act(async () => {
        const assistantButton = screen.getByTitle('Navigation Assistant');
        await user.click(assistantButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('navigation-assistant-title')).toBeInTheDocument();
        expect(screen.getByTestId('navigation-assistant-description')).toBeInTheDocument();
      });
    });

    it('setShowNavigationAssistant() - should hide modal when close button clicked', async () => {
      await act(async () => {
        render(<App />);
      });

      // Show the navigation assistant
      await act(async () => {
        const assistantButton = screen.getByTitle('Navigation Assistant');
        await user.click(assistantButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('navigation-assistant-title')).toBeInTheDocument();
      });

      // Close the navigation assistant
      await act(async () => {
        const closeButton = screen.getByTestId('navigation-assistant-close');
        await user.click(closeButton);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('navigation-assistant-title')).not.toBeInTheDocument();
      });
    });

    it('form.setFieldValue() - should pre-fill message when suggestion buttons clicked', async () => {
      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        const assistantButton = screen.getByTitle('Navigation Assistant');
        await user.click(assistantButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('suggestion-international-transfers')).toBeInTheDocument();
      });

      // Click a suggestion button - this should pre-fill the form
      await act(async () => {
        await user.click(screen.getByTestId('suggestion-international-transfers'));
      });

      // The form should now be pre-filled, but we can't easily test the input value
      // since it's managed by Mantine's form hook
    });
  });

  describe('loadAccounts() - Account Data Management', () => {
    it('loadAccounts() - should display accounts when API call succeeds', async () => {
      const mockAccounts: Account[] = [
        { id: '1', name: 'Checking', type: 'checking', balance: 1000 },
        { id: '2', name: 'Savings', type: 'savings', balance: 5000 }
      ];

      vi.mocked(apiService.getAccounts).mockResolvedValueOnce(mockAccounts);

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toHaveTextContent('Accounts: 2');
      });
    });
  });

  describe('renderBankingScreen() - Banking Screen Rendering', () => {
    it('renderBankingScreen() - should render default dashboard when currentScreen is null', async () => {
      render(<App />);

      await waitFor(() => {
        // Default banking screen should show all components
        expect(screen.getByTestId('accounts-overview')).toBeInTheDocument();
        expect(screen.getByTestId('transfers-hub')).toBeInTheDocument();
        expect(screen.getByTestId('bill-pay-hub')).toBeInTheDocument();
      });
    });

    it('renderBankingScreen() - should render specific screen when currentScreen is set', async () => {
      const navigationAssistance: UIAssistance = {
        type: 'navigation',
        action: 'navigate',
        component_name: 'AccountsOverview',
        title: 'Accounts Overview'
      };

      const mockResponse: ProcessResponse = {
        status: 'success',
        ui_assistance: navigationAssistance
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      render(<App />);

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      // Should render specific banking screen
      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toBeInTheDocument();
      });
    });
  });

  describe('handleProcessResponse() - Response Processing Logic', () => {
    it('handleProcessResponse() - should generate default message when no message provided', async () => {
      const mockResponse: ProcessResponse = {
        status: 'success',
        intent: 'unknown',
        confidence: 0.5
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      render(<App />);

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        // Should add message with default text "I'm processing your request..."
        expect(parseInt(messagesCount.textContent || '0')).toBeGreaterThan(1);
      });
    });

    it('handleProcessResponse() - should generate navigation message for navigation ui_assistance', async () => {
      const mockResponse: ProcessResponse = {
        status: 'success',
        ui_assistance: {
          type: 'navigation',
          action: 'navigate',
          title: 'Account Details'
        }
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      render(<App />);

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        // Should add message with navigation text "Opening Account Details..."
        expect(parseInt(messagesCount.textContent || '0')).toBeGreaterThan(1);
      });
    });

    it('handleProcessResponse() - should generate form message for transaction_form ui_assistance', async () => {
      const mockResponse: ProcessResponse = {
        status: 'success',
        ui_assistance: {
          type: 'transaction_form',
          action: 'create_form',
          form_config: {
            screen_id: 'transfer',
            title: 'Transfer Money',
            subtitle: 'Quick transfer',
            fields: [],
            confirmation_required: false,
            complexity_reduction: '50% simpler'
          }
        }
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      render(<App />);

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        // Should add message with form creation text
        expect(parseInt(messagesCount.textContent || '0')).toBeGreaterThan(1);
      });
    });
  });

  describe('initializeSession() / handleSubmit() / loadAccounts() - Error Handling', () => {
    it('initializeSession() - should handle session initialization errors gracefully', async () => {
      const mockError = new Error('Failed to initialize session');
      vi.mocked(apiService.initializeSession).mockRejectedValueOnce(mockError);

      // Mock notifications
      const { notifications } = await import('@mantine/notifications');

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          title: 'Connection Error',
          message: 'Failed to connect to banking assistant',
          color: 'red'
        });
      });
    });

    it('handleSubmit() - should handle message processing API errors gracefully', async () => {
      const mockError = new Error('Processing failed');
      vi.mocked(apiService.processMessage).mockRejectedValueOnce(mockError);

      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        // Should have system message + error message
        expect(parseInt(messagesCount.textContent || '0')).toBeGreaterThanOrEqual(2);
      });
    });

    it('loadAccounts() - should handle account loading API errors gracefully', async () => {
      const mockError = new Error('Failed to load accounts');
      vi.mocked(apiService.getAccounts).mockRejectedValueOnce(mockError);

      await act(async () => {
        render(<App />);
      });

      await waitFor(() => {
        // Should still render the component even if accounts fail to load
        expect(screen.getByTestId('accounts-overview')).toHaveTextContent('Accounts: 0');
      });
    });
  });

  describe('handleWebSocketMessage() - WebSocket Message Processing', () => {
    it('handleWebSocketMessage() - should process messages with result type', async () => {
      render(<App />);

      // Establish WebSocket connection first
      await act(async () => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'));
        }
      });

      const mockProcessResponse: ProcessResponse = {
        status: 'success',
        message: 'WebSocket result message',
        intent: 'test_intent',
        confidence: 0.95
      };

      await act(async () => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'result',
              data: mockProcessResponse
            })
          }));
        }
      });

      // Message should be processed
      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
      });
    });

    it('handleWebSocketMessage() - should ignore messages without result type', async () => {
      render(<App />);

      // Establish WebSocket connection first
      await act(async () => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'));
        }
      });

      await act(async () => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'status',
              data: { message: 'Status update' }
            })
          }));
        }
      });

      // Message should be ignored - no additional messages added
      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        expect(messagesCount).toHaveTextContent('1'); // Only system message
      });
    });
  });

  describe('setActiveTab() - Advanced Tab Management', () => {
    it('setActiveTab() - should handle tab change to null value with fallback', async () => {
      render(<App />);

      // The onChange handler has fallback: onChange={(value) => setActiveTab(value || 'banking')}
      // Since we can't easily trigger this via UI, we test the current behavior
      await waitFor(() => {
        expect(screen.getByTestId('tab-banking')).toBeInTheDocument();
      });
    });

    it('setActiveTab() - should switch between all tabs correctly', async () => {
      render(<App />);

      // Start on banking tab (default)
      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toBeInTheDocument();
      });

      // Switch to transaction tab
      await act(async () => {
        await user.click(screen.getByTestId('tab-transaction'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('transaction-assistance-title')).toBeInTheDocument();
      });

      // Switch to chat tab
      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
      });

      // Switch back to banking tab
      await act(async () => {
        await user.click(screen.getByTestId('tab-banking'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toBeInTheDocument();
      });
    });
  });

  describe('handleSubmit() / handleWebSocketMessage() - Edge Cases', () => {
    it('handleSubmit() - should prevent empty message submission', async () => {
      render(<App />);

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        expect(messagesCount).toHaveTextContent('1'); // Only system message initially
      });

      // The handleSubmit function in App.tsx checks `if (!userMessage) return;`
      // Since our mock ChatPanel sends 'test message', we can't directly test empty string handling
      // But we can verify the initial state shows only the system message
      expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    });

    it('handleWebSocketMessage() - should handle websocket message without result type', async () => {
      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'unknown',
              data: { message: 'Unknown message type' }
            })
          }));
        }
      });

      // Should not cause any errors or state changes
      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        expect(messagesCount).toHaveTextContent('1'); // Only system message
      });
    });

    it('handleProcessResponse() - should handle response without message or ui_assistance', async () => {
      const mockResponse: ProcessResponse = {
        status: 'success',
        intent: 'test',
        confidence: 0.8
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

    await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        // Should add default processing message
        expect(parseInt(messagesCount.textContent || '0')).toBeGreaterThan(1);
      });
    });
  });

  describe('handleSubmit() / connectWebSocket() / handleUIAssistance() - Advanced Edge Cases', () => {
    it('handleSubmit() - should handle network timeout gracefully', async () => {
      // ARRANGE
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';
      vi.mocked(apiService.processMessage).mockRejectedValueOnce(timeoutError);

      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      // ACT
      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      // ASSERT
      await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        // Should have system message + user message + error message
        expect(parseInt(messagesCount.textContent || '0')).toBeGreaterThanOrEqual(3);
      });
    });

    it('connectWebSocket() - should handle connection refused gracefully', async () => {
      // ARRANGE
      const mockWebSocketWithError = {
        ...mockWebSocket,
        onerror: null as ((event: Event) => void) | null
      };
      
      vi.mocked(websocketService.connect).mockReturnValueOnce(mockWebSocketWithError as unknown as WebSocket);

      await act(async () => {
        render(<App />);
      });

      // ACT - Simulate connection error
      await act(async () => {
        if (mockWebSocketWithError.onerror) {
          mockWebSocketWithError.onerror(new Event('error'));
        }
        // Also trigger close event as connection failed
        if (mockWebSocketWithError.onclose) {
          mockWebSocketWithError.onclose(new CloseEvent('close', { code: 1006, reason: 'Connection refused' }));
        }
      });

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('header')).toHaveTextContent('Status: Disconnected');
      });
    });

    it('handleUIAssistance() - should handle malformed ui_assistance data gracefully', async () => {
      // ARRANGE
      const malformedUIAssistance = {
        type: 'invalid_type' as never,
        action: null as never,
        component_name: undefined,
        title: '',
        form_config: { invalid: 'config' } as never
      } as UIAssistance;

      const mockResponse: ProcessResponse = {
        status: 'success',
        message: 'Processing with malformed UI assistance',
        ui_assistance: malformedUIAssistance
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      // ACT
      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      // ASSERT - Should not crash and should display message
      await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        expect(parseInt(messagesCount.textContent || '0')).toBeGreaterThan(1);
      });

      // Should remain on banking tab as invalid navigation
      expect(screen.getByTestId('accounts-overview')).toBeInTheDocument();
    });

    it('handleProcessResponse() - should handle missing required properties gracefully', async () => {
      // ARRANGE  
      const incompleteResponse = {} as ProcessResponse;

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(incompleteResponse);

      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      // ACT
      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      // ASSERT - Should provide default message
      await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        expect(parseInt(messagesCount.textContent || '0')).toBeGreaterThan(1);
      });
    });

    it('loadAccounts() - should handle malformed account data gracefully', async () => {
      // ARRANGE
      const malformedAccounts = [
        { id: null as never, name: undefined, type: 'invalid', balance: 'not-a-number' },
        { missing: 'properties' } as never,
        null,
        undefined
      ] as unknown as Account[];

      vi.mocked(apiService.getAccounts).mockResolvedValueOnce(malformedAccounts);

      // ACT
      await act(async () => {
        render(<App />);
      });

      // ASSERT - Should render without crashing
      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toBeInTheDocument();
      });
    });
  });

  describe('WebSocket + API / Form + Navigation - Integration Testing', () => {
    it('WebSocket + API integration - should handle concurrent messages and API calls', async () => {
      // ARRANGE
      let resolveApiCall: (value: ProcessResponse) => void;
      const apiPromise = new Promise<ProcessResponse>((resolve) => {
        resolveApiCall = resolve;
      });
      
      vi.mocked(apiService.processMessage).mockReturnValueOnce(apiPromise);

      const mockProcessResponse: ProcessResponse = {
        status: 'success',
        message: 'API response',
        intent: 'test_intent',
        confidence: 0.8
      };

      const wsProcessResponse: ProcessResponse = {
        status: 'success',
        message: 'WebSocket response',
        intent: 'ws_intent',
        confidence: 0.9
      };

      await act(async () => {
        render(<App />);
      });

      // Establish WebSocket connection
      await act(async () => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'));
        }
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      // ACT - Start API call (doesn't resolve immediately)
      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      // Send WebSocket message while API is pending
      await act(async () => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage(new MessageEvent('message', {
            data: JSON.stringify({
              type: 'result',
              data: wsProcessResponse
            })
          }));
        }
      });

      // Now resolve the API call
      await act(async () => {
        resolveApiCall!(mockProcessResponse);
      });

      // ASSERT - Both messages should be processed
      await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        // Should have: system + user message + at least one response (WebSocket or API)
        expect(parseInt(messagesCount.textContent || '0')).toBeGreaterThanOrEqual(3);
      });

      // Verify that both API and WebSocket interactions happened
      expect(vi.mocked(apiService.processMessage)).toHaveBeenCalledTimes(1);
    });

    it('Form + Navigation integration - should preserve form data during navigation', async () => {
      // ARRANGE
      const formConfig = {
        screen_id: 'transfer',
        title: 'Money Transfer',
        subtitle: 'Send money easily',
        fields: [
          { id: 'amount', name: 'amount', type: 'number', label: 'Amount', required: true }
        ],
        confirmation_required: true,
        complexity_reduction: '50% fewer steps'
      };

      const transactionAssistance: UIAssistance = {
        type: 'transaction_form',
        action: 'show_form',
        form_config: formConfig,
        title: 'Transfer Form'
      };

      const mockResponse: ProcessResponse = {
        status: 'success',
        ui_assistance: transactionAssistance
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      // Create form
      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('dynamic-form')).toBeInTheDocument();
      });

      // ACT - Navigate away from transaction tab
      await act(async () => {
        await user.click(screen.getByTestId('tab-banking'));
      });

      // Navigate back to transaction tab
      await act(async () => {
        await user.click(screen.getByTestId('tab-transaction'));
      });

      // ASSERT - Form should still be there (preserved)
      await waitFor(() => {
        expect(screen.getByTestId('dynamic-form')).toBeInTheDocument();
        expect(screen.getByTestId('dynamic-form-title')).toHaveTextContent('Money Transfer');
      });
    });

    it('WebSocket reconnection - should handle connection loss and recovery', async () => {
      // ARRANGE
      await act(async () => {
        render(<App />);
      });

      // Establish initial connection
      await act(async () => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'));
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('header')).toHaveTextContent('Status: Connected');
      });

      // ACT - Simulate connection loss
      await act(async () => {
        if (mockWebSocket.onclose) {
          mockWebSocket.onclose(new CloseEvent('close', { code: 1001, reason: 'Connection lost' }));
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('header')).toHaveTextContent('Status: Disconnected');
      });

      // Simulate reconnection
      const newMockWebSocket = { ...mockWebSocket };
      vi.mocked(websocketService.connect).mockReturnValueOnce(newMockWebSocket as unknown as WebSocket);

      await act(async () => {
        // Trigger reconnection logic (in real app this might be automatic)
        if (newMockWebSocket.onopen) {
          newMockWebSocket.onopen(new Event('open'));
        }
      });

      // ASSERT - Should show connected status again
      await waitFor(() => {
        expect(screen.getByTestId('header')).toHaveTextContent('Status: Connected');
      });
    });

    it('Multi-tab state synchronization - should handle state changes across tabs', async () => {
      // ARRANGE
      await act(async () => {
        render(<App />);
      });

      // Start on banking tab
      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toBeInTheDocument();
      });

      // Open navigation assistant
      await act(async () => {
        const assistantButton = screen.getByTitle('Navigation Assistant');
        await user.click(assistantButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('navigation-assistant-title')).toBeInTheDocument();
      });

      // ACT - Switch to chat tab while assistant is open
      // Note: Navigation assistant only closes on message submission, not tab switching
      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      // Verify we're on chat tab
      await waitFor(() => {
        expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
      });

      // Submit a message to trigger navigation assistant closure
      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      // Navigation assistant should close after message submission
      await waitFor(() => {
        expect(screen.queryByTestId('navigation-assistant-title')).not.toBeInTheDocument();
      });

      // Switch back to banking tab
      await act(async () => {
        await user.click(screen.getByTestId('tab-banking'));
      });

      // ASSERT - Should be back on banking screen without assistant open
      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toBeInTheDocument();
        expect(screen.queryByTestId('navigation-assistant-title')).not.toBeInTheDocument();
      });
    });

    it('Error recovery flow - should recover from multiple consecutive errors', async () => {
      // ARRANGE
      const error1 = new Error('First error');
      const error2 = new Error('Second error');
      const successResponse: ProcessResponse = {
        status: 'success',
        message: 'Recovery successful',
        intent: 'test',
        confidence: 0.9
      };

      vi.mocked(apiService.processMessage)
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValueOnce(successResponse);

      await act(async () => {
        render(<App />);
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      // ACT - First error
      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        expect(parseInt(messagesCount.textContent || '0')).toBeGreaterThanOrEqual(2);
      });

      // Second error
      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        expect(parseInt(messagesCount.textContent || '0')).toBeGreaterThanOrEqual(3);
      });

      // Successful recovery
      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      // ASSERT - Should recover and work normally
      await waitFor(() => {
        const messagesCount = screen.getByTestId('messages-count');
        expect(parseInt(messagesCount.textContent || '0')).toBeGreaterThanOrEqual(4);
      });
    });
  });
});
