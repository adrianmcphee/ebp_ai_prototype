import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { BankingScreens } from '../components/BankingScreens';
import type { Account } from '../types';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider>
    <MemoryRouter>
      {children}
    </MemoryRouter>
  </MantineProvider>
);

describe('AccountsOverview Component', () => {
  const mockAccounts: Account[] = [
    {
      id: '123',
      name: 'Primary Checking',
      type: 'Checking',
      balance: 5420.75,
      currency: 'USD'
    },
    {
      id: '456',
      name: 'Savings Account',
      type: 'Savings',
      balance: 15000.00,
      currency: 'USD'
    },
    {
      id: '789',
      name: 'Credit Card',
      type: 'Credit',
      balance: -1250.50,
      currency: 'USD'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render the accounts overview title', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      expect(screen.getByText('Your Accounts')).toBeInTheDocument();
    });

    it('should render all accounts', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      expect(screen.getByText('Primary Checking')).toBeInTheDocument();
      expect(screen.getByText('Savings Account')).toBeInTheDocument();
      expect(screen.getByText('Credit Card')).toBeInTheDocument();
    });

    it('should display account types', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      expect(screen.getByText('Checking')).toBeInTheDocument();
      expect(screen.getByText('Savings')).toBeInTheDocument();
      expect(screen.getByText('Credit')).toBeInTheDocument();
    });

    it('should display formatted balances', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      expect(screen.getByText('$5420.75')).toBeInTheDocument();
      expect(screen.getByText('$15000.00')).toBeInTheDocument();
      expect(screen.getByText('$-1250.50')).toBeInTheDocument();
    });

    it('should show click hints on all accounts', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      const clickHints = screen.getAllByText('Click to view details');
      expect(clickHints).toHaveLength(3);
    });
  });

  describe('Navigation', () => {
    it('should navigate to account details when account is clicked', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      const checkingAccount = screen.getByTestId('account-123');
      fireEvent.click(checkingAccount);

      expect(mockNavigate).toHaveBeenCalledWith('/banking/accounts/123');
    });

    it('should navigate to correct account detail for different accounts', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      const savingsAccount = screen.getByTestId('account-456');
      fireEvent.click(savingsAccount);

      expect(mockNavigate).toHaveBeenCalledWith('/banking/accounts/456');
    });

    it('should navigate to credit account details', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      const creditAccount = screen.getByTestId('account-789');
      fireEvent.click(creditAccount);

      expect(mockNavigate).toHaveBeenCalledWith('/banking/accounts/789');
    });
  });

  describe('Interactive Behavior', () => {
    it('should have cursor pointer style on accounts', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      const checkingAccount = screen.getByTestId('account-123');
      expect(checkingAccount).toHaveStyle({ cursor: 'pointer' });
    });

    it('should have proper test ids for all accounts', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      expect(screen.getByTestId('account-123')).toBeInTheDocument();
      expect(screen.getByTestId('account-456')).toBeInTheDocument();
      expect(screen.getByTestId('account-789')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('should handle empty accounts array', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={[]} />
        </TestWrapper>
      );

      expect(screen.getByText('Your Accounts')).toBeInTheDocument();
      expect(screen.queryByText('Primary Checking')).not.toBeInTheDocument();
    });
  });

  describe('Hover Effects', () => {
    it('should apply hover styles on mouse enter', async () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      const checkingAccount = screen.getByTestId('account-123');
      
      fireEvent.mouseEnter(checkingAccount);
      
      await waitFor(() => {
        expect(checkingAccount).toHaveStyle({ 
          backgroundColor: 'var(--mantine-color-gray-0)',
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
        });
      });
    });

    it('should remove hover styles on mouse leave', async () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      const checkingAccount = screen.getByTestId('account-123');
      
      fireEvent.mouseEnter(checkingAccount);
      fireEvent.mouseLeave(checkingAccount);
      
      await waitFor(() => {
        expect(checkingAccount).toHaveStyle({ 
          backgroundColor: '',
          transform: '',
          boxShadow: ''
        });
      });
    });
  });

  describe('Grid Layout', () => {
    it('should render accounts in a grid layout', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      const grid = screen.getByTestId('accounts-grid');
      expect(grid).toHaveClass('mantine-SimpleGrid-root');
    });

    it('should have proper spacing between account cards', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      const accountCards = screen.getAllByTestId(/^account-/);
      expect(accountCards).toHaveLength(3);
      
      accountCards.forEach(card => {
        expect(card).toHaveClass('mantine-Paper-root');
      });
    });
  });

  describe('Accessibility', () => {
    it('should render account cards with proper test ids', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      expect(screen.getByTestId('account-123')).toBeInTheDocument();
      expect(screen.getByTestId('account-456')).toBeInTheDocument();
      expect(screen.getByTestId('account-789')).toBeInTheDocument();
    });
  });

  describe('Visual Indicators', () => {
    it('should display account balance with proper styling', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      const balanceElements = screen.getAllByText(/\$[\d,.-]+/);
      expect(balanceElements).toHaveLength(3);
      
      balanceElements.forEach(element => {
        expect(element).toHaveClass('mantine-Text-root');
      });
    });

    it('should show negative balance for credit accounts', () => {
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={mockAccounts} />
        </TestWrapper>
      );

      expect(screen.getByText('$-1250.50')).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should render correctly with different account counts', () => {
      const singleAccount = [mockAccounts[0]];
      
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={singleAccount} />
        </TestWrapper>
      );

      expect(screen.getByTestId('account-123')).toBeInTheDocument();
      expect(screen.queryByTestId('account-456')).not.toBeInTheDocument();
    });
  });

  describe('Data Integrity', () => {
    it('should handle missing or undefined data gracefully', () => {
      const incompleteAccount = {
        id: '999',
        name: '',
        type: '',
        balance: 0
      };

      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={[incompleteAccount]} />
        </TestWrapper>
      );

      expect(screen.getByTestId('account-999')).toBeInTheDocument();
      expect(screen.getByText('$0.00')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should handle large numbers of accounts efficiently', () => {
      const manyAccounts = Array.from({ length: 50 }, (_, i) => ({
        id: `${i + 1000}`,
        name: `Account ${i + 1}`,
        type: i % 3 === 0 ? 'Checking' : i % 3 === 1 ? 'Savings' : 'Credit',
        balance: Math.random() * 10000
      }));

      const renderStart = performance.now();
      render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={manyAccounts} />
        </TestWrapper>
      );
      const renderEnd = performance.now();

      // Should render in reasonable time (less than 100ms)
      expect(renderEnd - renderStart).toBeLessThan(100);
      
      // Should render all accounts
      expect(screen.getAllByTestId(/^account-/)).toHaveLength(50);
    });
  });
});
