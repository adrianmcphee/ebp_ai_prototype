import type { AppRoutes } from '../types';
import { apiService  } from './api';

/**
 * Fetch application routes from backend API
 * Routes are dynamically assembled from intent catalog and UI screen catalog
 */
export const fetchAppRoutes = async (): Promise<AppRoutes> => {
  const routes = await apiService.fetchRoutes();
  console.log('Fetched routes from API:', routes);
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
    return path in routes;
  };

  const getTabForRoute = (path: string): string | undefined => {
    return routes[path as keyof typeof routes]?.tab;
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
