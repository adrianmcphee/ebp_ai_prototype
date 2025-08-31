import type { AppRoutes } from '../types';
import { apiService  } from './api';

/**
 * Fetch application routes from backend API
 * Routes are dynamically assembled from intent catalog and UI screen catalog
 */
export const fetchAppRoutes = async (): Promise<AppRoutes> => {
  const routes = await apiService.fetchRoutes();
  return routes;
};

/**
 * Generate derived mappings from route definitions
 * Same logic as the original routes.ts file
 */
export const createDerivedMappings = (routes: AppRoutes) => {
  const INTENT_TO_ROUTE = Object.entries(routes).reduce((acc, [route, config]) => {
    acc[config.intent] = route;
    return acc;
  }, {} as Record<string, string>);

  const COMPONENT_TO_ROUTE = Object.entries(routes).reduce((acc, [route, config]) => {
    acc[config.component] = route;
    return acc;
  }, {} as Record<string, string>);

  const TAB_TO_ROUTE = Object.entries(routes)
    .filter(([route]) => route === '/' || (!route.includes('/', 1))) // Main tab routes
    .reduce((acc, [route, config]) => {
      acc[config.tab] = route;
      return acc;
    }, {} as Record<string, string>);

  const ROUTE_PATHS = Object.keys(routes) as Array<keyof typeof routes>;

  // Utility functions (same as original routes.ts)
  const getRouteByComponent = (componentName: string): string | undefined => {
    return COMPONENT_TO_ROUTE[componentName];
  };

  const getRouteByIntent = (intent: string): string | undefined => {
    return INTENT_TO_ROUTE[intent];
  };

  const getRouteByTab = (tabName: string): string | undefined => {
    return TAB_TO_ROUTE[tabName];
  };

  const isValidRoute = (path: string): boolean => {
    // Direct exact match first
    if (path in routes) {
      return true;
    }
    
    // Check if path matches any parameterized routes
    for (const routePattern of Object.keys(routes)) {
      if (matchesParameterizedRoute(path, routePattern)) {
        return true;
      }
    }
    
    return false;
  };

  const matchesParameterizedRoute = (path: string, pattern: string): boolean => {
    // Convert route pattern to regex (e.g., "/banking/accounts/:accountId" -> "/banking/accounts/[^/]+")
    const regexPattern = pattern.replace(/:[\w]+/g, '[^/]+');
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  };

  const getTabForRoute = (path: string): string | undefined => {
    // Direct exact match first
    if (path in routes) {
      return routes[path as keyof typeof routes]?.tab;
    }
    
    // Check parameterized routes
    for (const routePattern of Object.keys(routes)) {
      if (matchesParameterizedRoute(path, routePattern)) {
        return routes[routePattern as keyof typeof routes]?.tab;
      }
    }
    
    return undefined;
  };

  return {
    INTENT_TO_ROUTE,
    COMPONENT_TO_ROUTE,
    TAB_TO_ROUTE,
    ROUTE_PATHS,
    getRouteByComponent,
    getRouteByIntent,
    getRouteByTab,
    isValidRoute,
    getTabForRoute,
  };
};
