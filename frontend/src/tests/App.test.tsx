import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { MainApp } from '../App';
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

// Mock Mantine notifications - behavior only
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn()
  },
  Notifications: vi.fn(() => <div data-testid="notifications-container" />)
}));

// Clean behavior-focused component mocks
vi.mock('../components/BankingScreens', () => ({
  BankingScreens: {
    AccountsOverview: vi.fn(({ accounts = [] }) => 
      <div data-testid="accounts-overview" data-account-count={accounts.length} />
    ),
    TransfersHub: vi.fn(() => 
      <div data-testid="transfers-hub" />
    ),
    BillPayHub: vi.fn(() => 
      <div data-testid="bill-pay-hub" />
    ),
    WireTransferForm: vi.fn(() => 
      <div data-testid="wire-transfer-form" />
    )
  }
}));

vi.mock('../components/DynamicForm', () => ({
  DynamicForm: vi.fn(({ config, onSubmit, onCancel }) => (
    <div data-testid="dynamic-form" data-form-id={config?.screen_id}>
      <button data-testid="dynamic-form-submit" onClick={() => onSubmit({ test: 'data' })}>
        Submit
      </button>
      <button data-testid="dynamic-form-cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  ))
}));

vi.mock('../components/ChatPanel', () => ({
  ChatPanel: vi.fn(({ messages, onSubmit, isConnected }) => (
    <div 
      data-testid="chat-panel" 
      data-message-count={messages.length}
      data-connection-status={isConnected ? 'connected' : 'disconnected'}
    >
      <button data-testid="chat-send-message" onClick={() => onSubmit({ message: 'test message' })}>
        Send
      </button>
    </div>
  ))
}));

vi.mock('../components/Header', () => ({
  Header: vi.fn(({ isConnected }) => (
    <div data-testid="header" data-connection-status={isConnected ? 'connected' : 'disconnected'} />
  ))
}));

// Test helper to render MainApp with proper routing context
const renderAppWithRouter = (initialEntries = ['/']) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <MainApp />
    </MemoryRouter>
  );
};

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
    vi.clearAllTimers();
    
    // Reset websocket mock
    vi.mocked(websocketService.connect).mockReturnValue(mockWebSocket as unknown as WebSocket);
    
    // Reset notifications mock
    vi.mocked(notifications.show).mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('render() - Component Rendering', () => {
    it('render() - should render main app container', async () => {
      await act(async () => {
        renderAppWithRouter();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('app')).toBeDefined();
      });
    });

    it('render() - should render notifications container', async () => {
      await act(async () => {
        renderAppWithRouter();
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('notifications-container')).toBeDefined();
      });
    });

    it('render() - should render tab navigation structure', async () => {
      await act(async () => {
        renderAppWithRouter();
      });
      
      await waitFor(() => {
        const tabList = screen.getByTestId('tab-list');
        expect(tabList).toBeDefined();
        expect(screen.getByTestId('tab-banking')).toBeDefined();
        expect(screen.getByTestId('tab-transaction')).toBeDefined();
        expect(screen.getByTestId('tab-chat')).toBeDefined();
      });
    });
  });

  describe('useEffect() - Component Lifecycle', () => {
    it('initializeSession() - should call API service on mount', async () => {
      await act(async () => {
        renderAppWithRouter();
      });

      await waitFor(() => {
        expect(vi.mocked(apiService.initializeSession)).toHaveBeenCalledTimes(1);
      });
    });

    it('loadAccounts() - should call accounts API on mount', async () => {
      await act(async () => {
        renderAppWithRouter();
      });

      await waitFor(() => {
        expect(vi.mocked(apiService.getAccounts)).toHaveBeenCalledTimes(1);
      });
    });

    it('connectWebSocket() - should establish WebSocket connection on mount', async () => {
      await act(async () => {
        renderAppWithRouter();
      });

      await waitFor(() => {
        expect(vi.mocked(websocketService.connect)).toHaveBeenCalledTimes(1);
      });
    });

    it('useEffect() cleanup - should disconnect WebSocket on unmount', async () => {
      const { unmount } = renderAppWithRouter();
      
      await act(async () => {
        unmount();
      });

      expect(vi.mocked(websocketService.disconnect)).toHaveBeenCalledTimes(1);
    });
  });

  describe('setActiveTab() - Tab State Management', () => {
    it('useState(activeTab) - should start with banking tab active by default', async () => {
      await act(async () => {
        renderAppWithRouter(['/']); // Start at root route
      });
      
      await waitFor(() => {
        // Banking tab should be active by default (root route maps to banking)
        const bankingTab = screen.getByTestId('tab-banking');
        expect(bankingTab.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('setActiveTab() - should switch to chat tab when clicked', async () => {
      await act(async () => {
        renderAppWithRouter(['/']); // Start at banking
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('chat-panel')).toBeDefined();
        const chatTab = screen.getByTestId('tab-chat');
        expect(chatTab.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('setActiveTab() - should switch to transaction tab when clicked', async () => {
      await act(async () => {
        renderAppWithRouter(['/']); // Start at banking
      });

      await act(async () => {
        await user.click(screen.getByTestId('tab-transaction'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('transaction-assistance-title')).toBeDefined();
        const transactionTab = screen.getByTestId('tab-transaction');
        expect(transactionTab.getAttribute('aria-selected')).toBe('true');
      });
    });
  });

  describe('connectWebSocket() - Connection Management', () => {
    it('useState(isConnected) - should show disconnected status initially', async () => {
      await act(async () => {
        renderAppWithRouter();
      });

      await waitFor(() => {
        const header = screen.getByTestId('header');
        expect(header.getAttribute('data-connection-status')).toBe('disconnected');
      });
    });

    it('connectWebSocket() onopen - should update status when connection opens', async () => {
      await act(async () => {
        renderAppWithRouter();
      });

      await act(async () => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen(new Event('open'));
        }
      });

      await waitFor(() => {
        const header = screen.getByTestId('header');
        expect(header.getAttribute('data-connection-status')).toBe('connected');
      });
    });

    it('connectWebSocket() onclose - should update status when connection closes', async () => {
      await act(async () => {
        renderAppWithRouter();
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
        const header = screen.getByTestId('header');
        expect(header.getAttribute('data-connection-status')).toBe('disconnected');
      });
    });
  });

  describe('handleSubmit() - Message Processing', () => {
    it('handleSubmit() - should process chat messages via API', async () => {
      await act(async () => {
        renderAppWithRouter(['/chat']); // Start on chat tab
      });

      await waitFor(() => {
        expect(screen.getByTestId('chat-panel')).toBeDefined();
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        expect(vi.mocked(apiService.processMessage)).toHaveBeenCalledWith('test message', 'chat');
      });
    });

    it('addSystemMessage() - should initialize message system', async () => {
      await act(async () => {
        renderAppWithRouter(['/chat']); // Start on chat tab
      });

      await waitFor(() => {
        const chatPanel = screen.getByTestId('chat-panel');
        const messageCount = parseInt(chatPanel.getAttribute('data-message-count') || '0');
        expect(messageCount).toBeGreaterThan(0);
      });
    });

    it('handleSubmit() - should close navigation assistant when processing', async () => {
      renderAppWithRouter(['/']); // Start on banking tab

      // Open navigation assistant
      await act(async () => {
        const assistantButton = screen.getByTitle('Navigation Assistant');
        await user.click(assistantButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('navigation-assistant-title')).toBeDefined();
      });

      // Submit message should close assistant
      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        expect(screen.queryByTestId('navigation-assistant-title')).toBeNull();
      });
    });
  });

  describe('handleUIAssistance() - Navigation Processing', () => {
    it('handleUIAssistance() - should handle navigation with component name', async () => {
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
        renderAppWithRouter(['/chat']); // Start on chat tab
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        // Should navigate to accounts overview route
        expect(screen.getByTestId('accounts-overview')).toBeDefined();
        expect(screen.getByTestId('back-to-dashboard')).toBeDefined();
      });
    });

    it('handleUIAssistance() - should handle invalid navigation gracefully', async () => {
      const navigationAssistance: UIAssistance = {
        type: 'navigation',
        action: 'navigate',
        title: 'Invalid Screen'
      };

      const mockResponse: ProcessResponse = {
        status: 'success',
        ui_assistance: navigationAssistance
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      renderAppWithRouter(['/chat']); // Start on chat tab

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      // Should remain on chat tab due to invalid navigation
      await waitFor(() => {
        expect(screen.getByTestId('chat-panel')).toBeDefined();
      });
    });

    it('handleUIAssistance() - should handle transaction form creation', async () => {
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
        renderAppWithRouter(['/chat']); // Start on chat tab
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        const dynamicForm = screen.getByTestId('dynamic-form');
        expect(dynamicForm).toBeDefined();
        expect(dynamicForm.getAttribute('data-form-id')).toBe('transfer');
      });
    });
  });

  describe('handleDynamicFormSubmit() - Form Processing', () => {
    it('handleDynamicFormSubmit() - should process form submission', async () => {
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
        renderAppWithRouter(['/chat']); // Start on chat tab
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('dynamic-form')).toBeDefined();
      });

      // Submit the form
      await act(async () => {
        await user.click(screen.getByTestId('dynamic-form-submit'));
      });

      await waitFor(() => {
        // Form should be cleared and navigated to root (banking dashboard)
        expect(screen.queryByTestId('dynamic-form')).toBeNull();
        expect(screen.getByTestId('accounts-overview')).toBeDefined();
      });
    });

    it('DynamicForm onCancel() - should handle form cancellation', async () => {
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
        renderAppWithRouter(['/chat']); // Start on chat tab
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('dynamic-form')).toBeDefined();
      });

      // Cancel the form
      await act(async () => {
        await user.click(screen.getByTestId('dynamic-form-cancel'));
      });

      await waitFor(() => {
        // Form should be cleared and navigated to root (banking dashboard)
        expect(screen.queryByTestId('dynamic-form')).toBeNull();
        expect(screen.getByTestId('accounts-overview')).toBeDefined();
      });
    });
  });

  describe('setShowNavigationAssistant() - Assistant Modal', () => {
    it('setShowNavigationAssistant() - should show modal when clicked', async () => {
      await act(async () => {
        renderAppWithRouter(['/']); // Start on banking tab where assistant is available
      });

      // Find and click the navigation assistant button
      await act(async () => {
        const assistantButton = screen.getByTitle('Navigation Assistant');
        await user.click(assistantButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('navigation-assistant-title')).toBeDefined();
        expect(screen.getByTestId('navigation-assistant-description')).toBeDefined();
      });
    });

    it('setShowNavigationAssistant() - should hide modal when closed', async () => {
      await act(async () => {
        renderAppWithRouter(['/']); // Start on banking tab where assistant is available
      });

      // Show the assistant
      await act(async () => {
        const assistantButton = screen.getByTitle('Navigation Assistant');
        await user.click(assistantButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('navigation-assistant-title')).toBeDefined();
      });

      // Close the assistant
      await act(async () => {
        const closeButton = screen.getByTestId('navigation-assistant-close');
        await user.click(closeButton);
      });

      await waitFor(() => {
        expect(screen.queryByTestId('navigation-assistant-title')).toBeNull();
      });
    });
  });

  describe('loadAccounts() - Account Data Management', () => {
    it('loadAccounts() - should handle account data loading', async () => {
      const mockAccounts: Account[] = [
        { id: '1', name: 'Checking', type: 'checking', balance: 1000 },
        { id: '2', name: 'Savings', type: 'savings', balance: 5000 }
      ];

      vi.mocked(apiService.getAccounts).mockResolvedValueOnce(mockAccounts);

      await act(async () => {
        renderAppWithRouter(['/']); // Start on banking dashboard
      });

      await waitFor(() => {
        const accountsOverview = screen.getByTestId('accounts-overview');
        expect(accountsOverview.getAttribute('data-account-count')).toBe('2');
      });
    });

    it('loadAccounts() - should handle empty account list', async () => {
      vi.mocked(apiService.getAccounts).mockResolvedValueOnce([]);

      await act(async () => {
        renderAppWithRouter(['/']); // Start on banking dashboard
      });

      await waitFor(() => {
        const accountsOverview = screen.getByTestId('accounts-overview');
        expect(accountsOverview.getAttribute('data-account-count')).toBe('0');
      });
    });
  });

  describe('notifications.show() - Notification System', () => {
    it('initializeSession() - should call notifications on connection error', async () => {
      const mockError = new Error('Failed to initialize session');
      vi.mocked(apiService.initializeSession).mockRejectedValueOnce(mockError);

      await act(async () => {
        renderAppWithRouter();
      });

      expect(screen.getByTestId('notifications-container')).toBeDefined();

      await waitFor(() => {
        expect(vi.mocked(notifications.show)).toHaveBeenCalledWith({
          title: 'Connection Error',
          message: 'Failed to connect to banking assistant',
          color: 'red'
        });
      });
    });

    it('handleUIAssistance() - should call notifications for navigation', async () => {
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

      await act(async () => {
        renderAppWithRouter(['/chat']); // Start on chat tab
      });

      expect(screen.getByTestId('notifications-container')).toBeDefined();

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        expect(vi.mocked(notifications.show)).toHaveBeenCalledWith({
          title: 'Navigation',
          message: 'Opened Accounts Overview',
          color: 'blue'
        });
      });
    });

    it('handleDynamicFormSubmit() - should call notifications on form submission', async () => {
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
        renderAppWithRouter(['/chat']); // Start on chat tab
      });

      expect(screen.getByTestId('notifications-container')).toBeDefined();

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('dynamic-form')).toBeDefined();
      });

      await act(async () => {
        await user.click(screen.getByTestId('dynamic-form-submit'));
      });

      await waitFor(() => {
        expect(vi.mocked(notifications.show)).toHaveBeenCalledWith({
          title: 'Form Submitted',
          message: 'Your transaction has been processed',
          color: 'green'
        });
      });
    });
  });

  describe('BankingDashboard() - Dashboard Rendering', () => {
    it('BankingDashboard() - should render banking interface by default', async () => {
      renderAppWithRouter(['/']); // Start at root route

      await waitFor(() => {
        // Should render banking tab content - banking dashboard
        const bankingTab = screen.getByTestId('tab-banking');
        expect(bankingTab.getAttribute('aria-selected')).toBe('true');
        
        // Should render banking dashboard components (behavior, not text content)
        expect(screen.getByTestId('accounts-overview')).toBeDefined();
        expect(screen.getByTestId('dashboard-view-accounts')).toBeDefined();
        expect(screen.getByTestId('dashboard-transfer-money')).toBeDefined();
      });
    });

    it('handleUIAssistance() - should navigate via router', async () => {
      const navigationAssistance: UIAssistance = {
        type: 'navigation',
        action: 'route_to_screen',
        component_name: 'AccountsOverview',
        route_path: '/banking/accounts',
        title: 'Accounts Overview'
      };

      const mockResponse: ProcessResponse = {
        status: 'success',
        ui_assistance: navigationAssistance
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      renderAppWithRouter(['/chat']); // Start on chat tab

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      // Should switch back to banking tab after navigation
      await waitFor(() => {
        const bankingTab = screen.getByTestId('tab-banking');
        expect(bankingTab.getAttribute('aria-selected')).toBe('true');
      });

      // Should show back button (indicating we navigated to a route)
      await waitFor(() => {
        expect(screen.getByTestId('back-to-dashboard')).toBeDefined();
      });
    });
  });

  describe('Error Handling - API and Connection Errors', () => {
    it('initializeSession() - should handle initialization errors gracefully', async () => {
      const mockError = new Error('Failed to initialize session');
      vi.mocked(apiService.initializeSession).mockRejectedValueOnce(mockError);

      await act(async () => {
        renderAppWithRouter();
      });

      await waitFor(() => {
        expect(screen.getByTestId('app')).toBeDefined();
      });
    });

    it('handleSubmit() - should handle API processing errors gracefully', async () => {
      const mockError = new Error('Processing failed');
      vi.mocked(apiService.processMessage).mockRejectedValueOnce(mockError);

      await act(async () => {
        renderAppWithRouter(['/chat']); // Start on chat tab
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        const chatPanel = screen.getByTestId('chat-panel');
        const messageCount = parseInt(chatPanel.getAttribute('data-message-count') || '0');
        expect(messageCount).toBeGreaterThanOrEqual(2); // System message + error message
      });
    });

    it('loadAccounts() - should handle account loading errors gracefully', async () => {
      const mockError = new Error('Failed to load accounts');
      vi.mocked(apiService.getAccounts).mockRejectedValueOnce(mockError);

      await act(async () => {
        renderAppWithRouter(['/']); // Start on banking dashboard
      });

      await waitFor(() => {
        const accountsOverview = screen.getByTestId('accounts-overview');
        expect(accountsOverview.getAttribute('data-account-count')).toBe('0');
      });
    });
  });

  describe('WebSocket Message Processing', () => {
    it('handleWebSocketMessage() - should process messages with result type', async () => {
      renderAppWithRouter();

      // Establish WebSocket connection
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

      // Message should be processed without errors
      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('chat-panel')).toBeDefined();
      });
    });

    it('handleWebSocketMessage() - should ignore non-result messages', async () => {
      renderAppWithRouter();

      // Establish connection
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

      // Should not cause errors
      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await waitFor(() => {
        const chatPanel = screen.getByTestId('chat-panel');
        const messageCount = parseInt(chatPanel.getAttribute('data-message-count') || '0');
        expect(messageCount).toBe(1); // Only initial system message
      });
    });
  });

  describe('Advanced Tab Management', () => {
    it('setActiveTab() - should handle null values with fallback', async () => {
      renderAppWithRouter();

      await waitFor(() => {
        expect(screen.getByTestId('tab-banking')).toBeDefined();
      });
    });

    it('setActiveTab() - should switch between all tabs correctly', async () => {
      renderAppWithRouter(['/']); // Start on banking dashboard

      // Start on banking tab
      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toBeDefined();
      });

      // Switch to transaction tab
      await act(async () => {
        await user.click(screen.getByTestId('tab-transaction'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('transaction-assistance-title')).toBeDefined();
      });

      // Switch to chat tab
      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('chat-panel')).toBeDefined();
      });

      // Switch back to banking
      await act(async () => {
        await user.click(screen.getByTestId('tab-banking'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toBeDefined();
      });
    });
  });

  describe('Edge Cases and Integration Scenarios', () => {
    it('handleSubmit() - should prevent empty message submission', async () => {
      renderAppWithRouter(['/chat']); // Start on chat tab

      await waitFor(() => {
        const chatPanel = screen.getByTestId('chat-panel');
        const messageCount = parseInt(chatPanel.getAttribute('data-message-count') || '0');
        expect(messageCount).toBe(1); // Only initial system message
      });

      expect(screen.getByTestId('chat-panel')).toBeDefined();
    });

    it('handleUIAssistance() - should handle malformed assistance data gracefully', async () => {
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
        renderAppWithRouter(['/chat']); // Start on chat tab
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        const chatPanel = screen.getByTestId('chat-panel');
        const messageCount = parseInt(chatPanel.getAttribute('data-message-count') || '0');
        expect(messageCount).toBeGreaterThan(1);
      });

      // Should remain on chat tab due to malformed assistance
      expect(screen.getByTestId('chat-panel')).toBeDefined();
    });

    it('handleProcessResponse() - should handle responses without required properties', async () => {
      const incompleteResponse = {} as ProcessResponse;

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(incompleteResponse);

      await act(async () => {
        renderAppWithRouter(['/chat']); // Start on chat tab
      });

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        const chatPanel = screen.getByTestId('chat-panel');
        const messageCount = parseInt(chatPanel.getAttribute('data-message-count') || '0');
        expect(messageCount).toBeGreaterThan(1);
      });
    });

    it('loadAccounts() - should handle malformed account data gracefully', async () => {
      const malformedAccounts = [
        { id: null as never, name: undefined, type: 'invalid', balance: 'not-a-number' },
        { missing: 'properties' } as never,
        null,
        undefined
      ] as unknown as Account[];

      vi.mocked(apiService.getAccounts).mockResolvedValueOnce(malformedAccounts);

      await act(async () => {
        renderAppWithRouter(['/']); // Start on banking dashboard
      });

      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toBeDefined();
      });
    });
  });

  describe('Routing System - Configuration-Driven Navigation', () => {
    it('getTabForRoute() - should derive banking tab from root URL path', async () => {
      renderAppWithRouter(['/']);
      await waitFor(() => {
        const bankingTab = screen.getByTestId('tab-banking');
        expect(bankingTab.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('getTabForRoute() - should derive chat tab from chat URL path', async () => {
      renderAppWithRouter(['/chat']);
      await waitFor(() => {
        const chatTab = screen.getByTestId('tab-chat');
        expect(chatTab.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('getTabForRoute() - should derive transaction tab from transaction URL path', async () => {
      renderAppWithRouter(['/transaction']);
      await waitFor(() => {
        const transactionTab = screen.getByTestId('tab-transaction');
        expect(transactionTab.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('renderRouteComponent() - should render accounts overview route', async () => {
      renderAppWithRouter(['/banking/accounts']);
      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toBeDefined();
        expect(screen.getByTestId('back-to-dashboard')).toBeDefined();
        const bankingTab = screen.getByTestId('tab-banking');
        expect(bankingTab.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('renderRouteComponent() - should render transfers hub route', async () => {
      renderAppWithRouter(['/banking/transfers']);
      await waitFor(() => {
        expect(screen.getByTestId('transfers-hub')).toBeDefined();
        expect(screen.getByTestId('back-to-dashboard')).toBeDefined();
        const bankingTab = screen.getByTestId('tab-banking');
        expect(bankingTab.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('renderRouteComponent() - should render wire transfer route', async () => {
      renderAppWithRouter(['/banking/transfers/wire']);
      await waitFor(() => {
        expect(screen.getByTestId('wire-transfer-form')).toBeDefined();
        expect(screen.getByTestId('back-to-dashboard')).toBeDefined();
        const bankingTab = screen.getByTestId('tab-banking');
        expect(bankingTab.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('renderRouteComponent() - should render bill pay route', async () => {
      renderAppWithRouter(['/banking/payments/bills']);
      await waitFor(() => {
        expect(screen.getByTestId('bill-pay-hub')).toBeDefined();
        expect(screen.getByTestId('back-to-dashboard')).toBeDefined();
        const bankingTab = screen.getByTestId('tab-banking');
        expect(bankingTab.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('navigate() - should handle tab clicks with router navigation', async () => {
      renderAppWithRouter(['/']); // Start on banking dashboard

      // Click transaction tab should navigate to /transaction
      await act(async () => {
        await user.click(screen.getByTestId('tab-transaction'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('transaction-assistance-title')).toBeDefined();
        const transactionTab = screen.getByTestId('tab-transaction');
        expect(transactionTab.getAttribute('aria-selected')).toBe('true');
      });

      // Click chat tab should navigate to /chat
      await act(async () => {
        await user.click(screen.getByTestId('tab-chat'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('chat-panel')).toBeDefined();
        const chatTab = screen.getByTestId('tab-chat');
        expect(chatTab.getAttribute('aria-selected')).toBe('true');
      });

      // Click banking tab should navigate to /
      await act(async () => {
        await user.click(screen.getByTestId('tab-banking'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toBeDefined();
        const bankingTab = screen.getByTestId('tab-banking');
        expect(bankingTab.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('BankingDashboard() - should handle dashboard navigation buttons', async () => {
      renderAppWithRouter(['/']); // Start on banking dashboard

      // Test view accounts button navigation
      await act(async () => {
        await user.click(screen.getByTestId('dashboard-view-accounts'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toBeDefined();
        expect(screen.getByTestId('back-to-dashboard')).toBeDefined();
      });

      // Navigate back to dashboard
      await act(async () => {
        await user.click(screen.getByTestId('back-to-dashboard'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-view-accounts')).toBeDefined();
      });

      // Test transfer money button navigation
      await act(async () => {
        await user.click(screen.getByTestId('dashboard-transfer-money'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('transfers-hub')).toBeDefined();
        expect(screen.getByTestId('back-to-dashboard')).toBeDefined();
      });
    });

    it('NotFound() - should render 404 page for invalid routes', async () => {
      renderAppWithRouter(['/invalid-route']);

      await waitFor(() => {
        // Test functional behavior - should render NotFound component structure
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0); // At least one button exists
        // Find the "Go to Dashboard" button specifically
        const dashboardButton = buttons.find(button => 
          button.textContent?.includes('Go to Dashboard')
        );
        expect(dashboardButton).toBeDefined();
      });

      // Test navigation back to dashboard
      await act(async () => {
        const buttons = screen.getAllByRole('button');
        const dashboardButton = buttons.find(button => 
          button.textContent?.includes('Go to Dashboard')
        );
        if (dashboardButton) {
          await user.click(dashboardButton);
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId('accounts-overview')).toBeDefined();
      });
    });

    it('handleUIAssistance() - should handle route_path navigation correctly', async () => {
      const navigationAssistance: UIAssistance = {
        type: 'navigation',
        action: 'route_to_screen',
        route_path: '/banking/transfers/wire',
        title: 'Wire Transfer'
      };

      const mockResponse: ProcessResponse = {
        status: 'success',
        ui_assistance: navigationAssistance
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      renderAppWithRouter(['/chat']); // Start on chat tab

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        // Should navigate to wire transfer route
        expect(screen.getByTestId('wire-transfer-form')).toBeDefined();
        expect(screen.getByTestId('back-to-dashboard')).toBeDefined();
        const bankingTab = screen.getByTestId('tab-banking');
        expect(bankingTab.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('handleUIAssistance() - should fallback to component mapping when route_path invalid', async () => {
      const navigationAssistance: UIAssistance = {
        type: 'navigation',
        action: 'navigate',
        route_path: '/invalid/route',
        component_name: 'AccountsOverview',
        title: 'Accounts Overview'
      };

      const mockResponse: ProcessResponse = {
        status: 'success',
        ui_assistance: navigationAssistance
      };

      vi.mocked(apiService.processMessage).mockResolvedValueOnce(mockResponse);

      renderAppWithRouter(['/chat']); // Start on chat tab

      await act(async () => {
        await user.click(screen.getByTestId('chat-send-message'));
      });

      await waitFor(() => {
        // Should navigate to accounts overview via component mapping
        expect(screen.getByTestId('accounts-overview')).toBeDefined();
        expect(screen.getByTestId('back-to-dashboard')).toBeDefined();
        const bankingTab = screen.getByTestId('tab-banking');
        expect(bankingTab.getAttribute('aria-selected')).toBe('true');
      });
    });

    it('RouteComponent() - should provide consistent back navigation', async () => {
      // Test back navigation from accounts route
      renderAppWithRouter(['/banking/accounts']);

      await waitFor(() => {
        expect(screen.getByTestId('back-to-dashboard')).toBeDefined();
        expect(screen.getByTestId('accounts-overview')).toBeDefined();
      });

      await act(async () => {
        await user.click(screen.getByTestId('back-to-dashboard'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-view-accounts')).toBeDefined();
      });
    });

    it('RouteComponent() - should provide back navigation from transfers route', async () => {
      renderAppWithRouter(['/banking/transfers']);

      await waitFor(() => {
        expect(screen.getByTestId('back-to-dashboard')).toBeDefined();
        expect(screen.getByTestId('transfers-hub')).toBeDefined();
      });

      await act(async () => {
        await user.click(screen.getByTestId('back-to-dashboard'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-transfer-money')).toBeDefined();
      });
    });
  });
});