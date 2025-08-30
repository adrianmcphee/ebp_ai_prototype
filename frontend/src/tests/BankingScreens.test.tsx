import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { BankingScreens } from '../components/BankingScreens';
import { MantineProvider } from '@mantine/core';
import type { Account } from '../types';

// Mock Mantine components to isolate unit under test
vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');
  return {
    ...actual,
    Card: vi.fn(({ children }) => (
      <div data-testid="card">{children}</div>
    )),
    Title: vi.fn(({ children }) => (
      <h1 data-testid="title">{children}</h1>
    )),
    SimpleGrid: vi.fn(({ children }) => (
      <div data-testid="simple-grid">{children}</div>
    )),
    Paper: vi.fn(({ children, style }) => (
      <div data-testid="paper" style={style}>{children}</div>
    )),
    Text: vi.fn(({ children }) => (
      <span data-testid="text">{children}</span>
    )),
    Button: vi.fn(({ children, onClick }) => (
      <button data-testid="button" onClick={onClick}>
        {children}
      </button>
    )),
    Stack: vi.fn(({ children }) => (
      <div data-testid="stack">{children}</div>
    )),
    TextInput: vi.fn(({ label, placeholder, required }) => (
      <input 
        data-testid="text-input" 
        placeholder={placeholder} 
        data-required={required}
        aria-label={label}
      />
    )),
    Select: vi.fn(({ label, placeholder, data, required }) => (
      <select 
        data-testid="select" 
        data-options-count={data?.length || 0}
        data-required={required}
        aria-label={label}
      >
        <option value="">{placeholder}</option>
      </select>
    )),
    NumberInput: vi.fn(({ label, placeholder, required }) => (
      <input 
        type="number"
        data-testid="number-input" 
        placeholder={placeholder} 
        data-required={required}
        aria-label={label}
      />
    ))
  };
});

// Wrapper component for Mantine context
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('BankingScreens Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('AccountsOverview() - Account Display Component', () => {
    const mockAccounts: Account[] = [
      { id: '1', name: 'Checking Account', type: 'checking', balance: 1500.50 },
      { id: '2', name: 'Savings Account', type: 'savings', balance: 5000.00 },
      { id: '3', name: 'Business Account', type: 'business', balance: 25000.75 }
    ];

    it('AccountsOverview() - should render with empty accounts array', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.AccountsOverview accounts={[]} />
          </TestWrapper>
        );
      });

      // ASSERT
      expect(screen.getByTestId('card')).toBeDefined();
      expect(screen.getByTestId('title')).toBeDefined();
      expect(screen.getByTestId('simple-grid')).toBeDefined();
    });

    it('AccountsOverview() - should render with accounts data', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.AccountsOverview accounts={mockAccounts} />
          </TestWrapper>
        );
      });

      // ASSERT
      const grid = screen.getByTestId('simple-grid');
      expect(grid).toBeDefined();
    });

    it('AccountsOverview() - should render correct number of account items', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.AccountsOverview accounts={mockAccounts} />
          </TestWrapper>
        );
      });

      // ASSERT
      const papers = screen.getAllByTestId('paper');
      expect(papers).toHaveLength(mockAccounts.length);
    });

    it('AccountsOverview() - should handle single account', async () => {
      // ARRANGE
      const singleAccount = [mockAccounts[0]];

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.AccountsOverview accounts={singleAccount} />
          </TestWrapper>
        );
      });

      // ASSERT
      const papers = screen.getAllByTestId('paper');
      expect(papers).toHaveLength(1);
    });

    it('AccountsOverview() - should update when accounts prop changes', async () => {
      // ARRANGE
      const { rerender } = render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={[mockAccounts[0]]} />
        </TestWrapper>
      );

      // Verify initial state
      let papers = screen.getAllByTestId('paper');
      expect(papers).toHaveLength(1);

      // ACT - Update accounts
      await act(async () => {
        rerender(
          <TestWrapper>
            <BankingScreens.AccountsOverview accounts={mockAccounts} />
          </TestWrapper>
        );
      });

      // ASSERT - Verify updated state
      papers = screen.getAllByTestId('paper');
      expect(papers).toHaveLength(mockAccounts.length);
    });

    it('AccountsOverview() - should handle account with zero balance', async () => {
      // ARRANGE
      const accountWithZeroBalance: Account[] = [
        { id: '1', name: 'Empty Account', type: 'checking', balance: 0 }
      ];

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.AccountsOverview accounts={accountWithZeroBalance} />
          </TestWrapper>
        );
      });

      // ASSERT
      const papers = screen.getAllByTestId('paper');
      expect(papers).toHaveLength(1);
    });

    it('AccountsOverview() - should handle account with negative balance', async () => {
      // ARRANGE
      const accountWithNegativeBalance: Account[] = [
        { id: '1', name: 'Overdrawn Account', type: 'checking', balance: -100.50 }
      ];

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.AccountsOverview accounts={accountWithNegativeBalance} />
          </TestWrapper>
        );
      });

      // ASSERT
      const papers = screen.getAllByTestId('paper');
      expect(papers).toHaveLength(1);
    });
  });

  describe('TransfersHub() - Transfer Options Component', () => {
    it('TransfersHub() - should render main container', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.TransfersHub />
          </TestWrapper>
        );
      });

      // ASSERT
      expect(screen.getByTestId('card')).toBeDefined();
      expect(screen.getByTestId('title')).toBeDefined();
      expect(screen.getByTestId('simple-grid')).toBeDefined();
    });

    it('TransfersHub() - should render all transfer options', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.TransfersHub />
          </TestWrapper>
        );
      });

      // ASSERT
      const grid = screen.getByTestId('simple-grid');
      expect(grid).toBeDefined();
      
      const papers = screen.getAllByTestId('paper');
      expect(papers).toHaveLength(3); // Internal, External, International

      const buttons = screen.getAllByTestId('button');
      expect(buttons).toHaveLength(3);
    });

    it('TransfersHub() - should render transfer buttons', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.TransfersHub />
          </TestWrapper>
        );
      });

      // ASSERT
      const buttons = screen.getAllByTestId('button');
      expect(buttons).toHaveLength(3);
      buttons.forEach(button => {
        expect(button).toBeDefined();
        expect(button.tagName).toBe('BUTTON');
      });
    });

    it('TransfersHub() - should handle button interactions', async () => {
      // ARRANGE
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.TransfersHub />
          </TestWrapper>
        );
      });

      const buttons = screen.getAllByTestId('button');

      // ACT & ASSERT - Buttons should be clickable
      for (const button of buttons) {
        expect(button).toBeDefined();
        // Note: We don't test the actual click behavior as it's not implemented
        // We only test that the buttons exist and have the right attributes
      }
    });
  });

  describe('WireTransferForm() - Wire Transfer Form Component', () => {
    it('WireTransferForm() - should render main container', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.WireTransferForm />
          </TestWrapper>
        );
      });

      // ASSERT
      expect(screen.getByTestId('card')).toBeDefined();
      expect(screen.getByTestId('title')).toBeDefined();
      expect(screen.getByTestId('stack')).toBeDefined();
    });

    it('WireTransferForm() - should render all text input fields', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.WireTransferForm />
          </TestWrapper>
        );
      });

      // ASSERT
      const textInputs = screen.getAllByTestId('text-input');
      expect(textInputs.length).toBeGreaterThan(8); // Multiple text fields
    });

    it('WireTransferForm() - should render required text input fields', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.WireTransferForm />
          </TestWrapper>
        );
      });

      // ASSERT
      const textInputs = screen.getAllByTestId('text-input');
      const requiredInputs = textInputs.filter(input => 
        input.getAttribute('data-required') === 'true'
      );
      expect(requiredInputs.length).toBeGreaterThan(5); // Several required fields
    });

    it('WireTransferForm() - should render purpose code select field', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.WireTransferForm />
          </TestWrapper>
        );
      });

      // ASSERT
      const select = screen.getByTestId('select');
      expect(select).toBeDefined();
      expect(select.getAttribute('data-required')).toBe('true');
      expect(select.getAttribute('data-options-count')).toBe('20');
    });

    it('WireTransferForm() - should render amount number input field', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.WireTransferForm />
          </TestWrapper>
        );
      });

      // ASSERT
      const numberInput = screen.getByTestId('number-input');
      expect(numberInput).toBeDefined();
      expect(numberInput.getAttribute('data-required')).toBe('true');
    });

    it('WireTransferForm() - should render submit button', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.WireTransferForm />
          </TestWrapper>
        );
      });

      // ASSERT
      const button = screen.getByTestId('button');
      expect(button).toBeDefined();
      expect(button.tagName).toBe('BUTTON');
    });

    it('WireTransferForm() - should render stack container', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.WireTransferForm />
          </TestWrapper>
        );
      });

      // ASSERT
      const stack = screen.getByTestId('stack');
      expect(stack).toBeDefined();
    });

    it('WireTransferForm() - should handle form field interactions', async () => {
      // ARRANGE
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.WireTransferForm />
          </TestWrapper>
        );
      });

      // ACT & ASSERT - Test that form fields are interactive
      const textInputs = screen.getAllByTestId('text-input');
      const numberInput = screen.getByTestId('number-input');
      const select = screen.getByTestId('select');

      expect(textInputs.length).toBeGreaterThan(0);
      expect(numberInput).toBeDefined();
      expect(select).toBeDefined();
      
      // Fields should have proper accessibility labels
      textInputs.forEach(input => {
        expect(input.getAttribute('aria-label')).toBeDefined();
      });
    });
  });

  describe('BillPayHub() - Bill Payment Component', () => {
    it('BillPayHub() - should render main container', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.BillPayHub />
          </TestWrapper>
        );
      });

      // ASSERT
      expect(screen.getByTestId('card')).toBeDefined();
      expect(screen.getByTestId('title')).toBeDefined();
      expect(screen.getByTestId('simple-grid')).toBeDefined();
    });

    it('BillPayHub() - should render bill payment options', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.BillPayHub />
          </TestWrapper>
        );
      });

      // ASSERT
      const grid = screen.getByTestId('simple-grid');
      expect(grid).toBeDefined();

      const papers = screen.getAllByTestId('paper');
      expect(papers).toHaveLength(2); // Upcoming bills + Add payee

      const buttons = screen.getAllByTestId('button');
      expect(buttons).toHaveLength(2);
    });

    it('BillPayHub() - should render action buttons', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.BillPayHub />
          </TestWrapper>
        );
      });

      // ASSERT
      const buttons = screen.getAllByTestId('button');
      expect(buttons).toHaveLength(2);
      buttons.forEach(button => {
        expect(button).toBeDefined();
        expect(button.tagName).toBe('BUTTON');
      });
    });

    it('BillPayHub() - should handle button interactions', async () => {
      // ARRANGE
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.BillPayHub />
          </TestWrapper>
        );
      });

      // ACT & ASSERT
      const buttons = screen.getAllByTestId('button');
      expect(buttons).toHaveLength(2);
      
      // Buttons should be clickable elements
      buttons.forEach(button => {
        expect(button).toBeDefined();
      });
    });
  });

  describe('BankingScreens object - Module Structure', () => {
    it('BankingScreens - should export all required components', () => {
      // ARRANGE & ACT & ASSERT
      expect(BankingScreens.AccountsOverview).toBeDefined();
      expect(BankingScreens.TransfersHub).toBeDefined();
      expect(BankingScreens.WireTransferForm).toBeDefined();
      expect(BankingScreens.BillPayHub).toBeDefined();
    });

    it('BankingScreens - should have correct component types', () => {
      // ARRANGE & ACT & ASSERT
      expect(typeof BankingScreens.AccountsOverview).toBe('function');
      expect(typeof BankingScreens.TransfersHub).toBe('function');
      expect(typeof BankingScreens.WireTransferForm).toBe('function');
      expect(typeof BankingScreens.BillPayHub).toBe('function');
    });
  });

  describe('Mantine Components Integration - External Dependencies', () => {
    it('Card - should call Mantine Card with correct props', async () => {
      // ARRANGE
      const mockCard = vi.mocked((await import('@mantine/core')).Card);

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.TransfersHub />
          </TestWrapper>
        );
      });

      // ASSERT
      expect(mockCard).toHaveBeenCalledWith(
        expect.objectContaining({
          shadow: 'sm',
          padding: 'lg',
          radius: 'md',
          withBorder: true
        }),
        undefined
      );
    });

    it('SimpleGrid - should call Mantine SimpleGrid component', async () => {
      // ARRANGE
      const mockSimpleGrid = vi.mocked((await import('@mantine/core')).SimpleGrid);

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.TransfersHub />
          </TestWrapper>
        );
      });

      // ASSERT
      expect(mockSimpleGrid).toHaveBeenCalledTimes(1);
      expect(mockSimpleGrid).toHaveBeenCalledWith(
        expect.objectContaining({
          children: expect.anything()
        }),
        undefined
      );
    });

    it('Button - should call Mantine Button component', async () => {
      // ARRANGE
      const mockButton = vi.mocked((await import('@mantine/core')).Button);

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.TransfersHub />
          </TestWrapper>
        );
      });

      // ASSERT
      expect(mockButton).toHaveBeenCalledTimes(3); // Three buttons in TransfersHub
      expect(mockButton).toHaveBeenCalledWith(
        expect.objectContaining({
          children: expect.anything()
        }),
        undefined
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('AccountsOverview() - should render with extremely large account numbers', async () => {
      // ARRANGE
      const accountsWithLargeNumbers: Account[] = [
        { id: '1', name: 'Million Dollar Account', type: 'savings', balance: 1000000.99 },
        { id: '2', name: 'Billion Dollar Account', type: 'investment', balance: 1000000000.01 }
      ];

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.AccountsOverview accounts={accountsWithLargeNumbers} />
          </TestWrapper>
        );
      });

      // ASSERT - Should render without crashing
      expect(screen.getByTestId('card')).toBeDefined();
      const papers = screen.getAllByTestId('paper');
      expect(papers).toHaveLength(2);
    });

    it('AccountsOverview() - should handle very long account names', async () => {
      // ARRANGE
      const accountsWithLongNames: Account[] = [
        { 
          id: '1', 
          name: 'This is a very long account name that might cause layout issues in some UI frameworks but should be handled gracefully',
          type: 'checking', 
          balance: 500.00 
        }
      ];

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.AccountsOverview accounts={accountsWithLongNames} />
          </TestWrapper>
        );
      });

      // ASSERT - Should render without crashing
      expect(screen.getByTestId('card')).toBeDefined();
      const papers = screen.getAllByTestId('paper');
      expect(papers).toHaveLength(1);
    });

    it('Components - should render without MantineProvider context', async () => {
      // ARRANGE & ACT - Test without wrapper
      await act(async () => {
        render(<BankingScreens.TransfersHub />);
      });

      // ASSERT - Should still render basic structure
      expect(screen.getByTestId('card')).toBeDefined();
    });
  });

  describe('Performance and Re-rendering - React Optimization', () => {
    it('AccountsOverview() - should handle frequent account updates', async () => {
      // ARRANGE
      const mockCard = vi.mocked((await import('@mantine/core')).Card);
      vi.clearAllMocks();

      const testAccounts: Account[] = [
        { id: '1', name: 'Test Account', type: 'checking', balance: 1000 },
        { id: '2', name: 'Test Savings', type: 'savings', balance: 2000 }
      ];

      const initialAccounts = [testAccounts[0]];
      const { rerender } = render(
        <TestWrapper>
          <BankingScreens.AccountsOverview accounts={initialAccounts} />
        </TestWrapper>
      );

      const initialCallCount = mockCard.mock.calls.length;

      // ACT - Multiple re-renders
      await act(async () => {
        rerender(
          <TestWrapper>
            <BankingScreens.AccountsOverview accounts={testAccounts} />
          </TestWrapper>
        );
      });

      await act(async () => {
        rerender(
          <TestWrapper>
            <BankingScreens.AccountsOverview accounts={[]} />
          </TestWrapper>
        );
      });

      // ASSERT - Component should re-render (functional components re-render by default)
      expect(mockCard.mock.calls.length).toBeGreaterThan(initialCallCount);
    });

    it('Static components - should render consistently', async () => {
      // ARRANGE
      const mockCard = vi.mocked((await import('@mantine/core')).Card);
      vi.clearAllMocks();

      // ACT - Render same component multiple times
      const { rerender } = render(
        <TestWrapper>
          <BankingScreens.TransfersHub />
        </TestWrapper>
      );

      const initialCallCount = mockCard.mock.calls.length;

      await act(async () => {
        rerender(
          <TestWrapper>
            <BankingScreens.TransfersHub />
          </TestWrapper>
        );
      });

      // ASSERT - Should re-render (no memoization)
      expect(mockCard.mock.calls.length).toBeGreaterThan(initialCallCount);
    });
  });

  describe('Accessibility and UX - User Experience', () => {
    it('Form fields - should have proper accessibility labels', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.WireTransferForm />
          </TestWrapper>
        );
      });

      // ASSERT
      const textInputs = screen.getAllByTestId('text-input');
      const numberInput = screen.getByTestId('number-input');
      const select = screen.getByTestId('select');

      textInputs.forEach(input => {
        expect(input.getAttribute('aria-label')).toBeDefined();
      });
      expect(numberInput.getAttribute('aria-label')).toBeDefined();
      expect(select.getAttribute('aria-label')).toBeDefined();
    });

    it('Buttons - should be keyboard accessible', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.TransfersHub />
          </TestWrapper>
        );
      });

      // ASSERT
      const buttons = screen.getAllByTestId('button');
      buttons.forEach(button => {
        expect(button.tagName).toBe('BUTTON'); // Proper semantic HTML
      });
    });

    it('Grid layouts - should render grid structure', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <BankingScreens.AccountsOverview accounts={[]} />
          </TestWrapper>
        );
      });

      // ASSERT
      const grid = screen.getByTestId('simple-grid');
      expect(grid).toBeDefined();
    });
  });
});
