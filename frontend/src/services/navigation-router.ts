/**
 * Intent-Based Navigation Router
 * 
 * This service implements the Universal Schema Approach for intent-based navigation.
 * It maps banking intents to appropriate navigation routes, following the separation
 * of concerns principle where intents are the source of truth but navigation logic
 * resides on the frontend.
 * 
 * Design Principles:
 * - Single Responsibility: Only handles intent-to-route mapping
 * - Open-Closed: Easy to extend with new intent mappings
 * - Dependency Inversion: Depends on abstractions, not concretions
 */

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
}

export interface IntentNavigationMapper {
  /** Map an intent to a navigation target */
  mapIntentToNavigation(intentId: string, entities?: Record<string, any>): NavigationTarget | null;
  
  /** Check if an intent can be navigated in the current context */
  canNavigate(intentId: string, uiContext: string): boolean;
  
  /** Get all supported intents for navigation */
  getSupportedIntents(): string[];
}

/**
 * Default implementation of Intent Navigation Mapper
 * Maps core banking intents to pre-built UI screens
 */
export class BankingIntentNavigationMapper implements IntentNavigationMapper {
  private readonly intentToRouteMap: Record<string, NavigationTarget> = {
    // Account Management Intents
    'accounts.balance.check': {
      route: '/banking/accounts',
      title: 'Account Overview',
      description: 'View all your accounts and balances',
    },
    
    'accounts.statement.view': {
      route: '/banking/accounts',
      title: 'Account Statements',
      description: 'View account statements and transaction history',
    },
    
    'accounts.statement.download': {
      route: '/banking/accounts',
      title: 'Download Statements',
      description: 'Download account statements',
    },
    
    // Specific account details (with parameter resolution)
    'accounts.balance.history': {
      route: '/banking/accounts/:accountId',
      title: 'Account Details',
      description: 'View specific account details and history',
      requiresEntities: ['account_id'],
    },
    
    // Transfer Intents
    'payments.transfer.internal': {
      route: '/banking/transfers',
      title: 'Money Transfers',
      description: 'Transfer money between your accounts',
    },
    
    'payments.transfer.external': {
      route: '/banking/transfers',
      title: 'External Transfers',
      description: 'Transfer money to external accounts',
    },
    
    // Wire Transfer Intents
    'international.wire.send': {
      route: '/banking/transfers/wire',
      title: 'International Wire Transfers',
      description: 'Send money internationally via wire transfer',
    },
    
    // Payment Intents
    'payments.bill.pay': {
      route: '/banking/payments/bills',
      title: 'Bill Pay',
      description: 'Pay bills and manage payees',
    },
    
    'payments.bill.schedule': {
      route: '/banking/payments/bills',
      title: 'Schedule Bill Payment',
      description: 'Schedule future bill payments',
    },
    
    'payments.recurring.setup': {
      route: '/banking/payments/bills',
      title: 'Recurring Payments',
      description: 'Set up automatic recurring payments',
    },
    
    'payments.status.check': {
      route: '/banking/payments/bills',
      title: 'Payment Status',
      description: 'Check the status of your payments',
    },
    
    // P2P Payment Intents
    'payments.p2p.send': {
      route: '/banking/transfers',
      title: 'Send Money',
      description: 'Send money to friends and family',
    },
    
    // Card Management Intents
    'cards.block.temporary': {
      route: '/banking/cards',
      title: 'Card Management',
      description: 'Manage your debit and credit cards',
    },
    
    'cards.replace.lost': {
      route: '/banking/cards',
      title: 'Replace Card',
      description: 'Report lost cards and order replacements',
    },
    
    'cards.activate': {
      route: '/banking/cards',
      title: 'Activate Card',
      description: 'Activate your new cards',
    },
    
    'cards.pin.change': {
      route: '/banking/cards',
      title: 'Change PIN',
      description: 'Change your card PIN number',
    },
    
    'cards.limit.increase': {
      route: '/banking/cards',
      title: 'Increase Limit',
      description: 'Request credit limit increase',
    },
    
    // Investment Intents
    'investments.portfolio.view': {
      route: '/banking/investments',
      title: 'Investment Portfolio',
      description: 'View your investment portfolio and performance',
    },
    
    'investments.buy.stock': {
      route: '/banking/investments',
      title: 'Buy Stocks',
      description: 'Purchase stock shares',
    },
    
    'investments.sell.stock': {
      route: '/banking/investments',
      title: 'Sell Stocks',
      description: 'Sell your stock holdings',
    },
    
    // Lending Intents
    'lending.apply.personal': {
      route: '/banking/loans',
      title: 'Personal Loans',
      description: 'Apply for personal loans',
    },
    
    'lending.apply.mortgage': {
      route: '/banking/loans',
      title: 'Mortgage Application',
      description: 'Apply for home mortgage loans',
    },
    
    'lending.payment.make': {
      route: '/banking/loans',
      title: 'Loan Payments',
      description: 'Make payments on your existing loans',
    },
    
    // Inquiry Intents
    'inquiries.transaction.search': {
      route: '/banking/accounts',
      title: 'Transaction Search',
      description: 'Search your transaction history',
    },
    
    // Dispute Intents
    'disputes.transaction.initiate': {
      route: '/banking/disputes',
      title: 'Transaction Disputes',
      description: 'Dispute unauthorized or incorrect transactions',
    },
    
    // Support Intents
    'support.agent.request': {
      route: '/chat',
      title: 'Customer Support',
      description: 'Connect with customer service agents',
    },
    
    // Profile Management
    'profile.update.contact': {
      route: '/banking/profile',
      title: 'Update Profile',
      description: 'Update your contact information and preferences',
    },
    
    // Security Intents
    'security.password.reset': {
      route: '/banking/security',
      title: 'Security Settings',
      description: 'Manage passwords and security settings',
    },
    
    'security.2fa.setup': {
      route: '/banking/security',
      title: 'Two-Factor Authentication',
      description: 'Set up two-factor authentication for enhanced security',
    },
    
    // Onboarding Intents
    'onboarding.account.open': {
      route: '/banking/onboarding',
      title: 'Open New Account',
      description: 'Open a new bank account',
    },
    
    // Business Banking
    'business.account.open': {
      route: '/banking/business',
      title: 'Business Banking',
      description: 'Open business banking accounts',
    },
    
    // Cash Management
    'cash.deposit.schedule': {
      route: '/banking/services',
      title: 'Cash Deposit',
      description: 'Schedule cash deposit appointments',
    },
  };

  mapIntentToNavigation(intentId: string, entities?: Record<string, any>): NavigationTarget | null {
    const target = this.intentToRouteMap[intentId];
    
    if (!target) {
      return null;
    }

    // Create a copy to avoid modifying the original
    const navigationTarget: NavigationTarget = {
      ...target,
      params: {},
    };

    // Resolve route parameters if needed
    navigationTarget.route = this.resolveRouteParameters(target.route, entities);

    return navigationTarget;
  }

  canNavigate(intentId: string, uiContext: string): boolean {
    // Only allow navigation in 'banking' UI context
    if (uiContext !== 'banking') {
      return false;
    }

    return intentId in this.intentToRouteMap;
  }

  getSupportedIntents(): string[] {
    return Object.keys(this.intentToRouteMap);
  }

  /**
   * Resolve route parameters from entities
   * Converts patterns like '/banking/accounts/:accountId' to '/banking/accounts/123'
   */
  private resolveRouteParameters(routePattern: string, entities?: Record<string, any>): string {
    if (!entities || !routePattern.includes(':')) {
      return routePattern;
    }

    let resolvedRoute = routePattern;

    // Extract parameters from route (e.g., :accountId)
    const paramMatches = routePattern.match(/:(\w+)/g);
    
    if (paramMatches) {
      for (const paramMatch of paramMatches) {
        const paramName = paramMatch.substring(1); // Remove the ':'
        const snakeCaseParam = this.camelToSnake(paramName);
        
        // Try to find the entity value
        let entityValue: string | undefined;
        
        // First try exact match
        if (entities[snakeCaseParam]) {
          entityValue = this.extractEntityValue(entities[snakeCaseParam]);
        }
        // Then try camelCase version
        else if (entities[paramName]) {
          entityValue = this.extractEntityValue(entities[paramName]);
        }

        if (entityValue) {
          resolvedRoute = resolvedRoute.replace(paramMatch, entityValue);
        } else {
          // If we can't resolve the parameter, return the original pattern
          // The frontend router will handle this appropriately
          return routePattern;
        }
      }
    }

    return resolvedRoute;
  }

  /**
   * Extract entity value from various entity formats
   */
  private extractEntityValue(entity: any): string | undefined {
    if (typeof entity === 'string') {
      return entity;
    }
    
    if (typeof entity === 'object' && entity !== null) {
      // Handle structured entity format from backend
      if (entity.value !== undefined) {
        return String(entity.value);
      }
      
      // Handle direct value
      if (entity.raw !== undefined) {
        return String(entity.raw);
      }
    }
    
    return undefined;
  }

  /**
   * Convert camelCase to snake_case
   */
  private camelToSnake(camelStr: string): string {
    return camelStr.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}

/**
 * Navigation Service using Intent-Based Router
 * 
 * This service combines intent classification results with navigation logic,
 * implementing the separation of concerns principle from the Universal Schema Approach.
 */
export class IntentBasedNavigationService {
  constructor(private mapper: IntentNavigationMapper = new BankingIntentNavigationMapper()) {}

  /**
   * Process navigation request from intent classification result
   */
  processNavigationRequest(
    intentId: string,
    entities: Record<string, any> = {},
    uiContext: string = 'banking'
  ): NavigationTarget | null {
    // Check if navigation is supported for this intent and context
    if (!this.mapper.canNavigate(intentId, uiContext)) {
      return null;
    }

    // Map intent to navigation target
    const target = this.mapper.mapIntentToNavigation(intentId, entities);
    
    if (!target) {
      return null;
    }

    // Validate that required entities are present if needed
    if (target.requiresEntities && target.requiresEntities.length > 0) {
      const hasAllRequiredEntities = target.requiresEntities.every(
        entityName => entities[entityName] || entities[this.snakeToCamel(entityName)]
      );

      if (!hasAllRequiredEntities) {
        // Return navigation target without parameters for general navigation
        return {
          ...target,
          route: target.route.replace(/:[\w]+/g, ''), // Remove parameter placeholders
          description: `${target.description} (missing specific details)`,
        };
      }
    }

    return target;
  }

  /**
   * Check if an intent supports navigation in the given context
   */
  supportsNavigation(intentId: string, uiContext: string = 'banking'): boolean {
    return this.mapper.canNavigate(intentId, uiContext);
  }

  /**
   * Get all intents that support navigation
   */
  getNavigableIntents(): string[] {
    return this.mapper.getSupportedIntents();
  }

  /**
   * Convert snake_case to camelCase
   */
  private snakeToCamel(snakeStr: string): string {
    return snakeStr.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}

// Export default instance
export const navigationService = new IntentBasedNavigationService();

// Export for testing with custom mappers
export default IntentBasedNavigationService;
