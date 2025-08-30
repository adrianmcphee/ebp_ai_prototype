import axios from 'axios';
import { API_BASE } from '../constants';
import type { Account, ProcessResponse } from '../types';
import type { RoutesResponse, AppRoutes } from '../types';

// API service for all HTTP requests
export const apiService = {
  // Initialize session
  async initializeSession(): Promise<void> {
    await axios.post(`${API_BASE}/api/session`);
  },

  // Load user accounts
  async getAccounts(): Promise<Account[]> {
    const response = await axios.get(`${API_BASE}/api/accounts`);
    return response.data.accounts;
  },

  // Process user message/query
  async processMessage(query: string, uiContext: string): Promise<ProcessResponse> {
    const response = await axios.post(`${API_BASE}/api/process`, {
      query,
      ui_context: uiContext
    });
    return response.data;
  },

  // Fetch application routes from backend
  async fetchRoutes(): Promise<AppRoutes> {
    const response = await axios.get(`${API_BASE}/api/routes`);
    const routesResponse: RoutesResponse = response.data;
    
    // Convert list format to legacy dictionary format for backward compatibility
    const routes: AppRoutes = {};
    routesResponse.routes.forEach(route => {
      routes[route.path] = {
        component: route.component,
        intent: route.intent,
        breadcrumb: route.breadcrumb,
        tab: route.tab
      };
    });
    
    return routes;
  },

  // Fetch application routes in new list format
  async fetchRoutesArray(): Promise<RoutesResponse> {
    const response = await axios.get(`${API_BASE}/api/routes`);
    return response.data;
  }
};
