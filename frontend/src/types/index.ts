export interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  intent?: string;
  confidence?: number;
  entities?: unknown;
  timestamp: Date;
}

export interface ProcessResponse {
  status: string;
  intent?: string;
  confidence?: number;
  entities?: unknown;
  message?: string;
  ui_assistance?: UIAssistance;
  execution?: unknown;
  [key: string]: unknown;
}

export interface UIAssistance {
  type: 'navigation' | 'transaction_form';
  action: string;
  screen_id?: string;
  route_path?: string;
  component_name?: string;
  form_config?: DynamicFormConfig;
  title?: string;
  subtitle?: string;
  description?: string;
  success_message?: string;
  account_id?: string; // @FIXME: Remove this field, it is so wrong to have it on many levels
  requires_clarification?: boolean;
  clarification_options?: string[];
}

export interface DynamicFormConfig {
  screen_id: string;
  title: string;
  subtitle: string;
  fields: FormField[];
  confirmation_required: boolean;
  complexity_reduction: string;
}

export interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  value?: unknown;
  pre_filled?: boolean;
  help_text?: string;
  conditional_on?: string;
  hidden?: boolean;
}

export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
}

export interface AccountBalance {
  account_id: string;
  balance: number;
}

export interface Transaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  type: 'debit' | 'credit';
  account_id: string;
  balance_after: number;
  category?: string;
  merchant?: string;
  status?: 'pending' | 'completed' | 'failed';
}

export interface AccountTransactionsResponse {
  account_id: string;
  transactions: Transaction[];
  total_count: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// Route types (avoiding circular import)
export interface RouteConfig {
  path: string;
  component: string;
  intent: string;
  breadcrumb: string;
  tab: string;
}

export interface RoutesResponse {
  routes: RouteConfig[];
}

// Legacy support - for compatibility during transition
export interface AppRoutes {
  [path: string]: Omit<RouteConfig, 'path'>;
}

// Intent-Based Navigation Types
export interface NavigationTarget {
  /** The route path to navigate to */
  route: string;
  /** Optional route parameters to resolve */
  params?: Record<string, string>;
  /** Title to display in notifications */
  title: string;
  /** Description for accessibility */
  description: string;
  /** Whether this navigation requires specific entities */
  requiresEntities?: string[];
  /** Dynamic route resolver function */
  getDynamicRoute?: (entities: Record<string, unknown>) => string;
  /** Dynamic title resolver function */
  getDynamicTitle?: (entities: Record<string, unknown>) => string;
}

export interface IntentNavigationResult {
  /** Whether navigation was successful */
  success: boolean;
  /** The navigation target if successful */
  target?: NavigationTarget;
  /** Error message if navigation failed */
  error?: string;
  /** The resolved route path */
  route?: string;
}

// Route Configuration Types
export interface StaticRouteDefinition {
  path: string;
  component: string;
  breadcrumb: string;
  tab: string;
  navigationLabel: string;
  showInNavigation: boolean;
  intent: string;
  redirectTo?: string;
  group?: string;
}

export interface IntentRouteDefinition {
  intentId: string;
  baseRoute: string;
  breadcrumb: string;
  navigationLabel: string;
  hasParameters: boolean;
  parameterFallback?: string;
  showInNavigation: boolean;
}

export interface ProcessedRoute {
  path: string;
  component: string;
  breadcrumb: string;
  tab: string;
  navigationLabel: string;
  showInNavigation: boolean;
  source: 'static' | 'intent';
  group?: string;
  intentId?: string;
  hasParameters?: boolean;
  parameterFallback?: string;
  intent: string; // Navigation intent for backward compatibility
  redirectTo?: string;
}

export interface NavigationLink {
  label: string;
  path: string;
  tab: string;
}

export interface NavigationGroup {
  label: string;
  links: NavigationLink[];
}

