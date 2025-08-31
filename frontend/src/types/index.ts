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