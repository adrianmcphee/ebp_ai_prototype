/**
 * Clean, simple route service
 * Loads configs and provides clear APIs for navigation and breadcrumbs
 */

import { STATIC_ROUTE_CONFIG } from '../config/static-routes.config';
import { INTENT_ROUTE_CONFIG } from '../config/intent-routes.config';
import type { NavigationGroup, NavigationTarget, ProcessedRoute } from '../types';

// Simple unified route type
type Route = {
  path: string;
  component: string;
  breadcrumb: string;
  tab: string;
  navigationLabel: string;
  showInNavigation: boolean;
  group?: string;
  intent?: string;
  redirectTo?: string;
  intentId?: string;
  hasParameters?: boolean;
  parameterFallback?: string;
};

// ===== PRIVATE UTILITIES =====

const deriveTab = (path: string): string => 
  path.startsWith('/banking') ? 'banking' : 
  path.startsWith('/transaction') ? 'transaction' : 
  path.startsWith('/chat') ? 'chat' : 'banking';

const deriveGroup = (path: string): string | undefined => 
  path.startsWith('/banking') ? 'Banking' : undefined;

const generateNavigationIntent = (path: string, hasParameters: boolean): string => {
  const intentMap: Record<string, string> = {
    '/banking/accounts': hasParameters ? 'navigation.accounts.details' : 'navigation.accounts.overview',
    '/banking/transfers': 'navigation.transfers.hub',
    '/banking/transfers/wire': 'navigation.transfers.wire',
    '/banking/payments/bills': 'navigation.payments.bills'
  };
  
  return intentMap[path] || `navigation.${path.split('/').filter(Boolean).filter(s => !s.startsWith(':')).join('.')}`;
};

const inferComponent = (path: string): string => {
  if (path.includes('/accounts') && path.includes(':')) return 'AccountDetails';
  if (path.includes('/accounts')) return 'AccountsOverview';
  if (path.includes('/transfers/wire')) return 'WireTransferForm';
  if (path.includes('/transfers')) return 'TransfersHub';
  if (path.includes('/payments/bills')) return 'BillPayHub';
  return 'GenericBankingComponent';
};

const matchesParameterizedRoute = (path: string, pattern: string): boolean => {
  const regex = new RegExp(`^${pattern.replace(/:[\w]+/g, '[^/]+')}$`);
  return regex.test(path);
};

const extractEntityValue = (entity: unknown): string | undefined => {
  if (typeof entity === 'string') return entity;
  if (entity && typeof entity === 'object' && 'value' in entity) return String(entity.value);
  return undefined;
};

// ===== ROUTE LOADING =====

const loadRoutes = (): Route[] => {
  const staticRoutes: Route[] = STATIC_ROUTE_CONFIG.map(route => ({
    path: route.path,
    component: route.component,
    breadcrumb: route.breadcrumb,
    tab: route.tab,
    navigationLabel: route.navigationLabel,
    showInNavigation: route.showInNavigation,
    group: route.group,
    intent: route.intent,
    redirectTo: route.redirectTo
  }));

  const intentRoutes: Route[] = INTENT_ROUTE_CONFIG.map(route => ({
    path: route.baseRoute,
    component: inferComponent(route.baseRoute),
    breadcrumb: route.breadcrumb,
    tab: deriveTab(route.baseRoute),
    navigationLabel: route.navigationLabel,
    showInNavigation: route.showInNavigation,
    group: deriveGroup(route.baseRoute),
    intent: generateNavigationIntent(route.baseRoute, route.hasParameters),
    intentId: route.intentId,
    hasParameters: route.hasParameters,
    parameterFallback: route.parameterFallback
  }));

  // Merge: static routes first (preserving order), intent routes override same paths
  const routeMap = new Map<string, Route>();
  staticRoutes.forEach(route => routeMap.set(route.path, route));
  intentRoutes.forEach(route => routeMap.set(route.path, route));
  
  return Array.from(routeMap.values());
};

// Load routes once
const routes = loadRoutes();

// ===== PUBLIC API =====

export const buildNavigationGroups = (): NavigationGroup[] => {
  const grouped: Record<string, { label: string; path: string; tab: string; }[]> = {};
  
  // Static routes first for correct order
  const staticRoutes = routes.filter(r => r.showInNavigation && !r.intentId);
  const intentRoutes = routes.filter(r => r.showInNavigation && r.intentId);
  
  [...staticRoutes, ...intentRoutes].forEach(route => {
    const groupKey = route.group || route.navigationLabel;
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push({
      label: route.navigationLabel,
      path: route.path,
      tab: route.tab
    });
  });
  
  return Object.entries(grouped).map(([label, links]) => ({ label, links }));
};

export const getRouteByPath = (path: string): Route | undefined =>
  routes.find(route => route.path === path || 
    (route.hasParameters && matchesParameterizedRoute(path, route.path)));

export const isValidRoute = (path: string): boolean =>
  routes.some(route => route.path === path || 
    (route.hasParameters && matchesParameterizedRoute(path, route.path)));

export const mapIntentToNavigation = (intentId: string, entities?: Record<string, unknown>): NavigationTarget | null => {
  // Find all routes for this intent
  const intentRoutes = routes.filter(r => r.intentId === intentId);
  
  if (intentRoutes.length === 0) {
    // Check static routes as fallback
    const staticRoute = routes.find(r => r.intent?.includes(intentId));
    return staticRoute ? {
      route: staticRoute.path,
      title: staticRoute.breadcrumb,
      description: staticRoute.breadcrumb
    } : null;
  }
  
  // If we have entities, try parameterized routes first
  if (entities && Object.keys(entities).length > 0) {
    const parameterizedRoute = intentRoutes.find(route => route.hasParameters);
    if (parameterizedRoute) {
      const resolvedRoute = resolveDynamicRoute(parameterizedRoute.path, entities);
      // Only use parameterized route if we successfully resolved the parameters
      if (resolvedRoute !== parameterizedRoute.path) {
        return {
          route: resolvedRoute,
          title: resolveDynamicTitle(parameterizedRoute.breadcrumb, entities),
          description: parameterizedRoute.breadcrumb
        };
      }
    }
  }
  
  // Fall back to non-parameterized route
  const fallbackRoute = intentRoutes.find(route => !route.hasParameters) || intentRoutes[0];
  return {
    route: resolveDynamicRoute(fallbackRoute.path, entities),
    title: resolveDynamicTitle(fallbackRoute.breadcrumb, entities),
    description: fallbackRoute.breadcrumb
  };
};

export const resolveDynamicRoute = (routePattern: string, entities?: Record<string, unknown>): string => {
  if (!entities || !routePattern.includes(':')) return routePattern;
  
  if (routePattern === '/banking/accounts/:accountId' && entities.account_id) {
    const accountId = extractEntityValue(entities.account_id);
    if (accountId) return `/banking/accounts/${accountId}`;
  }
  
  return routePattern;
};

export const resolveDynamicTitle = (baseTitle: string, entities?: Record<string, unknown>): string => {
  if (!entities) return baseTitle;
  
  const accountId = extractEntityValue(entities.account_id);
  const accountType = extractEntityValue(entities.account_type);
  
  if (accountId && accountType) {
    const capitalizedType = accountType.charAt(0).toUpperCase() + accountType.slice(1);
    return `${capitalizedType} Account Details`;
  } else if (accountId) {
    return 'Account Details';
  }
  
  return baseTitle;
};

// For backward compatibility - convert to legacy format
export const generateLegacyRoutes = (): Record<string, ProcessedRoute> => {
  const legacyRoutes: Record<string, ProcessedRoute> = {};
  
  routes.forEach(route => {
    legacyRoutes[route.path] = {
      path: route.path,
      component: route.component,
      breadcrumb: route.breadcrumb,
      tab: route.tab,
      navigationLabel: route.navigationLabel,
      showInNavigation: route.showInNavigation,
      source: route.intentId ? 'intent' : 'static',
      group: route.group,
      intent: route.intent || '',
      redirectTo: route.redirectTo,
      intentId: route.intentId,
      hasParameters: route.hasParameters,
      parameterFallback: route.parameterFallback
    };
  });
  
  return legacyRoutes;
};

// Process intent navigation (replaces NavigationOrchestrator)
export const processIntentNavigation = (
  intentId: string, 
  entities: Record<string, unknown>, 
  uiContext: string
) => {
  try {
    if (uiContext !== 'banking') {
      return { 
        success: false, 
        error: `Navigation not supported for context: ${uiContext}` 
      };
    }

    const target = mapIntentToNavigation(intentId, entities);
    
    if (!target) {
      return { 
        success: false, 
        error: `Navigation not supported for intent: ${intentId}` 
      };
    }

    return {
      success: true,
      target,
      route: target.route
    };

  } catch (error) {
    return {
      success: false,
      error: `Navigation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};
