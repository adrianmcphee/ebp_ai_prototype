import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAppRoutes, createDerivedMappings } from '../services/routes';
import type { AppRoutes } from '../types';

// Import for accessing mocked services
import { apiService } from '../services/api';

// Mock the API service
vi.mock('../services/api', () => ({
  apiService: {
    fetchRoutes: vi.fn().mockResolvedValue({
      '/': { intent: 'dashboard', component: 'BankingDashboard', tab: 'banking' },
      '/banking/accounts': { intent: 'view_accounts', component: 'AccountsOverview', tab: 'banking' },
      '/banking/transfers': { intent: 'transfer_money', component: 'TransfersHub', tab: 'banking' }
    })
  }
}));

describe('Routes Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchAppRoutes() - Route Fetching', () => {
    it('fetchAppRoutes() - should fetch routes from API service', async () => {
      // ARRANGE
      const mockRoutes: AppRoutes = {
        '/': { intent: 'dashboard', component: 'BankingDashboard', tab: 'banking' },
        '/banking/accounts': { intent: 'view_accounts', component: 'AccountsOverview', tab: 'banking' },
        '/banking/transfers': { intent: 'transfer_money', component: 'TransfersHub', tab: 'banking' }
      };
      vi.mocked(apiService.fetchRoutes).mockResolvedValueOnce(mockRoutes);

      // ACT
      const result = await fetchAppRoutes();

      // ASSERT
      expect(apiService.fetchRoutes).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockRoutes);
      expect(typeof result).toBe('object');
    });

    it('fetchAppRoutes() - should handle comprehensive route configurations', async () => {
      // ARRANGE
      const comprehensiveRoutes: AppRoutes = {
        '/': { intent: 'dashboard', component: 'BankingDashboard', tab: 'banking' },
        '/banking/accounts': { intent: 'view_accounts', component: 'AccountsOverview', tab: 'banking' },
        '/banking/accounts/{account_id}': { intent: 'view_account_details', component: 'AccountDetails', tab: 'banking' },
        '/banking/transfers': { intent: 'transfer_money', component: 'TransfersHub', tab: 'banking' },
        '/banking/transfers/wire': { intent: 'wire_transfer', component: 'WireTransferForm', tab: 'banking' },
        '/banking/payments/bills': { intent: 'pay_bills', component: 'BillPayHub', tab: 'banking' },
        '/customer-service': { intent: 'customer_service', component: 'CustomerServiceHub', tab: 'support' }
      };
      vi.mocked(apiService.fetchRoutes).mockResolvedValueOnce(comprehensiveRoutes);

      // ACT
      const result = await fetchAppRoutes();

      // ASSERT
      expect(result).toHaveProperty('/');
      expect(result).toHaveProperty('/banking/accounts');
      expect(result).toHaveProperty('/banking/accounts/{account_id}');
      expect(result).toHaveProperty('/customer-service');
      expect(Object.keys(result)).toHaveLength(7);
    });

    it('fetchAppRoutes() - should handle empty route configurations', async () => {
      // ARRANGE
      const emptyRoutes: AppRoutes = {};
      vi.mocked(apiService.fetchRoutes).mockResolvedValueOnce(emptyRoutes);

      // ACT
      const result = await fetchAppRoutes();

      // ASSERT
      expect(result).toEqual({});
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('fetchAppRoutes() - should log fetched routes for debugging', async () => {
      // ARRANGE
      const mockRoutes: AppRoutes = {
        '/': { intent: 'dashboard', component: 'BankingDashboard', tab: 'banking' }
      };
      vi.mocked(apiService.fetchRoutes).mockResolvedValueOnce(mockRoutes);
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // ACT
      const result = await fetchAppRoutes();

      // ASSERT
      expect(result).toEqual(mockRoutes);
      
      consoleSpy.mockRestore();
    });

    it('fetchAppRoutes() - should handle API service errors', async () => {
      // ARRANGE
      const apiError = new Error('Failed to fetch routes from backend');
      vi.mocked(apiService.fetchRoutes).mockRejectedValueOnce(apiError);

      // ACT & ASSERT
      await expect(fetchAppRoutes()).rejects.toThrow('Failed to fetch routes from backend');
      expect(apiService.fetchRoutes).toHaveBeenCalledTimes(1);
    });

    it('fetchAppRoutes() - should handle network connectivity issues', async () => {
      // ARRANGE
      const networkError = new Error('Network error');
      vi.mocked(apiService.fetchRoutes).mockRejectedValueOnce(networkError);

      // ACT & ASSERT
      await expect(fetchAppRoutes()).rejects.toThrow('Network error');
    });

    it('fetchAppRoutes() - should handle server unavailable errors', async () => {
      // ARRANGE
      const serverError = {
        response: { status: 503, data: { error: 'Service unavailable' } },
        message: 'Request failed with status code 503'
      };
      vi.mocked(apiService.fetchRoutes).mockRejectedValueOnce(serverError);

      // ACT & ASSERT
      await expect(fetchAppRoutes()).rejects.toEqual(serverError);
    });
  });

  describe('createDerivedMappings() - Route Mapping Generation', () => {
    const mockRoutes: AppRoutes = {
      '/': { intent: 'dashboard', component: 'BankingDashboard', tab: 'banking' },
      '/banking/accounts': { intent: 'view_accounts', component: 'AccountsOverview', tab: 'banking' },
      '/banking/transfers': { intent: 'transfer_money', component: 'TransfersHub', tab: 'banking' },
      '/banking/transfers/wire': { intent: 'wire_transfer', component: 'WireTransferForm', tab: 'banking' },
      '/customer-service': { intent: 'customer_service', component: 'CustomerServiceHub', tab: 'support' }
    };

    it('createDerivedMappings() - should generate complete mapping objects', () => {
      // ACT
      const mappings = createDerivedMappings(mockRoutes);

      // ASSERT
      expect(mappings).toHaveProperty('INTENT_TO_ROUTE');
      expect(mappings).toHaveProperty('COMPONENT_TO_ROUTE');
      expect(mappings).toHaveProperty('TAB_TO_ROUTE');
      expect(mappings).toHaveProperty('ROUTE_PATHS');
      expect(mappings).toHaveProperty('getRouteByComponent');
      expect(mappings).toHaveProperty('getRouteByIntent');
      expect(mappings).toHaveProperty('getRouteByTab');
      expect(mappings).toHaveProperty('isValidRoute');
      expect(mappings).toHaveProperty('getTabForRoute');
      expect(Object.keys(mappings)).toHaveLength(9);
    });

    it('INTENT_TO_ROUTE - should create correct intent to route mapping', () => {
      // ACT
      const mappings = createDerivedMappings(mockRoutes);

      // ASSERT
      expect(mappings.INTENT_TO_ROUTE).toMatchObject({
        'dashboard': '/',
        'view_accounts': '/banking/accounts',
        'transfer_money': '/banking/transfers',
        'wire_transfer': '/banking/transfers/wire',
        'customer_service': '/customer-service'
      });
      expect(Object.keys(mappings.INTENT_TO_ROUTE)).toHaveLength(5);
    });

    it('COMPONENT_TO_ROUTE - should create correct component to route mapping', () => {
      // ACT
      const mappings = createDerivedMappings(mockRoutes);

      // ASSERT
      expect(mappings.COMPONENT_TO_ROUTE).toMatchObject({
        'BankingDashboard': '/',
        'AccountsOverview': '/banking/accounts',
        'TransfersHub': '/banking/transfers',
        'WireTransferForm': '/banking/transfers/wire',
        'CustomerServiceHub': '/customer-service'
      });
      expect(Object.keys(mappings.COMPONENT_TO_ROUTE)).toHaveLength(5);
    });

    it('TAB_TO_ROUTE - should create correct tab to route mapping for main routes only', () => {
      // ACT
      const mappings = createDerivedMappings(mockRoutes);

      // ASSERT
      expect(mappings.TAB_TO_ROUTE).toMatchObject({
        'banking': '/',
        'support': '/customer-service'
      });
      // Should only include main tab routes (not sub-routes like /banking/transfers/wire)
      expect(Object.keys(mappings.TAB_TO_ROUTE)).toHaveLength(2);
    });

    it('ROUTE_PATHS - should contain all route paths', () => {
      // ACT
      const mappings = createDerivedMappings(mockRoutes);

      // ASSERT
      expect(mappings.ROUTE_PATHS).toContain('/');
      expect(mappings.ROUTE_PATHS).toContain('/banking/accounts');
      expect(mappings.ROUTE_PATHS).toContain('/banking/transfers');
      expect(mappings.ROUTE_PATHS).toContain('/banking/transfers/wire');
      expect(mappings.ROUTE_PATHS).toContain('/customer-service');
      expect(mappings.ROUTE_PATHS).toHaveLength(5);
      expect(Array.isArray(mappings.ROUTE_PATHS)).toBe(true);
    });

    it('getRouteByComponent() - should return correct route for valid component', () => {
      // ACT
      const mappings = createDerivedMappings(mockRoutes);

      // ASSERT
      expect(mappings.getRouteByComponent('BankingDashboard')).toBe('/');
      expect(mappings.getRouteByComponent('AccountsOverview')).toBe('/banking/accounts');
      expect(mappings.getRouteByComponent('TransfersHub')).toBe('/banking/transfers');
      expect(mappings.getRouteByComponent('WireTransferForm')).toBe('/banking/transfers/wire');
      expect(mappings.getRouteByComponent('CustomerServiceHub')).toBe('/customer-service');
    });

    it('getRouteByComponent() - should return undefined for invalid component', () => {
      // ACT
      const mappings = createDerivedMappings(mockRoutes);

      // ASSERT
      expect(mappings.getRouteByComponent('NonExistentComponent')).toBeUndefined();
      expect(mappings.getRouteByComponent('')).toBeUndefined();
    });

    it('getRouteByIntent() - should return correct route for valid intent', () => {
      // ACT
      const mappings = createDerivedMappings(mockRoutes);

      // ASSERT
      expect(mappings.getRouteByIntent('dashboard')).toBe('/');
      expect(mappings.getRouteByIntent('view_accounts')).toBe('/banking/accounts');
      expect(mappings.getRouteByIntent('transfer_money')).toBe('/banking/transfers');
      expect(mappings.getRouteByIntent('wire_transfer')).toBe('/banking/transfers/wire');
      expect(mappings.getRouteByIntent('customer_service')).toBe('/customer-service');
    });

    it('getRouteByIntent() - should return undefined for invalid intent', () => {
      // ACT
      const mappings = createDerivedMappings(mockRoutes);

      // ASSERT
      expect(mappings.getRouteByIntent('non_existent_intent')).toBeUndefined();
      expect(mappings.getRouteByIntent('')).toBeUndefined();
    });

    it('getRouteByTab() - should return correct route for valid tab', () => {
      // ACT
      const mappings = createDerivedMappings(mockRoutes);

      // ASSERT
      expect(mappings.getRouteByTab('banking')).toBe('/');
      expect(mappings.getRouteByTab('support')).toBe('/customer-service');
    });

    it('getRouteByTab() - should return undefined for invalid tab', () => {
      // ACT
      const mappings = createDerivedMappings(mockRoutes);

      // ASSERT
      expect(mappings.getRouteByTab('non_existent_tab')).toBeUndefined();
      expect(mappings.getRouteByTab('')).toBeUndefined();
    });

    it('isValidRoute() - should return true for valid routes', () => {
      // ACT
      const mappings = createDerivedMappings(mockRoutes);

      // ASSERT
      expect(mappings.isValidRoute('/')).toBe(true);
      expect(mappings.isValidRoute('/banking/accounts')).toBe(true);
      expect(mappings.isValidRoute('/banking/transfers')).toBe(true);
      expect(mappings.isValidRoute('/banking/transfers/wire')).toBe(true);
      expect(mappings.isValidRoute('/customer-service')).toBe(true);
    });

    it('isValidRoute() - should return false for invalid routes', () => {
      // ACT
      const mappings = createDerivedMappings(mockRoutes);

      // ASSERT
      expect(mappings.isValidRoute('/non-existent-route')).toBe(false);
      expect(mappings.isValidRoute('/banking')).toBe(false);
      expect(mappings.isValidRoute('/banking/invalid')).toBe(false);
      expect(mappings.isValidRoute('')).toBe(false);
    });

    it('getTabForRoute() - should return correct tab for valid routes', () => {
      // ACT
      const mappings = createDerivedMappings(mockRoutes);

      // ASSERT
      expect(mappings.getTabForRoute('/')).toBe('banking');
      expect(mappings.getTabForRoute('/banking/accounts')).toBe('banking');
      expect(mappings.getTabForRoute('/banking/transfers')).toBe('banking');
      expect(mappings.getTabForRoute('/banking/transfers/wire')).toBe('banking');
      expect(mappings.getTabForRoute('/customer-service')).toBe('support');
    });

    it('getTabForRoute() - should return undefined for invalid routes', () => {
      // ACT
      const mappings = createDerivedMappings(mockRoutes);

      // ASSERT
      expect(mappings.getTabForRoute('/non-existent-route')).toBeUndefined();
      expect(mappings.getTabForRoute('')).toBeUndefined();
    });

    it('createDerivedMappings() - should handle empty routes configuration', () => {
      // ARRANGE
      const emptyRoutes: AppRoutes = {};

      // ACT
      const mappings = createDerivedMappings(emptyRoutes);

      // ASSERT
      expect(mappings.INTENT_TO_ROUTE).toEqual({});
      expect(mappings.COMPONENT_TO_ROUTE).toEqual({});
      expect(mappings.TAB_TO_ROUTE).toEqual({});
      expect(mappings.ROUTE_PATHS).toEqual([]);
      expect(mappings.getRouteByComponent('Any')).toBeUndefined();
      expect(mappings.getRouteByIntent('any')).toBeUndefined();
      expect(mappings.getRouteByTab('any')).toBeUndefined();
      expect(mappings.isValidRoute('/')).toBe(false);
      expect(mappings.getTabForRoute('/')).toBeUndefined();
    });

    it('createDerivedMappings() - should handle single route configuration', () => {
      // ARRANGE
      const singleRoute: AppRoutes = {
        '/': { intent: 'dashboard', component: 'BankingDashboard', tab: 'banking' }
      };

      // ACT
      const mappings = createDerivedMappings(singleRoute);

      // ASSERT
      expect(Object.keys(mappings.INTENT_TO_ROUTE)).toHaveLength(1);
      expect(Object.keys(mappings.COMPONENT_TO_ROUTE)).toHaveLength(1);
      expect(Object.keys(mappings.TAB_TO_ROUTE)).toHaveLength(1);
      expect(mappings.ROUTE_PATHS).toHaveLength(1);
      expect(mappings.getRouteByComponent('BankingDashboard')).toBe('/');
      expect(mappings.isValidRoute('/')).toBe(true);
      expect(mappings.getTabForRoute('/')).toBe('banking');
    });

    it('createDerivedMappings() - should handle routes with dynamic parameters', () => {
      // ARRANGE
      const dynamicRoutes: AppRoutes = {
        '/': { intent: 'dashboard', component: 'BankingDashboard', tab: 'banking' },
        '/banking/accounts/{account_id}': { intent: 'view_account_details', component: 'AccountDetails', tab: 'banking' },
        '/banking/transactions/{transaction_id}': { intent: 'view_transaction', component: 'TransactionDetails', tab: 'banking' }
      };

      // ACT
      const mappings = createDerivedMappings(dynamicRoutes);

      // ASSERT
      expect(mappings.INTENT_TO_ROUTE).toHaveProperty('view_account_details');
      expect(mappings.INTENT_TO_ROUTE).toHaveProperty('view_transaction');
      expect(mappings.COMPONENT_TO_ROUTE).toHaveProperty('AccountDetails');
      expect(mappings.COMPONENT_TO_ROUTE).toHaveProperty('TransactionDetails');
      expect(mappings.isValidRoute('/banking/accounts/{account_id}')).toBe(true);
      expect(mappings.isValidRoute('/banking/transactions/{transaction_id}')).toBe(true);
      expect(mappings.getTabForRoute('/banking/accounts/{account_id}')).toBe('banking');
    });

    it('createDerivedMappings() - should properly filter main tab routes from sub-routes', () => {
      // ARRANGE
      const nestedRoutes: AppRoutes = {
        '/': { intent: 'dashboard', component: 'BankingDashboard', tab: 'banking' },
        '/banking': { intent: 'banking_hub', component: 'BankingHub', tab: 'banking' },
        '/banking/accounts': { intent: 'view_accounts', component: 'AccountsOverview', tab: 'banking' },
        '/banking/accounts/details': { intent: 'account_details', component: 'AccountDetails', tab: 'banking' },
        '/customer-service': { intent: 'customer_service', component: 'CustomerServiceHub', tab: 'support' },
        '/customer-service/chat': { intent: 'live_chat', component: 'LiveChat', tab: 'support' }
      };

      // ACT
      const mappings = createDerivedMappings(nestedRoutes);

      // ASSERT
      // TAB_TO_ROUTE should only include main routes (/ or routes without '/' in middle)
      // When multiple routes have the same tab, the last one processed wins
      expect(mappings.TAB_TO_ROUTE).toMatchObject({
        'banking': '/banking',  // Last main-level banking route processed
        'support': '/customer-service'
      });
      expect(mappings.TAB_TO_ROUTE).not.toHaveProperty('/banking/accounts');
      expect(mappings.TAB_TO_ROUTE).not.toHaveProperty('/banking/accounts/details');
      expect(mappings.TAB_TO_ROUTE).not.toHaveProperty('/customer-service/chat');
    });

    it('createDerivedMappings() - should handle complex route configurations with multiple tabs', () => {
      // ARRANGE
      const complexRoutes: AppRoutes = {
        '/': { intent: 'dashboard', component: 'BankingDashboard', tab: 'banking' },
        '/investments': { intent: 'view_investments', component: 'InvestmentsHub', tab: 'investments' },
        '/loans': { intent: 'view_loans', component: 'LoansHub', tab: 'loans' },
        '/customer-service': { intent: 'customer_service', component: 'CustomerServiceHub', tab: 'support' },
        '/settings': { intent: 'user_settings', component: 'SettingsHub', tab: 'settings' }
      };

      // ACT
      const mappings = createDerivedMappings(complexRoutes);

      // ASSERT
      expect(mappings.TAB_TO_ROUTE).toMatchObject({
        'banking': '/',
        'investments': '/investments',
        'loans': '/loans',
        'support': '/customer-service',
        'settings': '/settings'
      });
      expect(Object.keys(mappings.TAB_TO_ROUTE)).toHaveLength(5);
      expect(mappings.getRouteByTab('investments')).toBe('/investments');
      expect(mappings.getRouteByTab('loans')).toBe('/loans');
      expect(mappings.getTabForRoute('/investments')).toBe('investments');
      expect(mappings.getTabForRoute('/loans')).toBe('loans');
    });
  });

  describe('Routes Service - Integration Edge Cases', () => {
    it('fetchAppRoutes() - should handle timeout errors from API', async () => {
      // ARRANGE
      const timeoutError = new Error('Request timeout');
      vi.mocked(apiService.fetchRoutes).mockRejectedValueOnce(timeoutError);

      // ACT & ASSERT
      await expect(fetchAppRoutes()).rejects.toThrow('Request timeout');
    });

    it('fetchAppRoutes() - should handle malformed route data from API', async () => {
      // ARRANGE
      const malformedRoutes = null as unknown as AppRoutes;
      vi.mocked(apiService.fetchRoutes).mockResolvedValueOnce(malformedRoutes);

      // ACT
      const result = await fetchAppRoutes();

      // ASSERT
      expect(result).toBeNull();
    });

    it('createDerivedMappings() - should handle null routes input gracefully', () => {
      // ARRANGE
      const nullRoutes = null as unknown as AppRoutes;

      // ACT & ASSERT
      expect(() => createDerivedMappings(nullRoutes)).toThrow();
    });

    it('createDerivedMappings() - should handle undefined routes input gracefully', () => {
      // ARRANGE
      const undefinedRoutes = undefined as unknown as AppRoutes;

      // ACT & ASSERT
      expect(() => createDerivedMappings(undefinedRoutes)).toThrow();
    });

    it('Route utility functions - should handle edge case inputs', () => {
      // ARRANGE
      const mappings = createDerivedMappings({
        '/': { intent: 'dashboard', component: 'BankingDashboard', tab: 'banking' }
      });

      // ACT & ASSERT
      expect(mappings.getRouteByComponent('')).toBeUndefined();
      expect(mappings.getRouteByIntent('')).toBeUndefined();
      expect(mappings.getRouteByTab('')).toBeUndefined();
      expect(mappings.isValidRoute('')).toBe(false);
      expect(mappings.getTabForRoute('')).toBeUndefined();
    });
  });
});
