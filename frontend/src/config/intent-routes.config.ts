/**
 * Intent Route Configuration
 * 
 * Defines routes that are generated from banking intents.
 * These routes support dynamic parameters and fallback behavior.
 */

import type { IntentRouteDefinition } from '../types';

export const INTENT_ROUTE_CONFIG: IntentRouteDefinition[] = [
  // Account Management
  {
    intentId: 'accounts.balance.check',
    baseRoute: '/banking/accounts',
    breadcrumb: 'Account Overview',
    navigationLabel: 'Accounts',
    hasParameters: false,
    showInNavigation: true
  },
  {
    intentId: 'accounts.balance.check',
    baseRoute: '/banking/accounts/:accountId',
    breadcrumb: 'Account Details',
    navigationLabel: 'Account Details',
    hasParameters: true,
    parameterFallback: '/banking/accounts',
    showInNavigation: false
  },

  // Transfers
  {
    intentId: 'payments.transfer.internal',
    baseRoute: '/banking/transfers',
    breadcrumb: 'Transfer Hub',
    navigationLabel: 'Transfers',
    hasParameters: false,
    showInNavigation: true
  },

  // Internal Transfers
  {
    intentId: 'payments.transfer.internal',
    baseRoute: '/banking/transfers/internal',
    breadcrumb: 'Internal Transfer',
    navigationLabel: 'Internal Transfer',
    hasParameters: false,
    showInNavigation: true
  },

  // External Transfers  
  {
    intentId: 'payments.transfer.external',
    baseRoute: '/banking/transfers/external',
    breadcrumb: 'External Transfer',
    navigationLabel: 'External Transfer', 
    hasParameters: false,
    showInNavigation: true
  },

  // P2P Payments
  {
    intentId: 'payments.p2p.send',
    baseRoute: '/banking/transfers/p2p',
    breadcrumb: 'P2P Payment',
    navigationLabel: 'P2P Payment',
    hasParameters: false,
    showInNavigation: true
  },

  // Wire Transfers
  {
    intentId: 'international.wire.send',
    baseRoute: '/banking/transfers/wire',
    breadcrumb: 'Wire Transfers',
    navigationLabel: 'Wire Transfers',
    hasParameters: false,
    showInNavigation: true
  },

  // Bill Pay
  {
    intentId: 'payments.bill.pay',
    baseRoute: '/banking/payments/bills',
    breadcrumb: 'Bill Pay',
    navigationLabel: 'Bill Pay',
    hasParameters: false,
    showInNavigation: true
  }
];
