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
}
