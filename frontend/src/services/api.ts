import axios from 'axios';
import { API_BASE } from '../constants';
import type { Account, ProcessResponse, AccountBalance, AccountTransactionsResponse } from '../types';
import type { SessionStrategy } from './session-strategy';
import { SessionStrategyFactory } from './session-strategy';


// API service for all HTTP requests
export const apiService = {

  // Load user accounts
  async getAccounts(): Promise<Account[]> {
    const response = await axios.get(`${API_BASE}/api/accounts`);
    return response.data.accounts;
  },

  // Process user message/query with session strategy support
  async processMessage(
    query: string, 
    uiContext: string, 
    sessionStrategy?: SessionStrategy
  ): Promise<ProcessResponse> {
    // Use persistent session by default for backward compatibility
    const strategy = sessionStrategy || SessionStrategyFactory.createPersistent();
    const sessionId = strategy.getSessionForRequest();
    
    const requestBody: {
      query: string;
      ui_context: string;
      session_id?: string;
    } = {
      query,
      ui_context: uiContext
    };
    
    // Only include session_id if strategy provides one
    if (sessionId) {
      requestBody.session_id = sessionId;
    }
    
    const response = await axios.post(`${API_BASE}/api/process`, requestBody);
    return response.data;
  },

  // Convenience method for persistent session usage
  async processMessageWithSession(query: string, uiContext: string): Promise<ProcessResponse> {
    return this.processMessage(query, uiContext, SessionStrategyFactory.createPersistent());
  },

  // Convenience method for stateless usage (no session)
  async processMessageStateless(query: string, uiContext: string): Promise<ProcessResponse> {
    return this.processMessage(query, uiContext, SessionStrategyFactory.createEphemeral());
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
