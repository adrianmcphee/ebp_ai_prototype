import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { apiService } from '../services/api';
import { API_BASE } from '../constants';
import type { 
  Account, 
  ProcessResponse, 
  AccountBalance, 
  AccountTransactionsResponse
} from '../types';

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  }
}));

const mockedAxios = vi.mocked(axios);

describe('apiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initializeSession() - Session Management', () => {
    it('initializeSession() - should make POST request to session endpoint', async () => {
      // ARRANGE
      mockedAxios.post.mockResolvedValueOnce({ data: {} });

      // ACT
      await apiService.initializeSession();

      // ASSERT
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(`${API_BASE}/api/session`);
    });

    it('initializeSession() - should handle API errors gracefully', async () => {
      // ARRANGE
      const mockError = new Error('Network error');
      mockedAxios.post.mockRejectedValueOnce(mockError);

      // ACT & ASSERT
      await expect(apiService.initializeSession()).rejects.toThrow('Network error');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('initializeSession() - should resolve with undefined on success', async () => {
      // ARRANGE
      mockedAxios.post.mockResolvedValueOnce({ data: {} });

      // ACT
      const result = await apiService.initializeSession();

      // ASSERT
      expect(result).toBeUndefined();
    });
  });

  describe('getAccounts() - Account Data Retrieval', () => {
    it('getAccounts() - should make GET request to accounts endpoint and return accounts array', async () => {
      // ARRANGE
      const mockAccounts: Account[] = [
        { id: 'acc-1', name: 'Checking', type: 'checking', balance: 1000, currency: 'USD' },
        { id: 'acc-2', name: 'Savings', type: 'savings', balance: 5000, currency: 'USD' }
      ];
      mockedAxios.get.mockResolvedValueOnce({ data: { accounts: mockAccounts } });

      // ACT
      const result = await apiService.getAccounts();

      // ASSERT
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(`${API_BASE}/api/accounts`);
      expect(result).toEqual(mockAccounts);
      expect(result).toHaveLength(2);
    });

    it('getAccounts() - should handle empty accounts array', async () => {
      // ARRANGE
      const mockAccounts: Account[] = [];
      mockedAxios.get.mockResolvedValueOnce({ data: { accounts: mockAccounts } });

      // ACT
      const result = await apiService.getAccounts();

      // ASSERT
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('getAccounts() - should handle API errors gracefully', async () => {
      // ARRANGE
      const mockError = new Error('Failed to fetch accounts');
      mockedAxios.get.mockRejectedValueOnce(mockError);

      // ACT & ASSERT
      await expect(apiService.getAccounts()).rejects.toThrow('Failed to fetch accounts');
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('getAccounts() - should return properly typed Account objects', async () => {
      // ARRANGE
      const mockAccounts: Account[] = [
        { id: 'acc-1', name: 'Test Account', type: 'checking', balance: 2500.75, currency: 'EUR' }
      ];
      mockedAxios.get.mockResolvedValueOnce({ data: { accounts: mockAccounts } });

      // ACT
      const result = await apiService.getAccounts();

      // ASSERT
      expect(result[0]).toHaveProperty('id', 'acc-1');
      expect(result[0]).toHaveProperty('name', 'Test Account');
      expect(result[0]).toHaveProperty('type', 'checking');
      expect(result[0]).toHaveProperty('balance', 2500.75);
      expect(result[0]).toHaveProperty('currency', 'EUR');
    });
  });

  describe('processMessage() - Message Processing', () => {
    it('processMessage() - should make POST request with query and ui_context', async () => {
      // ARRANGE
      const mockQuery = 'Show my account balance';
      const mockUIContext = 'accounts-overview';
      const mockResponse: ProcessResponse = {
        status: 'success',
        intent: 'view_balance',
        confidence: 0.95,
        message: 'Here is your balance information'
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      // ACT
      const result = await apiService.processMessage(mockQuery, mockUIContext);

      // ASSERT
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith(`${API_BASE}/api/process`, {
        query: mockQuery,
        ui_context: mockUIContext
      });
      expect(result).toEqual(mockResponse);
    });

    it('processMessage() - should handle empty query and context', async () => {
      // ARRANGE
      const mockResponse: ProcessResponse = { status: 'error' };
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      // ACT
      const result = await apiService.processMessage('', '');

      // ASSERT
      expect(mockedAxios.post).toHaveBeenCalledWith(`${API_BASE}/api/process`, {
        query: '',
        ui_context: ''
      });
      expect(result).toEqual(mockResponse);
    });

    it('processMessage() - should handle API processing errors', async () => {
      // ARRANGE
      const mockError = new Error('Processing failed');
      mockedAxios.post.mockRejectedValueOnce(mockError);

      // ACT & ASSERT
      await expect(apiService.processMessage('test', 'context')).rejects.toThrow('Processing failed');
    });

    it('processMessage() - should return complete ProcessResponse with all optional fields', async () => {
      // ARRANGE
      const mockResponse: ProcessResponse = {
        status: 'success',
        intent: 'transfer_money',
        confidence: 0.88,
        entities: { amount: 100, account: 'savings' },
        message: 'Transfer initiated',
        ui_assistance: {
          type: 'transaction_form',
          action: 'show_form',
          form_config: {
            screen_id: 'transfer',
            title: 'Transfer Money',
            subtitle: 'Complete your transfer',
            fields: [],
            confirmation_required: true,
            complexity_reduction: 'simplified'
          }
        },
        execution: { transaction_id: 'tx-123' }
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      // ACT
      const result = await apiService.processMessage('transfer $100', 'home');

      // ASSERT
      expect(result).toEqual(mockResponse);
      expect(result.ui_assistance?.type).toBe('transaction_form');
      expect(result.ui_assistance?.form_config?.confirmation_required).toBe(true);
    });
  });



  describe('getAccountBalance() - Account Balance Retrieval', () => {
    it('getAccountBalance() - should make GET request with account ID and return balance data', async () => {
      // ARRANGE
      const mockAccountId = 'acc-123';
      const mockBalance: AccountBalance = {
        account_id: 'acc-123',
        balance: 2500.50
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockBalance });

      // ACT
      const result = await apiService.getAccountBalance(mockAccountId);

      // ASSERT
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(`${API_BASE}/api/accounts/${mockAccountId}/balance`);
      expect(result).toEqual(mockBalance);
    });

    it('getAccountBalance() - should handle zero balance', async () => {
      // ARRANGE
      const mockAccountId = 'acc-456';
      const mockBalance: AccountBalance = {
        account_id: 'acc-456',
        balance: 0
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockBalance });

      // ACT
      const result = await apiService.getAccountBalance(mockAccountId);

      // ASSERT
      expect(result.balance).toBe(0);
      expect(result.account_id).toBe(mockAccountId);
    });

    it('getAccountBalance() - should handle negative balance', async () => {
      // ARRANGE
      const mockAccountId = 'acc-789';
      const mockBalance: AccountBalance = {
        account_id: 'acc-789',
        balance: -150.75
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockBalance });

      // ACT
      const result = await apiService.getAccountBalance(mockAccountId);

      // ASSERT
      expect(result.balance).toBe(-150.75);
    });

    it('getAccountBalance() - should handle API errors gracefully', async () => {
      // ARRANGE
      const mockError = new Error('Balance fetch failed');
      mockedAxios.get.mockRejectedValueOnce(mockError);

      // ACT & ASSERT
      await expect(apiService.getAccountBalance('acc-invalid')).rejects.toThrow('Balance fetch failed');
    });

    it('getAccountBalance() - should handle empty account ID', async () => {
      // ARRANGE
      const mockBalance: AccountBalance = {
        account_id: '',
        balance: 0
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockBalance });

      // ACT
      const result = await apiService.getAccountBalance('');

      // ASSERT
      expect(mockedAxios.get).toHaveBeenCalledWith(`${API_BASE}/api/accounts//balance`);
      expect(result.account_id).toBe('');
    });
  });

  describe('getAccountTransactions() - Transaction History Retrieval', () => {
    it('getAccountTransactions() - should make GET request with account ID and return transactions', async () => {
      // ARRANGE
      const mockAccountId = 'acc-123';
      const mockResponse: AccountTransactionsResponse = {
        account_id: 'acc-123',
        transactions: [
          {
            id: 'tx-1',
            date: '2024-01-15',
            amount: -50.00,
            description: 'Coffee Shop',
            type: 'debit',
            account_id: 'acc-123',
            balance_after: 950.00,
            category: 'food',
            merchant: 'Local Cafe',
            status: 'completed'
          }
        ],
        total_count: 1,
        page: 1,
        per_page: 10,
        has_more: false
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      // ACT
      const result = await apiService.getAccountTransactions(mockAccountId);

      // ASSERT
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockedAxios.get).toHaveBeenCalledWith(`${API_BASE}/api/accounts/${mockAccountId}/transactions`, { params: {} });
      expect(result).toEqual(mockResponse);
      expect(result.transactions).toHaveLength(1);
    });

    it('getAccountTransactions() - should include limit parameter when provided', async () => {
      // ARRANGE
      const mockAccountId = 'acc-456';
      const mockLimit = 5;
      const mockResponse: AccountTransactionsResponse = {
        account_id: 'acc-456',
        transactions: [],
        total_count: 0,
        page: 1,
        per_page: 5,
        has_more: false
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      // ACT
      const result = await apiService.getAccountTransactions(mockAccountId, mockLimit);

      // ASSERT
      expect(mockedAxios.get).toHaveBeenCalledWith(`${API_BASE}/api/accounts/${mockAccountId}/transactions`, { params: { limit: mockLimit } });
      expect(result.per_page).toBe(5);
    });

    it('getAccountTransactions() - should handle empty transactions array', async () => {
      // ARRANGE
      const mockAccountId = 'acc-empty';
      const mockResponse: AccountTransactionsResponse = {
        account_id: 'acc-empty',
        transactions: [],
        total_count: 0,
        page: 1,
        per_page: 10,
        has_more: false
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      // ACT
      const result = await apiService.getAccountTransactions(mockAccountId);

      // ASSERT
      expect(result.transactions).toHaveLength(0);
      expect(result.total_count).toBe(0);
      expect(result.has_more).toBe(false);
    });

    it('getAccountTransactions() - should handle multiple transaction types', async () => {
      // ARRANGE
      const mockAccountId = 'acc-multi';
      const mockResponse: AccountTransactionsResponse = {
        account_id: 'acc-multi',
        transactions: [
          {
            id: 'tx-credit',
            date: '2024-01-16',
            amount: 1000.00,
            description: 'Salary Deposit',
            type: 'credit',
            account_id: 'acc-multi',
            balance_after: 2000.00,
            status: 'completed'
          },
          {
            id: 'tx-debit',
            date: '2024-01-15',
            amount: -25.00,
            description: 'ATM Withdrawal',
            type: 'debit',
            account_id: 'acc-multi',
            balance_after: 1000.00,
            status: 'pending'
          }
        ],
        total_count: 2,
        page: 1,
        per_page: 10,
        has_more: false
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      // ACT
      const result = await apiService.getAccountTransactions(mockAccountId);

      // ASSERT
      expect(result.transactions).toHaveLength(2);
      expect(result.transactions[0].type).toBe('credit');
      expect(result.transactions[1].type).toBe('debit');
      expect(result.transactions[0].status).toBe('completed');
      expect(result.transactions[1].status).toBe('pending');
    });

    it('getAccountTransactions() - should handle API errors gracefully', async () => {
      // ARRANGE
      const mockError = new Error('Transactions fetch failed');
      mockedAxios.get.mockRejectedValueOnce(mockError);

      // ACT & ASSERT
      await expect(apiService.getAccountTransactions('acc-error')).rejects.toThrow('Transactions fetch failed');
    });

    it('getAccountTransactions() - should handle large limit values', async () => {
      // ARRANGE
      const mockAccountId = 'acc-large';
      const mockLimit = 1000;
      const mockResponse: AccountTransactionsResponse = {
        account_id: 'acc-large',
        transactions: [],
        total_count: 0,
        page: 1,
        per_page: 1000,
        has_more: false
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      // ACT
      const result = await apiService.getAccountTransactions(mockAccountId, mockLimit);

      // ASSERT
      expect(mockedAxios.get).toHaveBeenCalledWith(`${API_BASE}/api/accounts/${mockAccountId}/transactions`, { params: { limit: 1000 } });
      expect(result.per_page).toBe(1000);
    });

    it('getAccountTransactions() - should handle pagination metadata correctly', async () => {
      // ARRANGE
      const mockAccountId = 'acc-paginated';
      const mockResponse: AccountTransactionsResponse = {
        account_id: 'acc-paginated',
        transactions: [],
        total_count: 25,
        page: 2,
        per_page: 10,
        has_more: true
      };
      mockedAxios.get.mockResolvedValueOnce({ data: mockResponse });

      // ACT
      const result = await apiService.getAccountTransactions(mockAccountId);

      // ASSERT
      expect(result.total_count).toBe(25);
      expect(result.page).toBe(2);
      expect(result.per_page).toBe(10);
      expect(result.has_more).toBe(true);
    });
  });

  describe('apiService - Edge Cases and Error Handling', () => {
    it('should handle network timeouts for all methods', async () => {
      // ARRANGE
      const timeoutError = new Error('timeout');
      timeoutError.name = 'TimeoutError';

      // ACT & ASSERT - Test each method handles timeouts
      mockedAxios.post.mockRejectedValueOnce(timeoutError);
      await expect(apiService.initializeSession()).rejects.toThrow('timeout');

      mockedAxios.get.mockRejectedValueOnce(timeoutError);
      await expect(apiService.getAccounts()).rejects.toThrow('timeout');

      mockedAxios.post.mockRejectedValueOnce(timeoutError);
      await expect(apiService.processMessage('test', 'context')).rejects.toThrow('timeout');

      mockedAxios.get.mockRejectedValueOnce(timeoutError);
      await expect(apiService.getAccountBalance('acc-1')).rejects.toThrow('timeout');

      mockedAxios.get.mockRejectedValueOnce(timeoutError);
      await expect(apiService.getAccountTransactions('acc-1')).rejects.toThrow('timeout');
    });

    it('should handle HTTP status errors for all methods', async () => {
      // ARRANGE
      const statusError = new Error('Request failed with status code 500');
      statusError.name = 'AxiosError';

      // ACT & ASSERT - Test each method handles HTTP errors
      mockedAxios.post.mockRejectedValueOnce(statusError);
      await expect(apiService.initializeSession()).rejects.toThrow('Request failed with status code 500');

      mockedAxios.get.mockRejectedValueOnce(statusError);
      await expect(apiService.getAccounts()).rejects.toThrow('Request failed with status code 500');
    });

    it('should preserve axios response structure for successful calls', async () => {
      // ARRANGE
      const mockAxiosResponse = {
        data: { test: 'data' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {}
      };
      mockedAxios.post.mockResolvedValueOnce(mockAxiosResponse);

      // ACT
      await apiService.initializeSession();

      // ASSERT
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      // The service should work with the axios response structure
    });
  });
});
