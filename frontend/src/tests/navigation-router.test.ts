import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAppRoutes, createDerivedMappings } from '../services/routes';
import type { UIAssistance, AppRoutes } from '../types';

// Import for accessing mocked services
import { apiService } from '../services/api';

// Mock the API service
vi.mock('../services/api', () => ({
  apiService: {
    fetchRoutes: vi.fn()
  }
}));

/**
 * Dynamic Navigation Router System Tests
 * 
 * Tests the React Router-based navigation system with dynamic routes including:
 * - Dynamic route fetching from backend
 * - Route configuration and mapping generation  
 * - Navigation utilities and validation
 * - UI assistance routing logic
 * - Browser navigation support
 */

describe('Dynamic Navigation Router System', () => {
  // Sample dynamic routes for testing
  const mockDynamicRoutes: AppRoutes = {
    '/': { intent: 'dashboard', component: 'BankingDashboard', tab: 'banking' },
    '/banking/accounts': { intent: 'view_accounts', component: 'AccountsOverview', tab: 'banking' },
    '/banking/transfers': { intent: 'transfer_money', component: 'TransfersHub', tab: 'banking' },
    '/banking/transfers/wire': { intent: 'wire_transfer', component: 'WireTransferForm', tab: 'banking' },
    '/banking/payments/bills': { intent: 'pay_bills', component: 'BillPayHub', tab: 'banking' },
    '/customer-service': { intent: 'customer_service', component: 'CustomerServiceHub', tab: 'support' },
    '/chat': { intent: 'chat_assistant', component: 'ChatPanel', tab: 'chat' }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Dynamic Route System - Module Structure', () => {
    it('fetchAppRoutes() - should verify React Router dependencies are available', async () => {
      // Verify React Router dependencies are available
      const router = await import('react-router-dom');
      expect(router.BrowserRouter).toBeDefined();
      expect(router.Routes).toBeDefined(); 
      expect(router.Route).toBeDefined();
      expect(router.useNavigate).toBeDefined();
    });

    it('fetchAppRoutes() - should fetch routes from backend API', async () => {
      // ARRANGE
      vi.mocked(apiService.fetchRoutes).mockResolvedValueOnce(mockDynamicRoutes);

      // ACT
      const routes = await fetchAppRoutes();

      // ASSERT
      expect(apiService.fetchRoutes).toHaveBeenCalledTimes(1);
      expect(routes).toEqual(mockDynamicRoutes);
      expect(typeof routes).toBe('object');
    });

    it('createDerivedMappings() - should generate complete mapping structure', async () => {
      // ARRANGE & ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

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
    });
  });

  describe('Dynamic Route Definition - Path Mapping', () => {
    it('createDerivedMappings() - should define all required application routes', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const requiredRoutes = [
        // Main tab routes
        '/',                        // BankingDashboard
        '/chat',                    // ChatPanel
        '/customer-service',        // CustomerServiceHub
        // Banking sub-routes
        '/banking/accounts',        // AccountsOverview
        '/banking/transfers',       // TransfersHub  
        '/banking/transfers/wire',  // WireTransferForm
        '/banking/payments/bills'   // BillPayHub
      ];

      requiredRoutes.forEach(route => {
        expect(mockDynamicRoutes[route]).toBeDefined();
        expect(mappings.isValidRoute(route)).toBe(true);
        
        const routeConfig = mockDynamicRoutes[route];
        expect(routeConfig.component).toBeTruthy();
        expect(routeConfig.intent).toBeTruthy();
        expect(routeConfig.tab).toBeTruthy();
        expect(typeof routeConfig.component).toBe('string');
        expect(typeof routeConfig.intent).toBe('string');
        expect(typeof routeConfig.tab).toBe('string');
      });
    });

    it('createDerivedMappings() - should have correct route count', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const routeCount = mappings.ROUTE_PATHS.length;
      expect(routeCount).toBe(7);
    });

    it('createDerivedMappings() - should have valid route structure', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      mappings.ROUTE_PATHS.forEach(path => {
        // Path validation
        expect(path.startsWith('/')).toBe(true);
        expect(path).not.toContain('..');
        expect(path).not.toContain('//');
        
        // Config validation
        const config = mockDynamicRoutes[path];
        expect(config.component).toBeTruthy();
        expect(config.intent).toBeTruthy();
        expect(config.tab).toBeTruthy();
        expect(typeof config.component).toBe('string');
        expect(typeof config.intent).toBe('string');
        expect(typeof config.tab).toBe('string');
      });
    });
  });

  describe('Dynamic Intent Mapping - Backend Integration', () => {
    it('INTENT_TO_ROUTE - should map intents to correct routes', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const intentMappings = [
        // Main tab routes
        { intent: 'dashboard', route: '/' },
        { intent: 'chat_assistant', route: '/chat' },
        { intent: 'customer_service', route: '/customer-service' },
        // Banking sub-routes
        { intent: 'view_accounts', route: '/banking/accounts' },
        { intent: 'transfer_money', route: '/banking/transfers' },
        { intent: 'wire_transfer', route: '/banking/transfers/wire' },
        { intent: 'pay_bills', route: '/banking/payments/bills' }
      ];

      intentMappings.forEach(({ intent, route }) => {
        expect(mappings.INTENT_TO_ROUTE[intent]).toBe(route);
      });
    });

    it('INTENT_TO_ROUTE - should have bidirectional mapping consistency', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      Object.entries(mappings.INTENT_TO_ROUTE).forEach(([intent, route]) => {
        expect(mockDynamicRoutes[route]).toBeDefined();
        expect(mockDynamicRoutes[route].intent).toBe(intent);
      });
    });

    it('INTENT_TO_ROUTE - should have complete intent coverage', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const intentCount = Object.keys(mappings.INTENT_TO_ROUTE).length;
      const routeCount = mappings.ROUTE_PATHS.length;
      expect(intentCount).toBe(routeCount);
    });
  });

  describe('Dynamic Component Mapping - Frontend Integration', () => {
    it('COMPONENT_TO_ROUTE - should map component names to correct routes', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const componentMappings = [
        // Main tab routes
        { component: 'BankingDashboard', route: '/' },
        { component: 'ChatPanel', route: '/chat' },
        { component: 'CustomerServiceHub', route: '/customer-service' },
        // Banking sub-routes
        { component: 'AccountsOverview', route: '/banking/accounts' },
        { component: 'TransfersHub', route: '/banking/transfers' },
        { component: 'WireTransferForm', route: '/banking/transfers/wire' },
        { component: 'BillPayHub', route: '/banking/payments/bills' }
      ];

      componentMappings.forEach(({ component, route }) => {
        expect(mappings.COMPONENT_TO_ROUTE[component]).toBe(route);
      });
    });

    it('COMPONENT_TO_ROUTE - should have component-route consistency', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      Object.entries(mappings.COMPONENT_TO_ROUTE).forEach(([component, route]) => {
        expect(mockDynamicRoutes[route]).toBeDefined();
        expect(mockDynamicRoutes[route].component).toBe(component);
      });
    });

    it('COMPONENT_TO_ROUTE - should have complete component coverage', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const componentCount = Object.keys(mappings.COMPONENT_TO_ROUTE).length;
      const routeCount = mappings.ROUTE_PATHS.length;
      expect(componentCount).toBe(routeCount);
    });
  });

  describe('Dynamic Tab Mapping - UI Integration', () => {
    it('TAB_TO_ROUTE - should map tab names to correct main routes', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const tabMappings = [
        { tab: 'banking', route: '/' },
        { tab: 'chat', route: '/chat' },
        { tab: 'support', route: '/customer-service' }
      ];

      tabMappings.forEach(({ tab, route }) => {
        expect(mappings.TAB_TO_ROUTE[tab]).toBe(route);
      });
    });

    it('TAB_TO_ROUTE - should have tab-route consistency', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      Object.entries(mappings.TAB_TO_ROUTE).forEach(([tab, route]) => {
        expect(mockDynamicRoutes[route]).toBeDefined();
        expect(mockDynamicRoutes[route].tab).toBe(tab);
      });
    });

    it('TAB_TO_ROUTE - should only include main tab routes, not sub-routes', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      // Should not include sub-routes like /banking/transfers or /banking/accounts
      expect(mappings.TAB_TO_ROUTE).not.toHaveProperty('/banking/transfers');
      expect(mappings.TAB_TO_ROUTE).not.toHaveProperty('/banking/accounts');
      expect(mappings.TAB_TO_ROUTE).not.toHaveProperty('/banking/payments/bills');
      
      // Should only have main routes for each tab
      expect(Object.keys(mappings.TAB_TO_ROUTE)).toHaveLength(3);
    });
  });

  describe('getRouteByComponent() - Utility Function', () => {
    it('getRouteByComponent() - should return correct routes for valid components', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const testCases = [
        // Main tab components
        { component: 'BankingDashboard', expected: '/' },
        { component: 'ChatPanel', expected: '/chat' },
        { component: 'CustomerServiceHub', expected: '/customer-service' },
        // Banking sub-components  
        { component: 'AccountsOverview', expected: '/banking/accounts' },
        { component: 'TransfersHub', expected: '/banking/transfers' },
        { component: 'WireTransferForm', expected: '/banking/transfers/wire' },
        { component: 'BillPayHub', expected: '/banking/payments/bills' }
      ];

      testCases.forEach(({ component, expected }) => {
        expect(mappings.getRouteByComponent(component)).toBe(expected);
      });
    });

    it('getRouteByComponent() - should return undefined for invalid components', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const invalidComponents = [
        'InvalidComponent',
        'NonExistentScreen',
        '',
        'null',
        'undefined'
      ];

      invalidComponents.forEach(component => {
        expect(mappings.getRouteByComponent(component)).toBeUndefined();
      });
    });

    it('getRouteByComponent() - should handle edge cases safely', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      expect(mappings.getRouteByComponent('')).toBeUndefined();
      expect(mappings.getRouteByComponent('  ')).toBeUndefined();
      expect(mappings.getRouteByComponent('ACCOUNTSOVERVIEW')).toBeUndefined(); // Case sensitive
    });
  });

  describe('getRouteByIntent() - Intent Utility Function', () => {
    it('getRouteByIntent() - should return correct routes for valid intents', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const testCases = [
        { intent: 'dashboard', expected: '/' },
        { intent: 'chat_assistant', expected: '/chat' },
        { intent: 'customer_service', expected: '/customer-service' },
        { intent: 'view_accounts', expected: '/banking/accounts' },
        { intent: 'transfer_money', expected: '/banking/transfers' }
      ];

      testCases.forEach(({ intent, expected }) => {
        expect(mappings.getRouteByIntent(intent)).toBe(expected);
      });
    });

    it('getRouteByIntent() - should return undefined for invalid intents', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const invalidIntents = ['invalid', 'nonexistent', '', 'null', 'undefined'];

      invalidIntents.forEach(intent => {
        expect(mappings.getRouteByIntent(intent)).toBeUndefined();
      });
    });
  });

  describe('getRouteByTab() - Tab Utility Function', () => {
    it('getRouteByTab() - should return correct routes for valid tabs', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const testCases = [
        { tab: 'banking', expected: '/' },
        { tab: 'chat', expected: '/chat' },
        { tab: 'support', expected: '/customer-service' }
      ];

      testCases.forEach(({ tab, expected }) => {
        expect(mappings.getRouteByTab(tab)).toBe(expected);
      });
    });

    it('getRouteByTab() - should return undefined for invalid tabs', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const invalidTabs = ['invalid', 'nonexistent', '', 'null', 'undefined'];

      invalidTabs.forEach(tab => {
        expect(mappings.getRouteByTab(tab)).toBeUndefined();
      });
    });
  });

  describe('getTabForRoute() - Route-to-Tab Utility Function', () => {
    it('getTabForRoute() - should return correct tabs for valid routes', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const testCases = [
        { route: '/', expected: 'banking' },
        { route: '/chat', expected: 'chat' },
        { route: '/customer-service', expected: 'support' },
        { route: '/banking/accounts', expected: 'banking' },
        { route: '/banking/transfers', expected: 'banking' }
      ];

      testCases.forEach(({ route, expected }) => {
        expect(mappings.getTabForRoute(route)).toBe(expected);
      });
    });

    it('getTabForRoute() - should return undefined for invalid routes', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const invalidRoutes = ['/invalid', '/nonexistent', '', 'null', 'undefined'];

      invalidRoutes.forEach(route => {
        expect(mappings.getTabForRoute(route)).toBeUndefined();
      });
    });
  });

  describe('isValidRoute() - Validation Function', () => {
    it('isValidRoute() - should validate existing routes as true', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const validRoutes = [
        // Main tab routes
        '/',
        '/chat',
        '/customer-service', 
        // Banking sub-routes
        '/banking/accounts',
        '/banking/transfers', 
        '/banking/transfers/wire',
        '/banking/payments/bills'
      ];

      validRoutes.forEach(route => {
        expect(mappings.isValidRoute(route)).toBe(true);
      });
    });

    it('isValidRoute() - should validate non-existing routes as false', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const invalidRoutes = [
        '/invalid/route',
        '/banking', // Not a defined route (/ is the banking dashboard)
        '/banking/transfers/domestic',
        '/banking/accounts/details',
        '',
        '/random/path',
        '/chats', // Typo
        '/transactions' // Typo
      ];

      invalidRoutes.forEach(route => {
        expect(mappings.isValidRoute(route)).toBe(false);
      });
    });

    it('isValidRoute() - should handle malformed inputs safely', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      const malformedInputs = [
        '',
        '   ',
        '/invalid'
      ];

      malformedInputs.forEach(input => {
        expect(mappings.isValidRoute(input)).toBe(false);
      });
    });
  });

  describe('handleUIAssistance() - Navigation Logic', () => {
    // Simulate the navigation logic from the main app using dynamic routes
    const simulateNavigationLogic = (uiAssistance: Partial<UIAssistance>, routes: AppRoutes) => {
      const mappings = createDerivedMappings(routes);
      
      if (uiAssistance && uiAssistance.type === 'navigation') {
        let routePath: string | undefined;
        
        // Route_path takes precedence
        if (uiAssistance.route_path && mappings.isValidRoute(uiAssistance.route_path)) {
          routePath = uiAssistance.route_path;
        }
        // Fallback to component name mapping
        else if (uiAssistance.component_name) {
          routePath = mappings.getRouteByComponent(uiAssistance.component_name);
        }
        
        return routePath;
      }
      return undefined;
    };

    it('handleUIAssistance() - should prioritize route_path over component_name when valid', () => {
      // ARRANGE
      const assistance: Partial<UIAssistance> = {
        type: 'navigation',
        route_path: '/banking/accounts',
        component_name: 'TransfersHub', // Different component
        title: 'Accounts'
      };

      // ACT
      const result = simulateNavigationLogic(assistance, mockDynamicRoutes);

      // ASSERT
      expect(result).toBe('/banking/accounts'); // Should use route_path
    });

    it('handleUIAssistance() - should fallback to component_name when route_path invalid', () => {
      // ARRANGE
      const assistance: Partial<UIAssistance> = {
        type: 'navigation', 
        route_path: '/invalid/path',
        component_name: 'AccountsOverview',
        title: 'Accounts'
      };

      // ACT
      const result = simulateNavigationLogic(assistance, mockDynamicRoutes);

      // ASSERT
      expect(result).toBe('/banking/accounts'); // Should use component mapping
    });

    it('handleUIAssistance() - should handle all navigation components correctly', () => {
      // ARRANGE
      const testCases = [
        {
          name: 'AccountsOverview navigation',
          assistance: {
            type: 'navigation' as const,
            component_name: 'AccountsOverview',
            title: 'Accounts Overview'
          },
          expected: '/banking/accounts'
        },
        {
          name: 'TransfersHub navigation', 
          assistance: {
            type: 'navigation' as const,
            component_name: 'TransfersHub',
            title: 'Transfers Hub'
          },
          expected: '/banking/transfers'
        },
        {
          name: 'WireTransferForm navigation',
          assistance: {
            type: 'navigation' as const,
            component_name: 'WireTransferForm', 
            title: 'Wire Transfer'
          },
          expected: '/banking/transfers/wire'
        },
        {
          name: 'BillPayHub navigation',
          assistance: {
            type: 'navigation' as const,
            component_name: 'BillPayHub',
            title: 'Bill Pay'
          },
          expected: '/banking/payments/bills'
        }
      ];

      // ACT & ASSERT
      testCases.forEach(({ assistance, expected }) => {
        const result = simulateNavigationLogic(assistance, mockDynamicRoutes);
        expect(result).toBe(expected);
      });
    });

    it('handleUIAssistance() - should return undefined for invalid navigation requests', () => {
      // ARRANGE
      const invalidCases = [
        {
          name: 'Invalid route and component',
          assistance: {
            type: 'navigation' as const,
            route_path: '/invalid/route',
            component_name: 'InvalidComponent',
            title: 'Invalid'
          }
        },
        {
          name: 'Non-navigation type',
          assistance: {
            type: 'transaction_form' as never,
            component_name: 'AccountsOverview',
            title: 'Form'
          }
        },
        {
          name: 'Missing navigation data',
          assistance: {
            type: 'navigation' as const,
            title: 'Navigation'
          }
        }
      ];

      // ACT & ASSERT
      invalidCases.forEach(({ assistance }) => {
        const result = simulateNavigationLogic(assistance, mockDynamicRoutes);
        expect(result).toBeUndefined();
      });
    });
  });

  describe('Browser Navigation Support', () => {
    it('createDerivedMappings() - should have proper route structure for browser navigation', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);
      
      // ASSERT
      mappings.ROUTE_PATHS.forEach(route => {
        // Routes should be absolute paths
        expect(route.startsWith('/')).toBe(true);
        // No relative navigation patterns
        expect(route).not.toContain('..');
        // No double slashes
        expect(route).not.toContain('//');
      });
    });

    it('createDerivedMappings() - should support semantic, bookmarkable URLs', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);
      
      // ASSERT
      // Should not expose implementation details
      mappings.ROUTE_PATHS.forEach(route => {
        expect(route).not.toContain('screen');
        expect(route).not.toContain('component');
        expect(route).not.toContain('page');
        expect(route).not.toContain('view');
      });

      // Should have logical URL structure
      expect(mappings.ROUTE_PATHS).toContain('/'); // Root banking dashboard
      expect(mappings.ROUTE_PATHS).toContain('/chat'); // Chat tab
      expect(mappings.ROUTE_PATHS).toContain('/customer-service'); // Support tab
      
      // Banking sub-routes should be hierarchical
      const bankingRoutes = mappings.ROUTE_PATHS.filter(route => route.startsWith('/banking'));
      expect(bankingRoutes.length).toBeGreaterThan(0);
      bankingRoutes.forEach(route => {
        expect(route).toMatch(/^\/banking\/[a-z]+/);
      });
    });

    it('createDerivedMappings() - should have hierarchical URL structure', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);
      
      // ASSERT
      // Check hierarchical structure
      expect(mappings.ROUTE_PATHS).toContain('/banking/accounts');
      expect(mappings.ROUTE_PATHS).toContain('/banking/transfers');
      expect(mappings.ROUTE_PATHS).toContain('/banking/transfers/wire'); // Nested under transfers
      expect(mappings.ROUTE_PATHS).toContain('/banking/payments/bills'); // Under payments
      
      // Verify proper nesting
      const transfersRoutes = mappings.ROUTE_PATHS.filter(route => route.startsWith('/banking/transfers'));
      expect(transfersRoutes.length).toBeGreaterThan(1); // Base + nested routes
    });
  });

  describe('System Integration - End-to-End Validation', () => {
    it('createDerivedMappings() - should meet all navigation system requirements', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      // All components have route mappings
      const componentRouteMapping = [
        'BankingDashboard',
        'ChatPanel',
        'CustomerServiceHub',
        'AccountsOverview',
        'TransfersHub', 
        'WireTransferForm',
        'BillPayHub'
      ].every(component => mappings.getRouteByComponent(component) !== undefined);
      
      expect(componentRouteMapping).toBe(true);

      // URLs are bookmarkable (semantic paths)
      const bookmarkableUrls = mappings.ROUTE_PATHS.every(route => {
        return !route.includes('component') && 
               !route.includes('screen') &&
               route.startsWith('/');
      });
      
      expect(bookmarkableUrls).toBe(true);

      // Complete system coverage
      expect(mappings.ROUTE_PATHS).toHaveLength(7);
      expect(Object.keys(mappings.INTENT_TO_ROUTE)).toHaveLength(7);
      expect(Object.keys(mappings.COMPONENT_TO_ROUTE)).toHaveLength(7);
      expect(Object.keys(mappings.TAB_TO_ROUTE)).toHaveLength(3);
    });

    it('createDerivedMappings() - should maintain consistency across all mapping systems', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);
      
      // ASSERT
      // Every route should have corresponding intent and component mappings
      mappings.ROUTE_PATHS.forEach(route => {
        const routeConfig = mockDynamicRoutes[route];
        
        // Intent mapping consistency
        expect(mappings.INTENT_TO_ROUTE[routeConfig.intent]).toBe(route);
        
        // Component mapping consistency  
        expect(mappings.COMPONENT_TO_ROUTE[routeConfig.component]).toBe(route);
        
        // Route validation consistency
        expect(mappings.isValidRoute(route)).toBe(true);
        
        // Component lookup consistency
        expect(mappings.getRouteByComponent(routeConfig.component)).toBe(route);
        
        // Tab mapping consistency
        expect(mappings.getTabForRoute(route)).toBe(routeConfig.tab);
      });
    });

    it('createDerivedMappings() - should handle all expected navigation scenarios', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);
      
      // ARRANGE
      const simulateNavigationLogic = (uiAssistance: Partial<UIAssistance>) => {
        if (uiAssistance && uiAssistance.type === 'navigation') {
          let routePath: string | undefined;
          
          // Route_path takes precedence
          if (uiAssistance.route_path && mappings.isValidRoute(uiAssistance.route_path)) {
            routePath = uiAssistance.route_path;
          }
          // Fallback to component name mapping
          else if (uiAssistance.component_name) {
            routePath = mappings.getRouteByComponent(uiAssistance.component_name);
          }
          
          return routePath;
        }
        return undefined;
      };

      // ASSERT
      // Test realistic navigation scenarios
      const scenarios = [
        {
          name: 'Backend route_path navigation',
          input: { route_path: '/banking/accounts', component_name: 'AccountsOverview' },
          expected: '/banking/accounts'
        },
        {
          name: 'Frontend component navigation', 
          input: { component_name: 'TransfersHub' },
          expected: '/banking/transfers'
        },
        {
          name: 'Deep link navigation',
          input: { route_path: '/banking/transfers/wire' },
          expected: '/banking/transfers/wire'
        },
        {
          name: 'Intent-based navigation',
          intent: 'pay_bills',
          expected: '/banking/payments/bills'
        }
      ];

      scenarios.forEach(scenario => {
        if ('input' in scenario) {
          const result = simulateNavigationLogic({
            type: 'navigation',
            ...scenario.input,
            title: 'Test'
          });
          expect(result).toBe(scenario.expected);
        }
        
        if ('intent' in scenario) {
          expect(mappings.INTENT_TO_ROUTE[scenario.intent]).toBe(scenario.expected);
        }
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('createDerivedMappings() - should handle utility function edge cases safely', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      // getRouteByComponent edge cases
      expect(mappings.getRouteByComponent('')).toBeUndefined();
      expect(mappings.getRouteByComponent(' ')).toBeUndefined();
      expect(mappings.getRouteByComponent('invalid')).toBeUndefined();
      
      // isValidRoute edge cases
      expect(mappings.isValidRoute('')).toBe(false);
      expect(mappings.isValidRoute(' ')).toBe(false);
      expect(mappings.isValidRoute('/invalid')).toBe(false);
    });

    it('fetchAppRoutes() - should handle malformed navigation assistance', async () => {
      // ARRANGE
      const mappings = createDerivedMappings(mockDynamicRoutes);
      
      const simulateNavigationLogic = (uiAssistance: UIAssistance) => {
        if (uiAssistance && uiAssistance.type === 'navigation') {
          let routePath: string | undefined;
          
          if (uiAssistance.route_path && mappings.isValidRoute(uiAssistance.route_path)) {
            routePath = uiAssistance.route_path;
          }
          else if (uiAssistance.component_name) {
            routePath = mappings.getRouteByComponent(uiAssistance.component_name);
          }
          
          return routePath;
        }
        return undefined;
      };

      const malformedCases = [
        {},
        { type: 'invalid' },
        { type: 'navigation' },
        { type: 'navigation', route_path: '', component_name: '' },
        null,
        undefined
      ];

      // ACT & ASSERT
      malformedCases.forEach(assistance => {
        const result = simulateNavigationLogic(assistance);
        expect(result).toBeUndefined();
      });
    });

    it('createDerivedMappings() - should validate route configuration integrity', () => {
      // ACT
      const mappings = createDerivedMappings(mockDynamicRoutes);

      // ASSERT
      // No duplicate routes
      const routes = mappings.ROUTE_PATHS;
      const uniqueRoutes = [...new Set(routes)];
      expect(routes.length).toBe(uniqueRoutes.length);

      // No duplicate components
      const components = Object.values(mockDynamicRoutes).map(config => config.component);
      const uniqueComponents = [...new Set(components)];
      expect(components.length).toBe(uniqueComponents.length);

      // No duplicate intents
      const intents = Object.values(mockDynamicRoutes).map(config => config.intent);
      const uniqueIntents = [...new Set(intents)];
      expect(intents.length).toBe(uniqueIntents.length);
    });

    it('fetchAppRoutes() - should handle dynamic route loading errors gracefully', async () => {
      // ARRANGE
      const routeLoadError = new Error('Failed to load dynamic routes');
      vi.mocked(apiService.fetchRoutes).mockRejectedValueOnce(routeLoadError);

      // ACT & ASSERT
      await expect(fetchAppRoutes()).rejects.toThrow('Failed to load dynamic routes');
      expect(apiService.fetchRoutes).toHaveBeenCalledTimes(1);
    });

    it('createDerivedMappings() - should handle empty routes configuration', () => {
      // ARRANGE
      const emptyRoutes: AppRoutes = {};

      // ACT
      const mappings = createDerivedMappings(emptyRoutes);

      // ASSERT
      expect(mappings.ROUTE_PATHS).toEqual([]);
      expect(mappings.INTENT_TO_ROUTE).toEqual({});
      expect(mappings.COMPONENT_TO_ROUTE).toEqual({});
      expect(mappings.TAB_TO_ROUTE).toEqual({});
      expect(mappings.isValidRoute('/')).toBe(false);
    });
  });
});