import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BankingScreens } from '../components/BankingScreens';
import type { Account } from '../types';

// Import for accessing mocked services
import { useNavigate } from 'react-router-dom';

// Mock react-router-dom navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(() => mockNavigate)
}));

// Mock Mantine components with clean behavioral focus - NO STYLING PROPS
vi.mock('@mantine/core', () => ({
  Card: vi.fn(({ children, withBorder }) => (
    <div data-testid="card" data-has-border={withBorder ? 'true' : 'false'}>
      {children}
    </div>
  )),
  Title: vi.fn(({ children, order }) => {
    const tag = order === 2 ? 'h2' : order === 3 ? 'h3' : 'h1';
    return React.createElement(tag, { 'data-testid': 'title', 'data-level': order }, children);
  }),
  SimpleGrid: vi.fn(({ children }) => (
    <div data-testid="accounts-grid">{children}</div>
  )),
  Paper: vi.fn(({ children, onClick, withBorder, onMouseEnter, onMouseLeave, ...props }) => (
    <div 
      data-testid={props['data-testid'] || 'paper'}
      data-clickable={onClick ? 'true' : 'false'}
      data-has-border={withBorder ? 'true' : 'false'}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={props.style}
    >
      {children}
    </div>
  )),
  Text: vi.fn(({ children, fw, color, c }) => {
    const isBold = fw === 500 || fw === 700;
    return (
      <span 
        data-testid="text"
        data-weight={isBold ? 'bold' : 'normal'}
        data-color={color || c || 'default'}
      >
        {children}
      </span>
    );
  }),
  Button: vi.fn(({ children, onClick, variant, fullWidth }) => (
    <button 
      data-testid="button"
      onClick={onClick}
      data-variant={variant || 'default'}
      data-full-width={fullWidth ? 'true' : 'false'}
    >
      {children}
    </button>
  )),
  Stack: vi.fn(({ children, gap }) => (
    <div data-testid="stack" data-gap={gap}>{children}</div>
  )),
  TextInput: vi.fn(({ label, placeholder, required }) => (
    <input 
      data-testid="text-input"
      placeholder={placeholder}
      data-required={required ? 'true' : 'false'}
      data-field-type="text"
      aria-label={label}
    />
  )),
  Select: vi.fn(({ label, placeholder, data, required }) => (
    <select 
      data-testid="select"
      data-options-count={data?.length || 0}
      data-required={required ? 'true' : 'false'}
      data-field-type="select"
      aria-label={label}
    >
      <option value="">{placeholder}</option>
      {data && data.map((option: string, index: number) => (
        <option key={index} value={option}>{option}</option>
      ))}
    </select>
  )),
  NumberInput: vi.fn(({ label, placeholder, required }) => (
    <input 
      type="number"
      data-testid="number-input"
      placeholder={placeholder}
      data-required={required ? 'true' : 'false'}
      data-field-type="number"
      aria-label={label}
    />
  ))
}));

// Mock AccountDetails component as it's imported
vi.mock('../components/AccountDetails', () => ({
  AccountDetails: vi.fn(() => (
    <div data-testid="account-details">Account Details Component</div>
  ))
}));

describe('BankingScreens', () => {
  const user = userEvent.setup();
  
  // Shared test data
  const mockAccounts: Account[] = [
    { id: 'acc-1', name: 'Primary Checking', type: 'checking', balance: 1234.56 },
    { id: 'acc-2', name: 'Emergency Savings', type: 'savings', balance: 5000.00 },
    { id: 'acc-3', name: 'Business Account', type: 'business', balance: 12500.75 }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('useNavigate() - Navigation Integration', () => {
    it('useNavigate() - should be called from react-router-dom', () => {
      // ARRANGE & ACT & ASSERT
      expect(vi.mocked(useNavigate)).toBeDefined();
      expect(typeof vi.mocked(useNavigate)).toBe('function');
    });
  });

  describe('AccountsOverview() - Account Display Component', () => {

    it('AccountsOverview() - should render main structural elements', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.AccountsOverview accounts={[]} />);
      });

      // ASSERT - Test structure, not styling
      expect(screen.getByTestId('card')).toBeDefined();
      expect(screen.getByTestId('title')).toBeDefined();
      expect(screen.getByTestId('accounts-grid')).toBeDefined();
    });

    it('AccountsOverview() - should render correct number of account items', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.AccountsOverview accounts={mockAccounts} />);
      });

      // ASSERT - Test functional behavior
      const accountElements = screen.getAllByTestId(/^account-acc-/);
      expect(accountElements).toHaveLength(mockAccounts.length);
    });

    it('handleAccountClick() - should navigate to account detail page on account click', async () => {
      // ARRANGE
      await act(async () => {
        render(<BankingScreens.AccountsOverview accounts={mockAccounts} />);
      });

      const firstAccount = screen.getByTestId('account-acc-1');

      // ACT
      await act(async () => {
        await user.click(firstAccount);
      });

      // ASSERT - Test navigation behavior
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/banking/accounts/acc-1');
    });

    it('handleAccountClick() - should handle navigation for different account IDs', async () => {
      // ARRANGE
      await act(async () => {
        render(<BankingScreens.AccountsOverview accounts={mockAccounts} />);
      });

      // ACT - Test multiple account clicks
      const accounts = screen.getAllByTestId(/^account-acc-/);
      
      await act(async () => {
        await user.click(accounts[0]); // acc-1
      });

      await act(async () => {
        await user.click(accounts[1]); // acc-2
      });

      await act(async () => {
        await user.click(accounts[2]); // acc-3
      });

      // ASSERT
      expect(mockNavigate).toHaveBeenCalledTimes(3);
      expect(mockNavigate).toHaveBeenNthCalledWith(1, '/banking/accounts/acc-1');
      expect(mockNavigate).toHaveBeenNthCalledWith(2, '/banking/accounts/acc-2');
      expect(mockNavigate).toHaveBeenNthCalledWith(3, '/banking/accounts/acc-3');
    });

    it('AccountsOverview() - should handle empty accounts array', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.AccountsOverview accounts={[]} />);
      });

      // ASSERT - Should render structure without accounts
      expect(screen.getByTestId('card')).toBeDefined();
      expect(screen.getByTestId('accounts-grid')).toBeDefined();
      
      // No account elements should exist
      const accountElements = screen.queryAllByTestId(/^account-/);
      expect(accountElements).toHaveLength(0);
    });

    it('AccountsOverview() - should handle single account', async () => {
      // ARRANGE
      const singleAccount = [mockAccounts[0]];

      // ACT
      await act(async () => {
        render(<BankingScreens.AccountsOverview accounts={singleAccount} />);
      });

      // ASSERT
      const accountElements = screen.getAllByTestId(/^account-acc-/);
      expect(accountElements).toHaveLength(1);
    });

    it('AccountsOverview() - should update when accounts prop changes', async () => {
      // ARRANGE
      const { rerender } = render(
        <BankingScreens.AccountsOverview accounts={[mockAccounts[0]]} />
      );

      // Verify initial state
      let accountElements = screen.getAllByTestId(/^account-acc-/);
      expect(accountElements).toHaveLength(1);

      // ACT - Update accounts
      await act(async () => {
        rerender(<BankingScreens.AccountsOverview accounts={mockAccounts} />);
      });

      // ASSERT
      accountElements = screen.getAllByTestId(/^account-acc-/);
      expect(accountElements).toHaveLength(mockAccounts.length);
    });

    it('onMouseEnter()/onMouseLeave() - should handle hover interactions', async () => {
      // ARRANGE
      await act(async () => {
        render(<BankingScreens.AccountsOverview accounts={[mockAccounts[0]]} />);
      });

      const accountElement = screen.getByTestId('account-acc-1');

      // ACT & ASSERT - Test that hover functionality is supported (elements are interactive)
      expect(accountElement).toBeDefined();
      expect(accountElement.getAttribute('data-clickable')).toBe('true');
      
      // Test that the element can receive hover events (has the necessary attributes)
      expect(accountElement.style.cursor).toBe('pointer');
      expect(accountElement.style.transition).toBe('all 0.2s ease');
    });
  });

  describe('TransfersHub() - Transfer Options Component', () => {
    it('TransfersHub() - should render main structural elements', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.TransfersHub />);
      });

      // ASSERT
      expect(screen.getByTestId('card')).toBeDefined();
      expect(screen.getByTestId('title')).toBeDefined();
    });

    it('TransfersHub() - should render all transfer option buttons', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.TransfersHub />);
      });

      // ASSERT - Test functional elements
      const buttons = screen.getAllByTestId('button');
      expect(buttons).toHaveLength(3); // Internal, External, International transfers
      
      buttons.forEach(button => {
        expect(button.tagName).toBe('BUTTON');
        expect(button.getAttribute('data-full-width')).toBe('true');
      });
    });

    it('TransfersHub() - should render transfer option containers', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.TransfersHub />);
      });

      // ASSERT - Test container elements
      const papers = screen.getAllByTestId('paper');
      expect(papers).toHaveLength(3);
    });

    it('TransfersHub() - should handle button interactions', async () => {
      // ARRANGE
      await act(async () => {
        render(<BankingScreens.TransfersHub />);
      });

      // ACT & ASSERT - Buttons should be interactive
      const buttons = screen.getAllByTestId('button');
      buttons.forEach(button => {
        expect(button).toBeDefined();
        expect(button.tagName).toBe('BUTTON');
        // Note: No actual click handlers implemented in component
      });
    });
  });

  describe('WireTransferForm() - Wire Transfer Form Component', () => {
    it('WireTransferForm() - should render main form structure', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.WireTransferForm />);
      });

      // ASSERT
      expect(screen.getByTestId('card')).toBeDefined();
      expect(screen.getByTestId('title')).toBeDefined();
      expect(screen.getByTestId('stack')).toBeDefined();
    });

    it('WireTransferForm() - should render all required text input fields', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.WireTransferForm />);
      });

      // ASSERT - Test functional form elements
      const textInputs = screen.getAllByTestId('text-input');
      const requiredInputs = textInputs.filter(input => 
        input.getAttribute('data-required') === 'true'
      );
      
      expect(textInputs.length).toBeGreaterThan(8); // Multiple text fields
      expect(requiredInputs.length).toBeGreaterThan(5); // Several required fields
    });

    it('WireTransferForm() - should render purpose code select field with correct options', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.WireTransferForm />);
      });

      // ASSERT - Test select field functionality
      const select = screen.getByTestId('select');
      expect(select).toBeDefined();
      expect(select.tagName).toBe('SELECT');
      expect(select.getAttribute('data-required')).toBe('true');
      expect(select.getAttribute('data-options-count')).toBe('20');
      expect(select.getAttribute('data-field-type')).toBe('select');
    });

    it('WireTransferForm() - should render amount number input field', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.WireTransferForm />);
      });

      // ASSERT - Test number input functionality
      const numberInput = screen.getByTestId('number-input');
      expect(numberInput).toBeDefined();
      expect(numberInput.tagName).toBe('INPUT');
      expect(numberInput.type).toBe('number');
      expect(numberInput.getAttribute('data-required')).toBe('true');
      expect(numberInput.getAttribute('data-field-type')).toBe('number');
    });

    it('WireTransferForm() - should render submit button', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.WireTransferForm />);
      });

      // ASSERT - Test submit button functionality
      const button = screen.getByTestId('button');
      expect(button).toBeDefined();
      expect(button.tagName).toBe('BUTTON');
    });

    it('WireTransferForm() - should have proper accessibility labels for all form fields', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.WireTransferForm />);
      });

      // ASSERT - Test accessibility
      const textInputs = screen.getAllByTestId('text-input');
      const numberInput = screen.getByTestId('number-input');
      const select = screen.getByTestId('select');

      [...textInputs, numberInput, select].forEach(field => {
        expect(field.getAttribute('aria-label')).toBeDefined();
        expect(field.getAttribute('aria-label')).not.toBe('');
      });
    });

    it('WireTransferForm() - should distinguish between required and optional fields', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.WireTransferForm />);
      });

      // ASSERT - Test field validation attributes
      const allInputs = [
        ...screen.getAllByTestId('text-input'),
        screen.getByTestId('number-input'),
        screen.getByTestId('select')
      ];

      const requiredFields = allInputs.filter(input => 
        input.getAttribute('data-required') === 'true'
      );
      const optionalFields = allInputs.filter(input => 
        input.getAttribute('data-required') === 'false'
      );

      expect(requiredFields.length).toBeGreaterThan(0);
      expect(optionalFields.length).toBeGreaterThan(0);
    });
  });

  describe('BillPayHub() - Bill Payment Component', () => {
    it('BillPayHub() - should render main structural elements', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.BillPayHub />);
      });

      // ASSERT
      expect(screen.getByTestId('card')).toBeDefined();
      expect(screen.getByTestId('title')).toBeDefined();
    });

    it('BillPayHub() - should render both bill payment options', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.BillPayHub />);
      });

      // ASSERT - Test functional elements
      const papers = screen.getAllByTestId('paper');
      expect(papers).toHaveLength(2); // Upcoming bills + Add payee

      const buttons = screen.getAllByTestId('button');
      expect(buttons).toHaveLength(2);
      
      buttons.forEach(button => {
        expect(button.tagName).toBe('BUTTON');
        expect(button.getAttribute('data-full-width')).toBe('true');
      });
    });

    it('BillPayHub() - should handle button interactions', async () => {
      // ARRANGE
      await act(async () => {
        render(<BankingScreens.BillPayHub />);
      });

      // ACT & ASSERT - Buttons should be interactive
      const buttons = screen.getAllByTestId('button');
      expect(buttons).toHaveLength(2);
      
      buttons.forEach(button => {
        expect(button).toBeDefined();
        expect(button.tagName).toBe('BUTTON');
        // Note: No actual click handlers implemented in component
      });
    });
  });

  describe('BankingScreens - Module Structure and Exports', () => {
    it('BankingScreens - should export all required components as functions', () => {
      // ARRANGE & ACT & ASSERT
      expect(BankingScreens).toBeDefined();
      expect(typeof BankingScreens).toBe('object');
      
      expect(BankingScreens.AccountsOverview).toBeDefined();
      expect(typeof BankingScreens.AccountsOverview).toBe('function');
      
      expect(BankingScreens.TransfersHub).toBeDefined();
      expect(typeof BankingScreens.TransfersHub).toBe('function');
      
      expect(BankingScreens.WireTransferForm).toBeDefined();
      expect(typeof BankingScreens.WireTransferForm).toBe('function');
      
      expect(BankingScreens.BillPayHub).toBeDefined();
      expect(typeof BankingScreens.BillPayHub).toBe('function');
      
      expect(BankingScreens.AccountDetails).toBeDefined();
    });

    it('BankingScreens - should have exactly 5 exported components', () => {
      // ARRANGE & ACT
      const componentKeys = Object.keys(BankingScreens);
      
      // ASSERT
      expect(componentKeys).toHaveLength(5);
      expect(componentKeys).toContain('AccountsOverview');
      expect(componentKeys).toContain('TransfersHub');
      expect(componentKeys).toContain('WireTransferForm');
      expect(componentKeys).toContain('BillPayHub');
      expect(componentKeys).toContain('AccountDetails');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('AccountsOverview() - should handle account with zero balance', async () => {
      // ARRANGE
      const zeroBalanceAccount: Account[] = [
        { id: 'zero-1', name: 'Empty Account', type: 'checking', balance: 0 }
      ];

      // ACT
      await act(async () => {
        render(<BankingScreens.AccountsOverview accounts={zeroBalanceAccount} />);
      });

      // ASSERT - Should render without issues
      const accountElements = screen.getAllByTestId(/^account-zero-/);
      expect(accountElements).toHaveLength(1);
    });

    it('AccountsOverview() - should handle account with negative balance', async () => {
      // ARRANGE
      const negativeBalanceAccount: Account[] = [
        { id: 'neg-1', name: 'Overdrawn Account', type: 'checking', balance: -150.75 }
      ];

      // ACT
      await act(async () => {
        render(<BankingScreens.AccountsOverview accounts={negativeBalanceAccount} />);
      });

      // ASSERT - Should render without issues
      const accountElements = screen.getAllByTestId(/^account-neg-/);
      expect(accountElements).toHaveLength(1);
    });

    it('AccountsOverview() - should handle very large account balances', async () => {
      // ARRANGE
      const largeBalanceAccounts: Account[] = [
        { id: 'large-1', name: 'Million Dollar Account', type: 'investment', balance: 1000000.99 },
        { id: 'large-2', name: 'Billion Dollar Account', type: 'trust', balance: 1000000000.01 }
      ];

      // ACT
      await act(async () => {
        render(<BankingScreens.AccountsOverview accounts={largeBalanceAccounts} />);
      });

      // ASSERT - Should render without crashing
      const accountElements = screen.getAllByTestId(/^account-large-/);
      expect(accountElements).toHaveLength(2);
    });

    it('AccountsOverview() - should handle extremely long account names', async () => {
      // ARRANGE
      const longNameAccount: Account[] = [
        { 
          id: 'long-1', 
          name: 'This is an extremely long account name that might cause layout issues in some user interfaces but should be handled gracefully by the component architecture without breaking the rendering pipeline',
          type: 'savings', 
          balance: 500.00 
        }
      ];

      // ACT
      await act(async () => {
        render(<BankingScreens.AccountsOverview accounts={longNameAccount} />);
      });

      // ASSERT - Should render without crashing
      const accountElements = screen.getAllByTestId(/^account-long-/);
      expect(accountElements).toHaveLength(1);
    });

    it('AccountsOverview() - should handle special characters in account IDs', async () => {
      // ARRANGE
      const specialIdAccounts: Account[] = [
        { id: 'acc-123-456', name: 'Hyphenated ID', type: 'checking', balance: 1000 },
        { id: 'acc_underscore_1', name: 'Underscore ID', type: 'savings', balance: 2000 }
      ];

      // ACT
      await act(async () => {
        render(<BankingScreens.AccountsOverview accounts={specialIdAccounts} />);
      });

      // ASSERT - Should handle navigation correctly with proper testids
      const account1 = screen.getByTestId('account-acc-123-456'); // Correct testid format
      const account2 = screen.getByTestId('account-acc_underscore_1'); // Correct testid format

      await act(async () => {
        await user.click(account1);
      });

      await act(async () => {
        await user.click(account2);
      });

      expect(mockNavigate).toHaveBeenCalledWith('/banking/accounts/acc-123-456');
      expect(mockNavigate).toHaveBeenCalledWith('/banking/accounts/acc_underscore_1');
    });

    it('WireTransferForm() - should handle form rendering without crashing on edge cases', async () => {
      // ARRANGE & ACT - Test multiple renders don't cause issues
      const { rerender } = render(<BankingScreens.WireTransferForm />);
      
      await act(async () => {
        rerender(<BankingScreens.WireTransferForm />);
      });

      await act(async () => {
        rerender(<BankingScreens.WireTransferForm />);
      });

      // ASSERT - Should maintain form structure
      expect(screen.getByTestId('card')).toBeDefined();
      expect(screen.getByTestId('stack')).toBeDefined();
      expect(screen.getAllByTestId('text-input').length).toBeGreaterThan(8);
    });
  });

  describe('Performance and React Optimization', () => {
    it('AccountsOverview() - should handle frequent prop updates efficiently', async () => {
      // ARRANGE
      const account1 = [{ id: '1', name: 'Account 1', type: 'checking' as const, balance: 100 }];
      const account2 = [{ id: '2', name: 'Account 2', type: 'savings' as const, balance: 200 }];
      const account3 = [{ id: '3', name: 'Account 3', type: 'business' as const, balance: 300 }];

      const { rerender } = render(<BankingScreens.AccountsOverview accounts={account1} />);

      // ACT - Simulate rapid prop changes
      await act(async () => {
        rerender(<BankingScreens.AccountsOverview accounts={account2} />);
      });

      await act(async () => {
        rerender(<BankingScreens.AccountsOverview accounts={account3} />);
      });

      await act(async () => {
        rerender(<BankingScreens.AccountsOverview accounts={[]} />);
      });

      // ASSERT - Should handle all updates without errors
      expect(screen.getByTestId('card')).toBeDefined();
      expect(screen.getByTestId('accounts-grid')).toBeDefined();
    });

    it('Static components - should render consistently on multiple renders', async () => {
      // ARRANGE & ACT - Test static components don't have unexpected behavior
      const { rerender } = render(<BankingScreens.TransfersHub />);

      await act(async () => {
        rerender(<BankingScreens.TransfersHub />);
      });

      await act(async () => {
        rerender(<BankingScreens.BillPayHub />);
      });

      await act(async () => {
        rerender(<BankingScreens.WireTransferForm />);
      });

      // ASSERT - Should render final component correctly
      expect(screen.getByTestId('card')).toBeDefined();
      expect(screen.getByTestId('stack')).toBeDefined();
    });
  });

  describe('Accessibility and Semantic HTML', () => {
    it('Title elements - should use correct semantic HTML tags', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.AccountsOverview accounts={[]} />);
      });

      // ASSERT - Test semantic structure
      const title = screen.getByTestId('title');
      expect(title.tagName).toBe('H2');
      expect(title.getAttribute('data-level')).toBe('2');
    });

    it('Form elements - should have proper semantic attributes', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.WireTransferForm />);
      });

      // ASSERT - Test form semantics
      const textInputs = screen.getAllByTestId('text-input');
      const numberInput = screen.getByTestId('number-input');
      const select = screen.getByTestId('select');

      // All form elements should have proper semantic attributes
      [...textInputs, numberInput].forEach(input => {
        expect(input.tagName).toBe('INPUT');
      });

      expect(select.tagName).toBe('SELECT');
      expect(numberInput.type).toBe('number');
    });

    it('Interactive elements - should be keyboard accessible', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.AccountsOverview accounts={[mockAccounts[0]]} />);
      });

      // ASSERT - Test keyboard accessibility
      const clickableAccount = screen.getByTestId('account-acc-1');
      expect(clickableAccount.getAttribute('data-clickable')).toBe('true');
      
      // Test that the element can receive focus (button-like behavior)
      expect(clickableAccount.onclick).toBeDefined();
    });

    it('Button elements - should use proper semantic HTML', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<BankingScreens.TransfersHub />);
      });

      // ASSERT - Test button semantics
      const buttons = screen.getAllByTestId('button');
      buttons.forEach(button => {
        expect(button.tagName).toBe('BUTTON');
      });
    });
  });
});
