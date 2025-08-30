// Single source of truth for all application routes
export const APP_ROUTES = {
  // Main tab routes
  "/": {
    component: "BankingDashboard",
    intent: "navigation.banking.dashboard", 
    breadcrumb: "Dashboard",
    tab: "banking"
  },
  "/chat": {
    component: "ChatPanel",
    intent: "navigation.chat.assistant",
    breadcrumb: "Chat Assistant", 
    tab: "chat"
  },
  "/transaction": {
    component: "TransactionAssistance", 
    intent: "navigation.transaction.assistance",
    breadcrumb: "Transaction Assistance",
    tab: "transaction"
  },
  // Banking sub-routes
  "/banking/accounts": {
    component: "AccountsOverview",
    intent: "navigation.accounts.overview",
    breadcrumb: "Accounts",
    tab: "banking"
  },
  "/banking/transfers": {
    component: "TransfersHub",
    intent: "navigation.transfers.hub",
    breadcrumb: "Transfers",
    tab: "banking"
  },
  "/banking/transfers/wire": {
    component: "WireTransferForm",
    intent: "navigation.transfers.wire",
    breadcrumb: "Wire Transfer",
    tab: "banking"
  },
  "/banking/payments/bills": {
    component: "BillPayHub",
    intent: "navigation.payments.bills",
    breadcrumb: "Bill Pay",
    tab: "banking"
  }
} as const;

// Derived mappings (computed from single source of truth)
export const INTENT_TO_ROUTE = Object.entries(APP_ROUTES).reduce((acc, [route, config]) => {
  acc[config.intent] = route;
  return acc;
}, {} as Record<string, string>);

export const COMPONENT_TO_ROUTE = Object.entries(APP_ROUTES).reduce((acc, [route, config]) => {
  acc[config.component] = route;
  return acc;
}, {} as Record<string, string>);

export const TAB_TO_ROUTE = Object.entries(APP_ROUTES)
  .filter(([route]) => route === '/' || (!route.includes('/', 1))) // Main tab routes: root or no nested paths
  .reduce((acc, [route, config]) => {
    acc[config.tab] = route;
    return acc;
  }, {} as Record<string, string>);

// Available route paths for validation
export const ROUTE_PATHS = Object.keys(APP_ROUTES) as Array<keyof typeof APP_ROUTES>;

// Get route path by component name
export function getRouteByComponent(componentName: string): string | undefined {
  return COMPONENT_TO_ROUTE[componentName];
}

// Get route path by intent 
export function getRouteByIntent(intent: string): string | undefined {
  return INTENT_TO_ROUTE[intent];
}

// Get route path by tab name
export function getRouteByTab(tabName: string): string | undefined {
  return TAB_TO_ROUTE[tabName];
}

// Validate if a route exists
export function isValidRoute(path: string): boolean {
  return path in APP_ROUTES;
}

// Get tab for a given route
export function getTabForRoute(path: string): string | undefined {
  return APP_ROUTES[path as keyof typeof APP_ROUTES]?.tab;
}
