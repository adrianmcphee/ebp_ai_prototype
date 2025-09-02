/**
 * Static Route Configuration
 * 
 * Defines routes that are not tied to specific intents.
 * These are core application routes that exist independently of the intent system.
 */

import type { StaticRouteDefinition } from '../types';

export const STATIC_ROUTE_CONFIG: StaticRouteDefinition[] = [
  {
    path: '/',
    component: 'Redirect', // Special component that redirects to /banking
    breadcrumb: 'Home',
    tab: 'banking',
    navigationLabel: 'Home',
    showInNavigation: false,
    intent: '', // No intent for redirect
    redirectTo: '/banking'
  },
  {
    path: '/banking',
    component: 'BankingDashboard',
    breadcrumb: 'Dashboard',
    tab: 'banking',
    navigationLabel: 'Dashboard',
    showInNavigation: true,
    intent: '', // No intent for static routes
    group: 'Banking'
  },
  {
    path: '/transaction',
    component: 'TransactionAssistance',
    breadcrumb: 'Transaction Assistance', 
    tab: 'transaction',
    navigationLabel: 'Transaction Assistance',
    showInNavigation: true,
    intent: '' // No intent for static routes
  },
  {
    path: '/chat',
    component: 'ChatPanel', 
    breadcrumb: 'Chat Assistant',
    tab: 'chat',
    navigationLabel: 'Chat Assistant',
    showInNavigation: true,
    intent: '' // No intent for static routes
  }
];
