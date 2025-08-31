import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { Breadcrumb } from '../components/Breadcrumb';
import type { AppRoutes } from '../types';

// Test helper to render Breadcrumb with proper routing context
const renderBreadcrumbWithRouter = (
  appRoutes: AppRoutes, 
  className?: string,
  initialEntries = ['/banking/accounts']
) => {
  return render(
    <MantineProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Breadcrumb appRoutes={appRoutes} className={className} />
      </MemoryRouter>
    </MantineProvider>
  );
};

describe('Breadcrumb Component', () => {
  
  // Test data - realistic route configurations
  const mockAppRoutes: AppRoutes = {
    '/': { component: 'BankingDashboard', intent: 'view_dashboard', breadcrumb: 'Dashboard', tab: 'banking' },
    '/banking': { component: 'BankingHub', intent: 'banking_hub', breadcrumb: 'Banking', tab: 'banking' },
    '/banking/accounts': { component: 'AccountsOverview', intent: 'view_accounts', breadcrumb: 'Accounts', tab: 'banking' },
    '/banking/transfers': { component: 'TransfersHub', intent: 'view_transfers', breadcrumb: 'Transfers', tab: 'banking' },
    '/banking/transfers/wire': { component: 'WireTransferForm', intent: 'wire_transfer', breadcrumb: 'Wire Transfer', tab: 'banking' },
    '/chat': { component: 'ChatPanel', intent: 'open_chat', breadcrumb: 'Chat', tab: 'chat' }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Breadcrumb Generation - Component Behavior', () => {
    it('render() - should generate breadcrumbs for valid route hierarchy', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/banking/transfers/wire']);
      });
      
      await waitFor(() => {
        // Should render all three levels: banking -> transfers -> wire transfer
        expect(screen.getByTestId('breadcrumb-link-banking')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-link-transfers')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-wire-transfer')).toBeDefined();
      });
    });

    it('render() - should handle single level routes', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/chat']);
      });
      
      await waitFor(() => {
        // Should only render current page for single level route
        expect(screen.getByTestId('breadcrumb-navigation')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-chat')).toBeDefined();
      });
    });

    it('render() - should create fallback breadcrumb for unknown routes', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/unknown-route']);
      });
      
      await waitFor(() => {
        // Should render fallback breadcrumb for unknown route
        expect(screen.getByTestId('breadcrumb-navigation')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-unknown-route')).toBeDefined();
      });
    });

    it('render() - should handle multi-word route segments in fallback', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/user-profile-settings']);
      });
      
      await waitFor(() => {
        // Should render properly formatted fallback label
        expect(screen.getByTestId('breadcrumb-navigation')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-user-profile-settings')).toBeDefined();
      });
    });

    it('render() - should handle partial route matches correctly', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/banking/accounts/details']);
      });
      
      await waitFor(() => {
        // Should render known routes plus fallback for unknown segment
        expect(screen.getByTestId('breadcrumb-link-banking')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-link-accounts')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-details')).toBeDefined();
      });
    });

    it('render() - should handle empty routes configuration', async () => {
      const emptyRoutes: AppRoutes = {};
      
      await act(async () => {
        renderBreadcrumbWithRouter(emptyRoutes, undefined, ['/banking/accounts']);
      });
      
      await waitFor(() => {
        // Should render fallback breadcrumb when no routes match
        expect(screen.getByTestId('breadcrumb-navigation')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-accounts')).toBeDefined();
      });
    });

    it('render() - should handle root path', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/']);
      });
      
      // Root path should not render breadcrumbs
      expect(screen.queryByTestId('breadcrumb-navigation')).toBeNull();
    });
  });

  describe('render() - Component Rendering', () => {
    it('render() - should render breadcrumb navigation structure', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-navigation')).toBeDefined();
      });
    });

    it('render() - should render breadcrumb links for parent routes', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/banking/transfers/wire']);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-link-banking')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-link-transfers')).toBeDefined();
      });
    });

    it('render() - should render current page as text element', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/banking/accounts']);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-current-accounts')).toBeDefined();
      });
    });

    it('render() - should apply custom className when provided', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, 'custom-breadcrumb-class');
      });
      
      await waitFor(() => {
        const breadcrumbNavigation = screen.getByTestId('breadcrumb-navigation');
        expect(breadcrumbNavigation.className).toContain('custom-breadcrumb-class');
      });
    });

    it('render() - should not render on root path with single breadcrumb', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/']);
      });
      
      // Root path should not render breadcrumbs
      expect(screen.queryByTestId('breadcrumb-navigation')).toBeNull();
    });

    it('render() - should render for single breadcrumb on non-root path', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/chat']);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-navigation')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-chat')).toBeDefined();
      });
    });
  });

  describe('handleNavigation() - Navigation Functionality', () => {
    it('handleNavigation() - should render navigation links correctly', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/banking/transfers/wire']);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-link-banking')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-link-transfers')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-wire-transfer')).toBeDefined();
      });
    });

    it('handleNavigation() - should have correct link attributes', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/banking/accounts']);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-link-banking')).toBeDefined();
      });
      
      const breadcrumbLink = screen.getByTestId('breadcrumb-link-banking');
      expect(breadcrumbLink.tagName.toLowerCase()).toBe('a');
      expect(breadcrumbLink.getAttribute('href')).toBe('/banking');
    });

    it('handleNavigation() - should render multiple breadcrumb levels', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/banking/transfers/wire']);
      });
      
      await waitFor(() => {
        const breadcrumbNav = screen.getByTestId('breadcrumb-navigation');
        const breadcrumbElements = breadcrumbNav.querySelectorAll('[data-testid*="breadcrumb-"]');
        expect(breadcrumbElements.length).toBeGreaterThan(2);
      });
    });

    it('handleNavigation() - should not trigger navigation for current page elements', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/banking/accounts']);
      });
      
      await waitFor(() => {
        const currentPageElement = screen.getByTestId('breadcrumb-current-accounts');
        expect(currentPageElement.tagName.toLowerCase()).toBe('p'); // Mantine Text renders as p
      });
      
      // Current page element should not be clickable
      const currentPageElement = screen.getByTestId('breadcrumb-current-accounts');
      expect(currentPageElement.getAttribute('href')).toBeNull();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('render() - should handle malformed appRoutes gracefully', async () => {
      const malformedRoutes = {
        '/banking': null,
        '/invalid': { component: undefined, intent: '', breadcrumb: null }
      } as unknown as AppRoutes;
      
      await act(async () => {
        renderBreadcrumbWithRouter(malformedRoutes, undefined, ['/banking/accounts']);
      });
      
      await waitFor(() => {
        // Should render fallback breadcrumb when routes are malformed
        expect(screen.getByTestId('breadcrumb-navigation')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-accounts')).toBeDefined();
      });
    });

    it('render() - should handle empty appRoutes', async () => {
      const emptyRoutes: AppRoutes = {};
      
      await act(async () => {
        renderBreadcrumbWithRouter(emptyRoutes, undefined, ['/unknown-path']);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-navigation')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-unknown-path')).toBeDefined();
      });
    });

    it('render() - should handle different route structures', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/banking/accounts']);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-link-banking')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-accounts')).toBeDefined();
      });
    });

    it('render() - should handle complex nested paths', async () => {
      const complexRoutes: AppRoutes = {
        '/banking': { component: 'Banking', intent: 'banking', breadcrumb: 'Banking', tab: 'banking' },
        '/banking/transfers': { component: 'Transfers', intent: 'transfers', breadcrumb: 'Transfers', tab: 'banking' },
        '/banking/transfers/international': { component: 'International', intent: 'international', breadcrumb: 'International', tab: 'banking' }
      };
      
      await act(async () => {
        renderBreadcrumbWithRouter(complexRoutes, undefined, ['/banking/transfers/international/swift/confirmation']);
      });
      
      await waitFor(() => {
        // Should render known routes plus fallback for deepest path
        expect(screen.getByTestId('breadcrumb-link-banking')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-link-transfers')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-link-international')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-confirmation')).toBeDefined();
      });
    });

    it('render() - should handle special characters in route segments', async () => {
      const specialRoutes: AppRoutes = {
        '/special-chars_route': { component: 'Special', intent: 'special', breadcrumb: 'Special Route', tab: 'special' }
      };
      
      await act(async () => {
        renderBreadcrumbWithRouter(specialRoutes, undefined, ['/special-chars_route']);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-current-special-route')).toBeDefined();
      });
    });

    it('render() - should handle numeric path segments', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/accounts/123/details']);
      });
      
      await waitFor(() => {
        // Should render fallback breadcrumb for path with numeric segments
        expect(screen.getByTestId('breadcrumb-navigation')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-details')).toBeDefined();
      });
    });
  });

  describe('Integration with React Router', () => {
    it('render() - should work with different routing contexts', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/banking/transfers']);
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-navigation')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-transfers')).toBeDefined();
      });
    });

    it('render() - should maintain link functionality', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/banking/accounts']);
      });
      
      await waitFor(() => {
        const breadcrumbLink = screen.getByTestId('breadcrumb-link-banking');
        expect(breadcrumbLink.getAttribute('href')).toBe('/banking');
        expect(breadcrumbLink.tagName.toLowerCase()).toBe('a');
      });
    });

    it('MemoryRouter - should work within routing context', async () => {
      await act(async () => {
        render(
          <MantineProvider>
            <MemoryRouter initialEntries={['/banking/transfers/wire']}>
              <Breadcrumb appRoutes={mockAppRoutes} />
            </MemoryRouter>
          </MantineProvider>
        );
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-navigation')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-link-banking')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-link-transfers')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-wire-transfer')).toBeDefined();
      });
    });
  });

  describe('Functional Attribute Testing', () => {
    it('render() - should set correct test IDs for navigation links', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/banking/transfers/wire']);
      });
      
      await waitFor(() => {
        const bankingLink = screen.getByTestId('breadcrumb-link-banking');
        const transfersLink = screen.getByTestId('breadcrumb-link-transfers');
        const currentPage = screen.getByTestId('breadcrumb-current-wire-transfer');
        
        // Test functional attributes only
        expect(bankingLink.getAttribute('href')).toBe('/banking');
        expect(transfersLink.getAttribute('href')).toBe('/banking/transfers');
        expect(currentPage.getAttribute('href')).toBeNull(); // Current page is not a link
      });
    });

    it('render() - should have correct element types for different breadcrumb states', async () => {
      await act(async () => {
        renderBreadcrumbWithRouter(mockAppRoutes, undefined, ['/banking/accounts']);
      });
      
      await waitFor(() => {
        const navigationLink = screen.getByTestId('breadcrumb-link-banking');
        const currentPage = screen.getByTestId('breadcrumb-current-accounts');
        
        expect(navigationLink.tagName.toLowerCase()).toBe('a');
        expect(currentPage.tagName.toLowerCase()).toBe('p'); // Mantine Text renders as p
      });
    });

    it('render() - should maintain navigation functionality across different routes', async () => {
      const testRoutes = [
        '/banking/accounts',
        '/banking/transfers', 
        '/banking/transfers/wire',
        '/chat'
      ];
      
      for (const route of testRoutes) {
        cleanup();
        
        await act(async () => {
          renderBreadcrumbWithRouter(mockAppRoutes, undefined, [route]);
        });
        
        if (route !== '/chat') { // Chat has no parent breadcrumbs
          await waitFor(() => {
            const breadcrumbNav = screen.getByTestId('breadcrumb-navigation');
            expect(breadcrumbNav).toBeDefined();
            
            // Should have at least one breadcrumb element
            const breadcrumbElements = breadcrumbNav.querySelectorAll('[data-testid*="breadcrumb-"]');
            expect(breadcrumbElements.length).toBeGreaterThan(0);
          });
        }
      }
    });
  });
});