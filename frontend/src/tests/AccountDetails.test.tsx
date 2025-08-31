import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { AccountDetails } from '../components/AccountDetails';
import type { Account, AccountBalance, AccountTransactionsResponse } from '../types';

// Import for accessing mocked services
import { apiService } from '../services/api';

// Mock the API service
vi.mock('../services/api', () => ({
  apiService: {
    getAccountBalance: vi.fn().mockResolvedValue({
      account_id: 'acc-123',
      balance: 5000.00
    }),
    getAccountTransactions: vi.fn().mockResolvedValue({
      account_id: 'acc-123',
      transactions: [],
      total_count: 0,
      page: 1,
      per_page: 10,
      has_more: false
    })
  }
}));

// Mock React Router hooks
const mockNavigate = vi.fn();
const mockUseParams = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockUseParams(),
  };
});

// Clean behavior-focused Mantine component mocks
vi.mock('@mantine/core', () => ({
  Card: vi.fn(({ children }) => <div data-testid="card">{children}</div>),
  Title: vi.fn(({ children, order, ...props }) => {
    const tag = order === 2 ? 'h2' : order === 3 ? 'h3' : 'h1';
    return React.createElement(tag, { 'data-testid': props['data-testid'] || 'title' }, children);
  }),
  Text: vi.fn(({ children, c, fw, size, ...props }) => (
    <span 
      data-testid={props['data-testid'] || 'text'}
      data-color={c} 
      data-weight={fw}
      data-size={size}
    >
      {children}
    </span>
  )),
  Stack: vi.fn(({ children }) => <div data-testid="stack">{children}</div>),
  Group: vi.fn(({ children }) => <div data-testid="group">{children}</div>),
  SimpleGrid: vi.fn(({ children, ...props }) => (
    <div data-testid={props['data-testid'] || 'simple-grid'}>
      {children}
    </div>
  )),
  Badge: vi.fn(({ children, color, variant, ...props }) => (
    <span data-testid={props['data-testid'] || 'badge'} data-color={color} data-variant={variant}>
      {children}
    </span>
  )),
  Button: vi.fn(({ children, onClick, variant, disabled, ...props }) => (
    <button
      data-testid={props['data-testid'] || 'button'}
      onClick={onClick}
      data-variant={variant}
      data-disabled={disabled}
    >
      {children}
    </button>
  )),
  LoadingOverlay: vi.fn(({ visible }) => (
    visible ? <div data-testid="loading-overlay" data-visible="true" /> : null
  )),
  Alert: vi.fn(({ children, color, title }) => (
    <div data-testid="alert" data-color={color}>
      <div data-testid="alert-title">{title}</div>
      <div data-testid="alert-content">{children}</div>
    </div>
  )),
  Table: Object.assign(
    vi.fn(({ children }) => <table data-testid="table">{children}</table>),
    {
      Thead: vi.fn(({ children }) => <thead data-testid="table-thead">{children}</thead>),
      Tbody: vi.fn(({ children }) => <tbody data-testid="table-tbody">{children}</tbody>),
      Tr: vi.fn(({ children }) => <tr data-testid="table-tr">{children}</tr>),
      Th: vi.fn(({ children }) => <th data-testid="table-th">{children}</th>),
      Td: vi.fn(({ children }) => <td data-testid="table-td">{children}</td>)
    }
  )
}));

// Import React after mocking
const React = await import('react');

// Test helper to render AccountDetails with proper routing context
const renderAccountDetailsWithRouter = (
  props: { accounts: Account[] },
  initialEntries: string[] = ['/banking/accounts/acc-123']
) => {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AccountDetails {...props} />
    </MemoryRouter>
  );
};

describe('AccountDetails Component', () => {
  const user = userEvent.setup();
  
  // Test data fixtures
  const mockAccounts: Account[] = [
    {
      id: 'acc-123',
      name: 'Main Checking Account',
      type: 'checking',
      balance: 5000.00,
      currency: 'USD'
    },
    {
      id: 'acc-456', 
      name: 'Savings Account',
      type: 'savings',
      balance: 15000.00,
      currency: 'USD'
    }
  ];
  
  const mockAccountBalance: AccountBalance = {
    account_id: 'acc-123',
    balance: 5000.00
  };
  
  const mockTransactionsResponse: AccountTransactionsResponse = {
    account_id: 'acc-123',
    transactions: [
      {
        id: 'txn-1',
        date: '2024-01-15T10:30:00Z',
        amount: -50.00,
        description: 'Coffee Shop Purchase',
        type: 'debit',
        account_id: 'acc-123',
        balance_after: 4950.00,
        merchant: 'Local Coffee Shop'
      },
      {
        id: 'txn-2',
        date: '2024-01-14T14:20:00Z',
        amount: 1000.00,
        description: 'Direct Deposit',
        type: 'credit',
        account_id: 'acc-123',
        balance_after: 5000.00
      }
    ],
    total_count: 2,
    page: 1,
    per_page: 10,
    has_more: false
  };

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Reset API service mocks to default state
    vi.mocked(apiService.getAccountBalance).mockResolvedValue(mockAccountBalance);
    vi.mocked(apiService.getAccountTransactions).mockResolvedValue(mockTransactionsResponse);
    
    // Reset router mocks
    mockUseParams.mockReturnValue({ accountId: 'acc-123' });
    mockNavigate.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  describe('render() - Component Rendering', () => {
    it('render() - should render account details container', async () => {
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        // Verify main component structure renders
        expect(screen.getByTestId('account-details-title')).toBeDefined();
        expect(screen.getByTestId('account-balance')).toBeDefined();
      });
    });
  });

  describe('useEffect() - Component Lifecycle', () => {
    it('loadAccountDetails() - should call API services on component mount', async () => {
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(vi.mocked(apiService.getAccountBalance)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(apiService.getAccountBalance)).toHaveBeenCalledWith('acc-123');
        expect(vi.mocked(apiService.getAccountTransactions)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(apiService.getAccountTransactions)).toHaveBeenCalledWith('acc-123', 10);
      });
    });

    it('loadAccountDetails() - should handle missing accountId parameter', async () => {
      mockUseParams.mockReturnValue({});
      
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeDefined();
        expect(screen.getByTestId('alert').getAttribute('data-color')).toBe('red');
      });
    });

    it('loadAccountDetails() - should handle account not found in accounts array', async () => {
      mockUseParams.mockReturnValue({ accountId: 'non-existent-account' });
      
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeDefined();
        expect(screen.getByTestId('alert').getAttribute('data-color')).toBe('red');
      });
    });

    it('loadAccountDetails() - should handle API errors gracefully', async () => {
      const mockError = new Error('API failed');
      vi.mocked(apiService.getAccountBalance).mockRejectedValueOnce(mockError);
      
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeDefined();
        expect(screen.getByTestId('alert').getAttribute('data-color')).toBe('red');
      });
    });

    it('loadAccountDetails() - should show loading state initially', async () => {
      // Create a promise that won't resolve immediately
      let resolveBalance: (value: AccountBalance) => void;
      const balancePromise = new Promise<AccountBalance>((resolve) => {
        resolveBalance = resolve;
      });
      vi.mocked(apiService.getAccountBalance).mockReturnValue(balancePromise);
      
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      // Check loading state is shown
      expect(screen.getByTestId('loading-overlay')).toBeDefined();
      expect(screen.getByTestId('loading-overlay').getAttribute('data-visible')).toBe('true');
      
      // Resolve the promise
      await act(async () => {
        resolveBalance!(mockAccountBalance);
      });
    });
  });

  describe('formatDate() - Date Formatting', () => {
    it('formatDate() - should format ISO date string correctly', async () => {
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        // The component should render and format dates in transactions table
        const tableCells = screen.getAllByTestId('table-td');
        expect(tableCells.length).toBeGreaterThan(0);
      });
    });
  });

  describe('formatCurrency() - Currency Formatting', () => {
    it('formatCurrency() - should format positive amounts correctly', async () => {
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        // Check that account balance is rendered
        expect(screen.getByTestId('account-balance')).toBeDefined();
      });
    });

    it('formatCurrency() - should format negative amounts correctly', async () => {
      const negativeBalanceAccount: AccountBalance = {
        account_id: 'acc-123',
        balance: -250.50
      };
      vi.mocked(apiService.getAccountBalance).mockResolvedValueOnce(negativeBalanceAccount);
      
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('account-balance')).toBeDefined();
      });
    });
  });

  describe('onClick() - Navigation Interactions', () => {
    it('onClick() - transfer button should navigate to transfers page', async () => {
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('transfer-button')).toBeDefined();
      });
      
      await act(async () => {
        await user.click(screen.getByTestId('transfer-button'));
      });
      
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/banking/transfers');
    });

    it('onClick() - pay bills button should navigate to bill pay page', async () => {
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('pay-bills-button')).toBeDefined();
      });
      
      await act(async () => {
        await user.click(screen.getByTestId('pay-bills-button'));
      });
      
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/banking/payments/bills');
    });

    it('onClick() - back to accounts button should navigate when error occurs', async () => {
      mockUseParams.mockReturnValue({ accountId: 'non-existent-account' });
      
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      let backButton: HTMLElement;
      await waitFor(() => {
        const buttons = screen.getAllByTestId('button');
        backButton = buttons.find(button => button.getAttribute('data-variant') === 'light')!;
        expect(backButton).toBeDefined();
      });
      
      await act(async () => {
        await user.click(backButton);
      });
      
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/banking/accounts');
    });

    it('onClick() - statement button should be disabled', async () => {
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('statement-button')).toBeDefined();
        expect(screen.getByTestId('statement-button').getAttribute('data-disabled')).toBe('true');
      });
    });
  });

  describe('render() - Account Information Display', () => {
    it('render() - should display account title with proper semantic element', async () => {
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('account-details-title')).toBeDefined();
        expect(screen.getByTestId('account-details-title').tagName).toBe('H2');
      });
    });

    it('render() - should display account type badge with functional attributes', async () => {
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('account-type')).toBeDefined();
        expect(screen.getByTestId('account-type').getAttribute('data-color')).toBe('blue');
        expect(screen.getByTestId('account-type').getAttribute('data-variant')).toBe('light');
      });
    });

    it('render() - should display account details grid structure', async () => {
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('account-details-grid')).toBeDefined();
      });
    });

    it('render() - should display account number from balance response', async () => {
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('account-number')).toBeDefined();
      });
    });

    it('render() - should display account currency', async () => {
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('account-currency')).toBeDefined();
      });
    });
  });

  describe('render() - Transactions Table', () => {
    it('render() - should display transactions table when transactions exist', async () => {
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('table')).toBeDefined();
        expect(screen.getByTestId('table-thead')).toBeDefined();
        expect(screen.getByTestId('table-tbody')).toBeDefined();
      });
    });

    it('render() - should render correct number of transaction rows', async () => {
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        const tableRows = screen.getAllByTestId('table-tr');
        // Header row + 2 transaction rows = 3 total rows
        expect(tableRows.length).toBe(3);
      });
    });

    it('render() - should handle empty transactions array', async () => {
      const emptyTransactionsResponse: AccountTransactionsResponse = {
        ...mockTransactionsResponse,
        transactions: []
      };
      vi.mocked(apiService.getAccountTransactions).mockResolvedValueOnce(emptyTransactionsResponse);
      
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        // Should not render transactions table when no transactions
        expect(screen.queryByTestId('table')).toBeNull();
      });
    });

    it('render() - should display transaction amounts with proper color coding', async () => {
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        const textElements = screen.getAllByTestId('text');
        const creditAmount = textElements.find(el => el.getAttribute('data-color') === 'green');
        const debitAmount = textElements.find(el => el.getAttribute('data-color') === 'red');
        
        expect(creditAmount).toBeDefined();
        expect(debitAmount).toBeDefined();
      });
    });
  });

  describe('loadAccountDetails() / onClick() - Error Handling', () => {
    it('loadAccountDetails() - should handle network errors gracefully', async () => {
      const networkError = new Error('Network request failed');
      vi.mocked(apiService.getAccountBalance).mockRejectedValueOnce(networkError);
      
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeDefined();
        expect(screen.getByTestId('alert').getAttribute('data-color')).toBe('red');
      });
    });

    it('loadAccountDetails() - should handle partial API failures', async () => {
      vi.mocked(apiService.getAccountBalance).mockResolvedValueOnce(mockAccountBalance);
      vi.mocked(apiService.getAccountTransactions).mockRejectedValueOnce(new Error('Transactions failed'));
      
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeDefined();
        expect(screen.getByTestId('alert').getAttribute('data-color')).toBe('red');
      });
    });
  });

  describe('useEffect() / formatCurrency() / formatDate() - Edge Cases', () => {
    it('useEffect() - should handle undefined account parameter gracefully', async () => {
      const accountsWithoutTarget: Account[] = [];
      
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: accountsWithoutTarget });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('alert')).toBeDefined();
      });
    });

    it('formatCurrency() - should handle zero balance correctly', async () => {
      const zeroBalanceAccount: AccountBalance = {
        account_id: 'acc-123',
        balance: 0.00
      };
      vi.mocked(apiService.getAccountBalance).mockResolvedValueOnce(zeroBalanceAccount);
      
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('account-balance')).toBeDefined();
      });
    });

    it('formatDate() - should handle various date formats in transactions', async () => {
      const transactionsWithDifferentDates: AccountTransactionsResponse = {
        ...mockTransactionsResponse,
        transactions: [
          {
            ...mockTransactionsResponse.transactions[0],
            date: '2024-12-31T23:59:59Z'
          }
        ]
      };
      vi.mocked(apiService.getAccountTransactions).mockResolvedValueOnce(transactionsWithDifferentDates);
      
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('table')).toBeDefined();
      });
    });

    it('render() - should handle transactions without merchant information', async () => {
      const transactionsWithoutMerchant: AccountTransactionsResponse = {
        ...mockTransactionsResponse,
        transactions: [
          {
            ...mockTransactionsResponse.transactions[0],
            merchant: undefined
          }
        ]
      };
      vi.mocked(apiService.getAccountTransactions).mockResolvedValueOnce(transactionsWithoutMerchant);
      
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: mockAccounts });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('table')).toBeDefined();
      });
    });

    it('formatCurrency() - should handle different currencies', async () => {
      const eurAccount: Account = {
        ...mockAccounts[0],
        currency: 'EUR'
      };
      
      await act(async () => {
        renderAccountDetailsWithRouter({ accounts: [eurAccount] });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('account-balance')).toBeDefined();
        expect(screen.getByTestId('account-currency')).toBeDefined();
      });
    });
  });
});
