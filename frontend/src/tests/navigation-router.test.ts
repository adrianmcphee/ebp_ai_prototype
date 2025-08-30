import { describe, it, expect } from 'vitest';
import { getRouteByComponent, getRouteByTab, getTabForRoute, isValidRoute, APP_ROUTES, INTENT_TO_ROUTE, COMPONENT_TO_ROUTE, TAB_TO_ROUTE } from '../config/routes';
import type { UIAssistance } from '../types';

/**
 * Navigation Router System Tests
 * 
 * Tests the React Router-based navigation system including:
 * - Route configuration and mapping
 * - Navigation utilities and validation
 * - UI assistance routing logic
 * - Browser navigation support
 */

// Simulate the navigation logic from the main app
const simulateNavigationLogic = (uiAssistance: Partial<UIAssistance>) => {
  if (uiAssistance && uiAssistance.type === 'navigation') {
    let routePath: string | undefined;
    
    // Route_path takes precedence
    if (uiAssistance.route_path && isValidRoute(uiAssistance.route_path)) {
      routePath = uiAssistance.route_path;
    }
    // Fallback to component name mapping
    else if (uiAssistance.component_name) {
      routePath = getRouteByComponent(uiAssistance.component_name);
    }
    
    return routePath;
  }
  return undefined;
};

describe('Navigation Router System', () => {

  describe('Router Configuration - Module Structure', () => {
    it('should export all required navigation constants', async () => {
      // Verify React Router dependencies are available
      const router = await import('react-router-dom');
      expect(router.BrowserRouter).toBeDefined();
      expect(router.Routes).toBeDefined(); 
      expect(router.Route).toBeDefined();
      expect(router.useNavigate).toBeDefined();
    });

    it('should have complete route configuration structure', () => {
      expect(APP_ROUTES).toBeDefined();
      expect(INTENT_TO_ROUTE).toBeDefined();
      expect(COMPONENT_TO_ROUTE).toBeDefined();
      expect(TAB_TO_ROUTE).toBeDefined();
      
      expect(typeof APP_ROUTES).toBe('object');
      expect(typeof INTENT_TO_ROUTE).toBe('object');
      expect(typeof COMPONENT_TO_ROUTE).toBe('object');
      expect(typeof TAB_TO_ROUTE).toBe('object');
    });
  });

  describe('Route Definition - Path Mapping', () => {
    it('should define all required application routes', () => {
      const requiredRoutes = [
        // Main tab routes
        '/',                        // BankingDashboard
        '/chat',                    // ChatPanel
        '/transaction',             // TransactionAssistance
        // Banking sub-routes
        '/banking/accounts',        // AccountsOverview
        '/banking/transfers',       // TransfersHub  
        '/banking/transfers/wire',  // WireTransferForm
        '/banking/payments/bills'   // BillPayHub
      ];

      requiredRoutes.forEach(route => {
        expect(APP_ROUTES[route]).toBeDefined();
        
        const routeConfig = APP_ROUTES[route];
        expect(routeConfig.component).toBeTruthy();
        expect(routeConfig.intent).toBeTruthy();
        expect(routeConfig.tab).toBeTruthy();
        expect(typeof routeConfig.breadcrumb).toBe('string');
      });
    });

    it('should have correct route count', () => {
      const routeCount = Object.keys(APP_ROUTES).length;
      expect(routeCount).toBe(7); // Updated count
    });

    it('should have valid route structure', () => {
      Object.entries(APP_ROUTES).forEach(([path, config]) => {
        // Path validation
        expect(path.startsWith('/')).toBe(true);
        expect(path).not.toContain('..');
        expect(path).not.toContain('//');
        
        // Config validation
        expect(config.component).toBeTruthy();
        expect(config.intent).toBeTruthy();
        expect(config.breadcrumb).toBeTruthy();
        expect(config.tab).toBeTruthy();
        expect(typeof config.component).toBe('string');
        expect(typeof config.intent).toBe('string');
        expect(typeof config.breadcrumb).toBe('string');
        expect(typeof config.tab).toBe('string');
      });
    });
  });

  describe('Intent Mapping - Backend Integration', () => {
    it('should map intents to correct routes', () => {
      const intentMappings = [
        // Main tab routes
        { intent: 'navigation.banking.dashboard', route: '/' },
        { intent: 'navigation.chat.assistant', route: '/chat' },
        { intent: 'navigation.transaction.assistance', route: '/transaction' },
        // Banking sub-routes
        { intent: 'navigation.accounts.overview', route: '/banking/accounts' },
        { intent: 'navigation.transfers.hub', route: '/banking/transfers' },
        { intent: 'navigation.transfers.wire', route: '/banking/transfers/wire' },
        { intent: 'navigation.payments.bills', route: '/banking/payments/bills' }
      ];

      intentMappings.forEach(({ intent, route }) => {
        expect(INTENT_TO_ROUTE[intent]).toBe(route);
      });
    });

    it('should have bidirectional mapping consistency', () => {
      Object.entries(INTENT_TO_ROUTE).forEach(([intent, route]) => {
        expect(APP_ROUTES[route]).toBeDefined();
        expect(APP_ROUTES[route].intent).toBe(intent);
      });
    });

    it('should have complete intent coverage', () => {
      const intentCount = Object.keys(INTENT_TO_ROUTE).length;
      const routeCount = Object.keys(APP_ROUTES).length;
      expect(intentCount).toBe(routeCount);
    });
  });

  describe('Component Mapping - Frontend Integration', () => {
    it('should map component names to correct routes', () => {
      const componentMappings = [
        // Main tab routes
        { component: 'BankingDashboard', route: '/' },
        { component: 'ChatPanel', route: '/chat' },
        { component: 'TransactionAssistance', route: '/transaction' },
        // Banking sub-routes
        { component: 'AccountsOverview', route: '/banking/accounts' },
        { component: 'TransfersHub', route: '/banking/transfers' },
        { component: 'WireTransferForm', route: '/banking/transfers/wire' },
        { component: 'BillPayHub', route: '/banking/payments/bills' }
      ];

      componentMappings.forEach(({ component, route }) => {
        expect(COMPONENT_TO_ROUTE[component]).toBe(route);
      });
    });

    it('should have component-route consistency', () => {
      Object.entries(COMPONENT_TO_ROUTE).forEach(([component, route]) => {
        expect(APP_ROUTES[route]).toBeDefined();
        expect(APP_ROUTES[route].component).toBe(component);
      });
    });

    it('should have complete component coverage', () => {
      const componentCount = Object.keys(COMPONENT_TO_ROUTE).length;
      const routeCount = Object.keys(APP_ROUTES).length;
      expect(componentCount).toBe(routeCount);
    });
  });

  describe('Tab Mapping - UI Integration', () => {
    it('should map tab names to correct routes', () => {
      const tabMappings = [
        { tab: 'banking', route: '/' },
        { tab: 'chat', route: '/chat' },
        { tab: 'transaction', route: '/transaction' }
      ];

      tabMappings.forEach(({ tab, route }) => {
        expect(TAB_TO_ROUTE[tab]).toBe(route);
      });
    });

    it('should have tab-route consistency', () => {
      Object.entries(TAB_TO_ROUTE).forEach(([tab, route]) => {
        expect(APP_ROUTES[route]).toBeDefined();
        expect(APP_ROUTES[route].tab).toBe(tab);
      });
    });
  });

  describe('getRouteByComponent() - Utility Function', () => {
    it('should return correct routes for valid components', () => {
      const testCases = [
        // Main tab components
        { component: 'BankingDashboard', expected: '/' },
        { component: 'ChatPanel', expected: '/chat' },
        { component: 'TransactionAssistance', expected: '/transaction' },
        // Banking sub-components  
        { component: 'AccountsOverview', expected: '/banking/accounts' },
        { component: 'TransfersHub', expected: '/banking/transfers' },
        { component: 'WireTransferForm', expected: '/banking/transfers/wire' },
        { component: 'BillPayHub', expected: '/banking/payments/bills' }
      ];

      testCases.forEach(({ component, expected }) => {
        expect(getRouteByComponent(component)).toBe(expected);
      });
    });

    it('should return undefined for invalid components', () => {
      const invalidComponents = [
        'InvalidComponent',
        'NonExistentScreen',
        '',
        null,
        undefined
      ];

      invalidComponents.forEach(component => {
        expect(getRouteByComponent(component as string)).toBeUndefined();
      });
    });

    it('should handle edge cases safely', () => {
      expect(getRouteByComponent('')).toBeUndefined();
      expect(getRouteByComponent('  ')).toBeUndefined();
      expect(getRouteByComponent('ACCOUNTSOVERVIEW')).toBeUndefined(); // Case sensitive
    });
  });

  describe('getRouteByTab() - Tab Utility Function', () => {
    it('should return correct routes for valid tabs', () => {
      const testCases = [
        { tab: 'banking', expected: '/' },
        { tab: 'chat', expected: '/chat' },
        { tab: 'transaction', expected: '/transaction' }
      ];

      testCases.forEach(({ tab, expected }) => {
        expect(getRouteByTab(tab)).toBe(expected);
      });
    });

    it('should return undefined for invalid tabs', () => {
      const invalidTabs = ['invalid', 'nonexistent', '', null, undefined];

      invalidTabs.forEach(tab => {
        expect(getRouteByTab(tab as string)).toBeUndefined();
      });
    });
  });

  describe('getTabForRoute() - Route-to-Tab Utility Function', () => {
    it('should return correct tabs for valid routes', () => {
      const testCases = [
        { route: '/', expected: 'banking' },
        { route: '/chat', expected: 'chat' },
        { route: '/transaction', expected: 'transaction' },
        { route: '/banking/accounts', expected: 'banking' },
        { route: '/banking/transfers', expected: 'banking' }
      ];

      testCases.forEach(({ route, expected }) => {
        expect(getTabForRoute(route)).toBe(expected);
      });
    });

    it('should return undefined for invalid routes', () => {
      const invalidRoutes = ['/invalid', '/nonexistent', '', null, undefined];

      invalidRoutes.forEach(route => {
        expect(getTabForRoute(route as string)).toBeUndefined();
      });
    });
  });

  describe('isValidRoute() - Validation Function', () => {
    it('should validate existing routes as true', () => {
      const validRoutes = [
        // Main tab routes
        '/',
        '/chat',
        '/transaction', 
        // Banking sub-routes
        '/banking/accounts',
        '/banking/transfers', 
        '/banking/transfers/wire',
        '/banking/payments/bills'
      ];

      validRoutes.forEach(route => {
        expect(isValidRoute(route)).toBe(true);
      });
    });

    it('should validate non-existing routes as false', () => {
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
        expect(isValidRoute(route)).toBe(false);
      });
    });

    it('should handle malformed inputs safely', () => {
      const malformedInputs = [
        null,
        undefined,
        123 as never,
        {} as never,
        [] as never
      ];

      malformedInputs.forEach(input => {
        expect(isValidRoute(input as string)).toBe(false);
      });
    });
  });

  describe('handleUIAssistance() - Navigation Logic', () => {

    it('should prioritize route_path over component_name when valid', () => {
      const assistance: Partial<UIAssistance> = {
        type: 'navigation',
        route_path: '/banking/accounts',
        component_name: 'TransfersHub', // Different component
        title: 'Accounts'
      };

      const result = simulateNavigationLogic(assistance);
      expect(result).toBe('/banking/accounts'); // Should use route_path
    });

    it('should fallback to component_name when route_path invalid', () => {
      const assistance: Partial<UIAssistance> = {
        type: 'navigation', 
        route_path: '/invalid/path',
        component_name: 'AccountsOverview',
        title: 'Accounts'
      };

      const result = simulateNavigationLogic(assistance);
      expect(result).toBe('/banking/accounts'); // Should use component mapping
    });

    it('should handle all navigation components correctly', () => {
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

      testCases.forEach(({ assistance, expected }) => {
        const result = simulateNavigationLogic(assistance);
        expect(result).toBe(expected);
      });
    });

    it('should return undefined for invalid navigation requests', () => {
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

      invalidCases.forEach(({ assistance }) => {
        const result = simulateNavigationLogic(assistance);
        expect(result).toBeUndefined();
      });
    });
  });

  describe('Browser Navigation Support', () => {
    it('should have proper route structure for browser navigation', () => {
      const routes = Object.keys(APP_ROUTES);
      
      routes.forEach(route => {
        // Routes should be absolute paths
        expect(route.startsWith('/')).toBe(true);
        // No relative navigation patterns
        expect(route).not.toContain('..');
        // No double slashes
        expect(route).not.toContain('//');
      });
    });

    it('should support semantic, bookmarkable URLs', () => {
      const routes = Object.keys(APP_ROUTES);
      
      // Should not expose implementation details
      routes.forEach(route => {
        expect(route).not.toContain('screen');
        expect(route).not.toContain('component');
        expect(route).not.toContain('page');
        expect(route).not.toContain('view');
      });

      // Should have logical URL structure
      expect(routes).toContain('/'); // Root banking dashboard
      expect(routes).toContain('/chat'); // Chat tab
      expect(routes).toContain('/transaction'); // Transaction tab
      
      // Banking sub-routes should be hierarchical
      const bankingRoutes = routes.filter(route => route.startsWith('/banking'));
      expect(bankingRoutes.length).toBeGreaterThan(0);
      bankingRoutes.forEach(route => {
        expect(route).toMatch(/^\/banking\/[a-z]+/);
      });
    });

    it('should have hierarchical URL structure', () => {
      const routes = Object.keys(APP_ROUTES);
      
      // Check hierarchical structure
      expect(routes).toContain('/banking/accounts');
      expect(routes).toContain('/banking/transfers');
      expect(routes).toContain('/banking/transfers/wire'); // Nested under transfers
      expect(routes).toContain('/banking/payments/bills'); // Under payments
      
      // Verify proper nesting
      const transfersRoutes = routes.filter(route => route.startsWith('/banking/transfers'));
      expect(transfersRoutes.length).toBeGreaterThan(1); // Base + nested routes
    });
  });

  describe('System Integration - End-to-End Validation', () => {
    it('should meet all navigation system requirements', () => {
      // All components have route mappings
      const componentRouteMapping = [
        'BankingDashboard',
        'ChatPanel',
        'TransactionAssistance',
        'AccountsOverview',
        'TransfersHub', 
        'WireTransferForm',
        'BillPayHub'
      ].every(component => getRouteByComponent(component) !== undefined);
      
      expect(componentRouteMapping).toBe(true);

      // URLs are bookmarkable (semantic paths)
      const bookmarkableUrls = Object.keys(APP_ROUTES).every(route => {
        return !route.includes('component') && 
               !route.includes('screen') &&
               route.startsWith('/');
      });
      
      expect(bookmarkableUrls).toBe(true);

      // Complete system coverage
      expect(Object.keys(APP_ROUTES)).toHaveLength(7);
      expect(Object.keys(INTENT_TO_ROUTE)).toHaveLength(7);
      expect(Object.keys(COMPONENT_TO_ROUTE)).toHaveLength(7);
      expect(Object.keys(TAB_TO_ROUTE)).toHaveLength(3);
    });

    it('should maintain consistency across all mapping systems', () => {
      const routes = Object.keys(APP_ROUTES);
      
      // Every route should have corresponding intent and component mappings
      routes.forEach(route => {
        const routeConfig = APP_ROUTES[route];
        
        // Intent mapping consistency
        expect(INTENT_TO_ROUTE[routeConfig.intent]).toBe(route);
        
        // Component mapping consistency  
        expect(COMPONENT_TO_ROUTE[routeConfig.component]).toBe(route);
        
        // Route validation consistency
        expect(isValidRoute(route)).toBe(true);
        
        // Component lookup consistency
        expect(getRouteByComponent(routeConfig.component)).toBe(route);
        
        // Tab mapping consistency
        expect(getTabForRoute(route)).toBe(routeConfig.tab);
      });
    });

    it('should handle all expected navigation scenarios', () => {
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
          intent: 'navigation.payments.bills',
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
          expect(INTENT_TO_ROUTE[scenario.intent]).toBe(scenario.expected);
        }
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle utility function edge cases safely', () => {
      // getRouteByComponent edge cases
      expect(getRouteByComponent('')).toBeUndefined();
      expect(getRouteByComponent(' ')).toBeUndefined();
      expect(getRouteByComponent('invalid')).toBeUndefined();
      
      // isValidRoute edge cases
      expect(isValidRoute('')).toBe(false);
      expect(isValidRoute(' ')).toBe(false);
      expect(isValidRoute('/invalid')).toBe(false);
    });

    it('should handle malformed navigation assistance', () => {
      const malformedCases = [
        {},
        { type: 'invalid' },
        { type: 'navigation' },
        { type: 'navigation', route_path: '', component_name: '' },
        null,
        undefined
      ];

      malformedCases.forEach(assistance => {
        const result = simulateNavigationLogic(assistance as never);
        expect(result).toBeUndefined();
      });
    });

    it('should validate route configuration integrity', () => {
      // No duplicate routes
      const routes = Object.keys(APP_ROUTES);
      const uniqueRoutes = [...new Set(routes)];
      expect(routes.length).toBe(uniqueRoutes.length);

      // No duplicate components
      const components = Object.values(APP_ROUTES).map(config => config.component);
      const uniqueComponents = [...new Set(components)];
      expect(components.length).toBe(uniqueComponents.length);

      // No duplicate intents
      const intents = Object.values(APP_ROUTES).map(config => config.intent);
      const uniqueIntents = [...new Set(intents)];
      expect(intents.length).toBe(uniqueIntents.length);
    });
  });
});
