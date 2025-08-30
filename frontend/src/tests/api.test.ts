import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { apiService } from '../services/api';
import type { Account, ProcessResponse } from '../types';

// Mock axios for all HTTP requests
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock constants
vi.mock('../constants', () => ({
  API_BASE: 'http://localhost:8000'
}));

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initializeSession() - Session Management', () => {
    it('initializeSession() - should call POST request to session endpoint', async () => {
      // ARRANGE
      mockedAxios.post.mockResolvedValueOnce({ data: {} });

      // ACT
      await apiService.initializeSession();

      // ASSERT
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:8000/api/session');
    });

    it('initializeSession() - should handle successful session initialization', async () => {
      // ARRANGE
      const mockResponse = { data: { status: 'success' } };
      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      // ACT
      const result = await apiService.initializeSession();

      // ASSERT
      expect(result).toBeUndefined();
      expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:8000/api/session');
    });

    it('initializeSession() - should handle network errors gracefully', async () => {
      // ARRANGE
      const networkError = new Error('Network Error');
      mockedAxios.post.mockRejectedValueOnce(networkError);

      // ACT & ASSERT
      await expect(apiService.initializeSession()).rejects.toThrow('Network Error');
      expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:8000/api/session');
    });

    it('initializeSession() - should handle HTTP error responses', async () => {
      // ARRANGE
      const httpError = {
        response: { status: 500, data: { error: 'Server Error' } },
        message: 'Request failed with status code 500'
      };
      mockedAxios.post.mockRejectedValueOnce(httpError);

      // ACT & ASSERT
      await expect(apiService.initializeSession()).rejects.toEqual(httpError);
    });

    it('initializeSession() - should handle timeout errors', async () => {
      // ARRANGE
      const timeoutError = new Error('timeout of 5000ms exceeded');
      mockedAxios.post.mockRejectedValueOnce(timeoutError);

      // ACT & ASSERT
      await expect(apiService.initializeSession()).rejects.toThrow('timeout of 5000ms exceeded');
    });
  });

  describe('getAccounts() - Account Data Retrieval', () => {
    it('getAccounts() - should call GET request to accounts endpoint', async () => {
      // ARRANGE
      const mockAccounts: Account[] = [
        { id: '1', name: 'Checking Account', type: 'checking', balance: 1500.50 },
        { id: '2', name: 'Savings Account', type: 'savings', balance: 5000.75 }
      ];
      const mockResponse = { data: { accounts: mockAccounts } };
      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      // ACT
      const result = await apiService.getAccounts();

      // ASSERT
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:8000/api/accounts');
      expect(result).toEqual(mockAccounts);
      expect(result).toHaveLength(2);
    });

    it('getAccounts() - should return empty array when no accounts exist', async () => {
      // ARRANGE
      const mockResponse = { data: { accounts: [] } };
      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      // ACT
      const result = await apiService.getAccounts();

      // ASSERT
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
      expect(Array.isArray(result)).toBe(true);
    });

    it('getAccounts() - should handle single account response correctly', async () => {
      // ARRANGE
      const singleAccount: Account[] = [
        { id: 'acc-1', name: 'Primary Checking', type: 'checking', balance: 2500.00 }
      ];
      const mockResponse = { data: { accounts: singleAccount } };
      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      // ACT
      const result = await apiService.getAccounts();

      // ASSERT
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'acc-1',
        name: 'Primary Checking',
        type: 'checking',
        balance: 2500.00
      });
    });

    it('getAccounts() - should handle network errors during account retrieval', async () => {
      // ARRANGE
      const networkError = new Error('Failed to fetch accounts');
      mockedAxios.get.mockRejectedValueOnce(networkError);

      // ACT & ASSERT
      await expect(apiService.getAccounts()).rejects.toThrow('Failed to fetch accounts');
      expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:8000/api/accounts');
    });

    it('getAccounts() - should handle malformed server response', async () => {
      // ARRANGE
      const malformedResponse = { data: { wrongProperty: [] } };
      mockedAxios.get.mockResolvedValueOnce(malformedResponse);

      // ACT
      const result = await apiService.getAccounts();

      // ASSERT
      expect(result).toBeUndefined();
      expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:8000/api/accounts');
    });

    it('getAccounts() - should handle 404 not found errors', async () => {
      // ARRANGE
      const notFoundError = {
        response: { status: 404, data: { error: 'Accounts not found' } },
        message: 'Request failed with status code 404'
      };
      mockedAxios.get.mockRejectedValueOnce(notFoundError);

      // ACT & ASSERT
      await expect(apiService.getAccounts()).rejects.toEqual(notFoundError);
    });

    it('getAccounts() - should handle accounts with various balance types', async () => {
      // ARRANGE
      const accountsWithVariousBalances: Account[] = [
        { id: '1', name: 'Zero Balance Account', type: 'checking', balance: 0 },
        { id: '2', name: 'Negative Balance Account', type: 'checking', balance: -150.25 },
        { id: '3', name: 'High Balance Account', type: 'savings', balance: 999999.99 }
      ];
      const mockResponse = { data: { accounts: accountsWithVariousBalances } };
      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      // ACT
      const result = await apiService.getAccounts();

      // ASSERT
      expect(result).toHaveLength(3);
      expect(result[0].balance).toBe(0);
      expect(result[1].balance).toBe(-150.25);
      expect(result[2].balance).toBe(999999.99);
    });
  });

  describe('processMessage() - Message Processing', () => {
    it('processMessage() - should call POST request with correct parameters', async () => {
      // ARRANGE
      const query = 'Show me my account balance';
      const uiContext = 'accounts_overview';
      const mockResponse: ProcessResponse = {
        status: 'success',
        message: 'Your checking account balance is $1,500.50',
        intent: 'balance_inquiry',
        confidence: 0.95
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      // ACT
      const result = await apiService.processMessage(query, uiContext);

      // ASSERT
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:8000/api/process', {
        query: 'Show me my account balance',
        ui_context: 'accounts_overview'
      });
      expect(result).toEqual(mockResponse);
    });

    it('processMessage() - should handle successful message processing with full response', async () => {
      // ARRANGE
      const query = 'Transfer $500 from checking to savings';
      const uiContext = 'transfers_hub';
      const mockResponse: ProcessResponse = {
        status: 'success',
        message: 'Transfer completed successfully',
        intent: 'money_transfer',
        confidence: 0.98,
        entities: { amount: 500, from_account: 'checking', to_account: 'savings' },
        ui_assistance: {
          type: 'transaction_form',
          action: 'show_transfer_form',
          screen_id: 'transfer_confirmation'
        },
        execution: { transaction_id: 'txn_12345' }
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      // ACT
      const result = await apiService.processMessage(query, uiContext);

      // ASSERT
      expect(result).toMatchObject({
        status: 'success',
        message: 'Transfer completed successfully',
        intent: 'money_transfer',
        confidence: 0.98
      });
      expect(result.entities).toBeDefined();
      expect(result.ui_assistance).toBeDefined();
      expect(result.execution).toBeDefined();
    });

    it('processMessage() - should handle minimal response structure', async () => {
      // ARRANGE
      const query = 'Hello';
      const uiContext = 'chat';
      const minimalResponse: ProcessResponse = {
        status: 'success'
      };
      mockedAxios.post.mockResolvedValueOnce({ data: minimalResponse });

      // ACT
      const result = await apiService.processMessage(query, uiContext);

      // ASSERT
      expect(result).toEqual({ status: 'success' });
      expect(result.message).toBeUndefined();
      expect(result.intent).toBeUndefined();
      expect(result.confidence).toBeUndefined();
    });

    it('processMessage() - should handle empty string parameters', async () => {
      // ARRANGE
      const query = '';
      const uiContext = '';
      const mockResponse: ProcessResponse = {
        status: 'error',
        message: 'Empty query provided'
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      // ACT
      const result = await apiService.processMessage(query, uiContext);

      // ASSERT
      expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:8000/api/process', {
        query: '',
        ui_context: ''
      });
      expect(result.status).toBe('error');
    });

    it('processMessage() - should handle special characters in query', async () => {
      // ARRANGE
      const query = 'Transfer $1,000.50 from "Primary Checking" to savings & email receipt';
      const uiContext = 'transfers_hub';
      const mockResponse: ProcessResponse = {
        status: 'success',
        intent: 'transfer_with_notification',
        confidence: 0.87
      };
      mockedAxios.post.mockResolvedValueOnce({ data: mockResponse });

      // ACT
      const result = await apiService.processMessage(query, uiContext);

      // ASSERT
      expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:8000/api/process', {
        query: 'Transfer $1,000.50 from "Primary Checking" to savings & email receipt',
        ui_context: 'transfers_hub'
      });
      expect(result.status).toBe('success');
    });

    it('processMessage() - should handle network errors during processing', async () => {
      // ARRANGE
      const query = 'Show transactions';
      const uiContext = 'transactions';
      const networkError = new Error('Connection timeout');
      mockedAxios.post.mockRejectedValueOnce(networkError);

      // ACT & ASSERT
      await expect(apiService.processMessage(query, uiContext)).rejects.toThrow('Connection timeout');
      expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:8000/api/process', {
        query: 'Show transactions',
        ui_context: 'transactions'
      });
    });

    it('processMessage() - should handle server error responses', async () => {
      // ARRANGE
      const query = 'Invalid request';
      const uiContext = 'unknown';
      const serverError = {
        response: { 
          status: 400, 
          data: { error: 'Invalid query format' } 
        },
        message: 'Request failed with status code 400'
      };
      mockedAxios.post.mockRejectedValueOnce(serverError);

      // ACT & ASSERT
      await expect(apiService.processMessage(query, uiContext)).rejects.toEqual(serverError);
    });

    it('processMessage() - should handle low confidence responses', async () => {
      // ARRANGE
      const query = 'Unclear request';
      const uiContext = 'general';
      const lowConfidenceResponse: ProcessResponse = {
        status: 'success',
        message: 'I am not sure what you mean. Could you clarify?',
        intent: 'unknown',
        confidence: 0.12
      };
      mockedAxios.post.mockResolvedValueOnce({ data: lowConfidenceResponse });

      // ACT
      const result = await apiService.processMessage(query, uiContext);

      // ASSERT
      expect(result.confidence).toBe(0.12);
      expect(result.intent).toBe('unknown');
      expect(result.status).toBe('success');
    });

    it('processMessage() - should handle responses with dynamic properties', async () => {
      // ARRANGE
      const query = 'Dynamic test';
      const uiContext = 'test';
      const dynamicResponse: ProcessResponse = {
        status: 'success',
        customProperty: 'custom value',
        anotherDynamicField: { nested: 'data' },
        numericField: 42
      };
      mockedAxios.post.mockResolvedValueOnce({ data: dynamicResponse });

      // ACT
      const result = await apiService.processMessage(query, uiContext);

      // ASSERT
      expect(result).toMatchObject(dynamicResponse);
      expect(result.customProperty).toBe('custom value');
      expect(result.anotherDynamicField).toEqual({ nested: 'data' });
      expect(result.numericField).toBe(42);
    });
  });

  describe('apiService - API Service Integration Points', () => {
    it('apiService - should export all required service methods', () => {
      // ARRANGE & ACT & ASSERT
      expect(typeof apiService.initializeSession).toBe('function');
      expect(typeof apiService.getAccounts).toBe('function');
      expect(typeof apiService.processMessage).toBe('function');
      expect(Object.keys(apiService)).toHaveLength(3);
    });

    it('apiService - should handle concurrent API calls correctly', async () => {
      // ARRANGE
      const mockSessionResponse = { data: {} };
      const mockAccountsResponse = { data: { accounts: [] } };
      const mockProcessResponse = { data: { status: 'success' } };
      
      mockedAxios.post.mockImplementation((url) => {
        if (url.includes('/session')) {
          return Promise.resolve(mockSessionResponse);
        }
        return Promise.resolve(mockProcessResponse);
      });
      mockedAxios.get.mockResolvedValueOnce(mockAccountsResponse);

      // ACT
      const [sessionResult, accountsResult, processResult] = await Promise.all([
        apiService.initializeSession(),
        apiService.getAccounts(),
        apiService.processMessage('test', 'test')
      ]);

      // ASSERT
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      expect(sessionResult).toBeUndefined();
      expect(accountsResult).toEqual([]);
      expect(processResult).toMatchObject({ status: 'success' });
    });

    it('apiService - should handle mixed success and error responses in concurrent calls', async () => {
      // ARRANGE
      const mockSessionResponse = { data: {} };
      const accountsError = new Error('Accounts service unavailable');
      const mockProcessResponse = { data: { status: 'success' } };
      
      mockedAxios.post.mockImplementation((url) => {
        if (url.includes('/session')) {
          return Promise.resolve(mockSessionResponse);
        }
        return Promise.resolve(mockProcessResponse);
      });
      mockedAxios.get.mockRejectedValueOnce(accountsError);

      // ACT & ASSERT
      await expect(Promise.allSettled([
        apiService.initializeSession(),
        apiService.getAccounts(),
        apiService.processMessage('test', 'test')
      ])).resolves.toEqual([
        { status: 'fulfilled', value: undefined },
        { status: 'rejected', reason: accountsError },
        { status: 'fulfilled', value: { status: 'success' } }
      ]);
    });
  });

  describe('apiService - Error Handling Edge Cases', () => {
    it('apiService - should handle axios instance configuration errors', async () => {
      // ARRANGE
      const configError = new Error('Request configuration error');
      mockedAxios.post.mockImplementation(() => {
        throw configError;
      });

      // ACT & ASSERT
      await expect(apiService.initializeSession()).rejects.toThrow('Request configuration error');
    });

    it('apiService - should handle null or undefined response data', async () => {
      // ARRANGE
      mockedAxios.get.mockResolvedValueOnce({ data: null });

      // ACT & ASSERT
      await expect(apiService.getAccounts()).rejects.toThrow();
      expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:8000/api/accounts');
    });

    it('apiService - should handle response with no data property', async () => {
      // ARRANGE
      mockedAxios.post.mockResolvedValueOnce({});

      // ACT
      const result = await apiService.processMessage('test', 'test');

      // ASSERT
      expect(result).toBeUndefined();
    });
  });
});
