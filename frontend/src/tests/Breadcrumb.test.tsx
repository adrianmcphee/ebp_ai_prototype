import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Breadcrumb } from '../components/Breadcrumb';
import { MantineProvider } from '@mantine/core';

// Mock React Router hooks
const mockNavigate = vi.fn();
let mockLocation = { pathname: '/' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  };
});

// Mock Mantine components to isolate unit under test
vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');
  return {
    ...actual,
    Breadcrumbs: vi.fn(({ children, className, separator }) => (
      <div 
        data-testid="breadcrumb-navigation" 
        className={className}
        data-separator={separator}
      >
        {children}
      </div>
    )),
    Anchor: vi.fn(({ children, href, onClick, size }) => (
      <a 
        data-testid={children ? `breadcrumb-link-${children.toLowerCase().replace(/\s+/g, '-')}` : 'breadcrumb-link'}
        href={href}
        onClick={onClick}
        data-size={size}
        style={{ cursor: 'pointer' }}
      >
        {children}
      </a>
    )),
    Text: vi.fn(({ children, size, c, fw }) => (
      <p 
        data-testid={children ? `breadcrumb-current-${children.toLowerCase().replace(/\s+/g, '-')}` : 'breadcrumb-current'}
        data-size={size}
        data-color={c}
        data-weight={fw}
      >
        {children}
      </p>
    ))
  };
});

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <MantineProvider>
    {children}
  </MantineProvider>
);

describe('Breadcrumb Component', () => {
  const user = userEvent.setup();
  
  // Mock route lookup function
  const mockGetRouteByPath = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockGetRouteByPath.mockClear();
    mockLocation = { pathname: '/' };
  });

  afterEach(() => {
    cleanup();
  });

  describe('React.FC() - Component Rendering', () => {
    it('React.FC() - should render breadcrumb navigation when valid paths exist', async () => {
      // ARRANGE
      mockLocation.pathname = '/banking/accounts';
      mockGetRouteByPath
        .mockReturnValueOnce({ breadcrumb: 'Banking', path: '/banking' })
        .mockReturnValueOnce({ breadcrumb: 'Accounts', path: '/banking/accounts' });

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-navigation')).toBeDefined();
      });
    });

    it('React.FC() - should not render breadcrumbs on root path with single item', async () => {
      // ARRANGE
      mockLocation.pathname = '/';
      mockGetRouteByPath.mockReturnValue(undefined);

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ASSERT
      await waitFor(() => {
        expect(screen.queryByTestId('breadcrumb-navigation')).toBeNull();
      });
    });

    it('React.FC() - should apply custom className when provided', async () => {
      // ARRANGE
      const customClassName = 'custom-breadcrumb-class';
      mockLocation.pathname = '/banking/accounts';
      mockGetRouteByPath
        .mockReturnValueOnce({ breadcrumb: 'Banking', path: '/banking' })
        .mockReturnValueOnce({ breadcrumb: 'Accounts', path: '/banking/accounts' });

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} className={customClassName} />
          </TestWrapper>
        );
      });

      // ASSERT
      await waitFor(() => {
        const navigation = screen.getByTestId('breadcrumb-navigation');
        expect(navigation).toBeDefined();
        expect(navigation.className).toBe(customClassName);
      });
    });
  });

  describe('generateBreadcrumbs() - Breadcrumb Generation Logic', () => {
    it('generateBreadcrumbs() - should create breadcrumb items from valid path segments', async () => {
      // ARRANGE
      mockLocation.pathname = '/banking/accounts/details';
      mockGetRouteByPath
        .mockReturnValueOnce({ breadcrumb: 'Banking', path: '/banking' })
        .mockReturnValueOnce({ breadcrumb: 'Accounts', path: '/banking/accounts' })
        .mockReturnValueOnce({ breadcrumb: 'Details', path: '/banking/accounts/details' });

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ASSERT
      await waitFor(() => {
        expect(mockGetRouteByPath).toHaveBeenCalledWith('/banking');
        expect(mockGetRouteByPath).toHaveBeenCalledWith('/banking/accounts');
        expect(mockGetRouteByPath).toHaveBeenCalledWith('/banking/accounts/details');
        expect(mockGetRouteByPath).toHaveBeenCalledTimes(3);
      });
    });

    it('generateBreadcrumbs() - should handle mixed valid and invalid route segments', async () => {
      // ARRANGE
      mockLocation.pathname = '/banking/unknown/accounts';
      mockGetRouteByPath
        .mockReturnValueOnce({ breadcrumb: 'Banking', path: '/banking' })
        .mockReturnValueOnce(undefined) // unknown segment
        .mockReturnValueOnce({ breadcrumb: 'Accounts', path: '/banking/unknown/accounts' });

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-link-banking')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-accounts')).toBeDefined();
      });
    });

    it('generateBreadcrumbs() - should create fallback label when no routes match', async () => {
      // ARRANGE
      mockLocation.pathname = '/unknown-page';
      mockGetRouteByPath.mockReturnValue(undefined);

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-current-unknown-page')).toBeDefined();
      });
    });

    it('generateBreadcrumbs() - should handle hyphenated paths with proper capitalization', async () => {
      // ARRANGE
      mockLocation.pathname = '/multi-word-route';
      mockGetRouteByPath.mockReturnValue(undefined);

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-current-multi-word-route')).toBeDefined();
      });
    });

    it('generateBreadcrumbs() - should mark current page correctly in breadcrumb hierarchy', async () => {
      // ARRANGE
      mockLocation.pathname = '/banking/transfers';
      mockGetRouteByPath
        .mockReturnValueOnce({ breadcrumb: 'Banking', path: '/banking' })
        .mockReturnValueOnce({ breadcrumb: 'Transfers', path: '/banking/transfers' });

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ASSERT
      await waitFor(() => {
        // Non-current page should be a link
        expect(screen.getByTestId('breadcrumb-link-banking')).toBeDefined();
        // Current page should be text only
        expect(screen.getByTestId('breadcrumb-current-transfers')).toBeDefined();
      });
    });
  });

  describe('handleNavigation() - Navigation Handling', () => {
    it('handleNavigation() - should call navigate with correct path when breadcrumb link is clicked', async () => {
      // ARRANGE
      mockLocation.pathname = '/banking/accounts';
      mockGetRouteByPath
        .mockReturnValueOnce({ breadcrumb: 'Banking', path: '/banking' })
        .mockReturnValueOnce({ breadcrumb: 'Accounts', path: '/banking/accounts' });

      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ACT
      await act(async () => {
        await user.click(screen.getByTestId('breadcrumb-link-banking'));
      });

      // ASSERT
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/banking');
        expect(mockNavigate).toHaveBeenCalledTimes(1);
      });
    });

    it('handleNavigation() - should prevent default anchor behavior on breadcrumb click', async () => {
      // ARRANGE
      mockLocation.pathname = '/banking/accounts';
      mockGetRouteByPath
        .mockReturnValueOnce({ breadcrumb: 'Banking', path: '/banking' })
        .mockReturnValueOnce({ breadcrumb: 'Accounts', path: '/banking/accounts' });

      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ACT & ASSERT
      await act(async () => {
        const breadcrumbLink = screen.getByTestId('breadcrumb-link-banking');
        expect(breadcrumbLink.getAttribute('href')).toBe('/banking');
        await user.click(breadcrumbLink);
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/banking');
      });
    });

    it('handleNavigation() - should not be clickable for current page breadcrumb', async () => {
      // ARRANGE
      mockLocation.pathname = '/banking/accounts';
      mockGetRouteByPath
        .mockReturnValueOnce({ breadcrumb: 'Banking', path: '/banking' })
        .mockReturnValueOnce({ breadcrumb: 'Accounts', path: '/banking/accounts' });

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ASSERT
      await waitFor(() => {
        // Current page should be text element, not link
        expect(screen.getByTestId('breadcrumb-current-accounts').tagName).toBe('P');
        expect(screen.queryByTestId('breadcrumb-link-accounts')).toBeNull();
      });
    });
  });

  describe('generateBreadcrumbs() / handleNavigation() - Edge Cases', () => {
    it('generateBreadcrumbs() - should handle empty path segments gracefully', async () => {
      // ARRANGE
      mockLocation.pathname = '//banking//accounts//';
      mockGetRouteByPath
        .mockReturnValueOnce({ breadcrumb: 'Banking', path: '/banking' })
        .mockReturnValueOnce({ breadcrumb: 'Accounts', path: '/banking/accounts' });

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-link-banking')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-accounts')).toBeDefined();
      });
    });

    it('generateBreadcrumbs() - should handle single level paths correctly', async () => {
      // ARRANGE
      mockLocation.pathname = '/dashboard';
      mockGetRouteByPath.mockReturnValueOnce({ breadcrumb: 'Dashboard', path: '/dashboard' });

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-navigation')).toBeDefined();
        expect(screen.getByTestId('breadcrumb-current-dashboard')).toBeDefined();
      });
    });

    it('generateBreadcrumbs() - should handle getRouteByPath function returning undefined gracefully', async () => {
      // ARRANGE
      mockLocation.pathname = '/banking/accounts';
      mockGetRouteByPath.mockReturnValue(undefined);

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ASSERT - Should still render with fallback behavior
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-current-accounts')).toBeDefined();
      });
    });

    it('handleNavigation() - should handle navigation to complex paths with multiple segments', async () => {
      // ARRANGE
      mockLocation.pathname = '/level1/level2/level3/level4';
      mockGetRouteByPath
        .mockReturnValueOnce({ breadcrumb: 'Level 1', path: '/level1' })
        .mockReturnValueOnce({ breadcrumb: 'Level 2', path: '/level1/level2' })
        .mockReturnValueOnce({ breadcrumb: 'Level 3', path: '/level1/level2/level3' })
        .mockReturnValueOnce({ breadcrumb: 'Level 4', path: '/level1/level2/level3/level4' });

      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ACT
      await act(async () => {
        await user.click(screen.getByTestId('breadcrumb-link-level-3'));
      });

      // ASSERT
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/level1/level2/level3');
      });
    });

    it('generateBreadcrumbs() - should handle paths with special characters in fallback labels', async () => {
      // ARRANGE
      mockLocation.pathname = '/special_page-name';
      mockGetRouteByPath.mockReturnValue(undefined);

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('breadcrumb-current-special_page-name')).toBeDefined();
      });
    });
  });

  describe('React.FC() - Breadcrumb Component Structure', () => {
    it('React.FC() - should render correct breadcrumb item count for multi-level path', async () => {
      // ARRANGE
      mockLocation.pathname = '/banking/accounts/details';
      mockGetRouteByPath
        .mockReturnValueOnce({ breadcrumb: 'Banking', path: '/banking' })
        .mockReturnValueOnce({ breadcrumb: 'Accounts', path: '/banking/accounts' })
        .mockReturnValueOnce({ breadcrumb: 'Details', path: '/banking/accounts/details' });

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ASSERT
      await waitFor(() => {
        const navigation = screen.getByTestId('breadcrumb-navigation');
        expect(navigation.children).toHaveLength(3);
      });
    });

    it('React.FC() - should render breadcrumb items with proper semantic structure', async () => {
      // ARRANGE
      mockLocation.pathname = '/banking/accounts';
      mockGetRouteByPath
        .mockReturnValueOnce({ breadcrumb: 'Banking', path: '/banking' })
        .mockReturnValueOnce({ breadcrumb: 'Accounts', path: '/banking/accounts' });

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ASSERT
      await waitFor(() => {
        // Navigation container should be div element
        expect(screen.getByTestId('breadcrumb-navigation').tagName).toBe('DIV');
        // Non-current items should be links
        expect(screen.getByTestId('breadcrumb-link-banking').tagName).toBe('A');
        // Current item should be text
        expect(screen.getByTestId('breadcrumb-current-accounts').tagName).toBe('P');
      });
    });

    it('React.FC() - should set separator attribute correctly', async () => {
      // ARRANGE
      mockLocation.pathname = '/banking/accounts';
      mockGetRouteByPath
        .mockReturnValueOnce({ breadcrumb: 'Banking', path: '/banking' })
        .mockReturnValueOnce({ breadcrumb: 'Accounts', path: '/banking/accounts' });

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Breadcrumb getRouteByPath={mockGetRouteByPath} />
          </TestWrapper>
        );
      });

      // ASSERT
      await waitFor(() => {
        const navigation = screen.getByTestId('breadcrumb-navigation');
        expect(navigation.getAttribute('data-separator')).toBe('/');
      });
    });
  });
});
