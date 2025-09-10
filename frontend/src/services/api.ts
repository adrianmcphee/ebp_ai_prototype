import axios from 'axios';
import { API_BASE } from '../constants';
import type { Account, ProcessResponse, AccountBalance, AccountTransactionsResponse } from '../types';
import { sessionService } from './session';


// API service for all HTTP requests
export const apiService = {

  // Load user accounts
  async getAccounts(): Promise<Account[]> {
    const response = await axios.get(`${API_BASE}/api/accounts`);
    return response.data.accounts;
  },

  // Process user message/query
  async processMessage(query: string, uiContext: string): Promise<ProcessResponse> {
    const sessionId = sessionService.getSessionId();
    const response = await axios.post(`${API_BASE}/api/process`, {
      query,
      ui_context: uiContext,
      session_id: sessionId
    });
    return response.data;
  },



  // Get account balance details
  async getAccountBalance(accountId: string): Promise<AccountBalance> {
    const response = await axios.get(`${API_BASE}/api/accounts/${accountId}/balance`);
    return response.data;
  },

  // Get account transactions
  async getAccountTransactions(accountId: string, limit?: number): Promise<AccountTransactionsResponse> {
    const params = limit ? { limit } : {};
    const response = await axios.get(`${API_BASE}/api/accounts/${accountId}/transactions`, { params });
    return response.data;
  }
};
