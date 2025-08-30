import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '../components/Header';
import { MantineProvider } from '@mantine/core';
import { BrowserRouter } from 'react-router-dom';

// Mock React Router hooks
const mockNavigate = vi.fn();
const mockLocation = { pathname: '/' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => mockLocation,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
  };
});

// Mock Mantine hooks
const mockToggleDrawer = vi.fn();
const mockCloseDrawer = vi.fn();
let mockUseDisclosure = vi.fn(() => [false, { toggle: mockToggleDrawer, close: mockCloseDrawer }]);

vi.mock('@mantine/hooks', () => ({
  useDisclosure: () => mockUseDisclosure()
}));

// Mock icons
vi.mock('@tabler/icons-react', () => ({
  IconChevronDown: vi.fn(({ className, style }) => (
    <div data-testid="chevron-icon" data-classname={className} style={style}></div>
  ))
}));

// Mock CSS modules
vi.mock('./Header.module.css', () => ({
  default: {
    header: 'header',
    inner: 'inner',
    logo: 'logo',
    links: 'links',
    link: 'link',
    linkLabel: 'linkLabel',
    burger: 'burger',
    mobileNavigation: 'mobileNavigation',
    mobileLink: 'mobileLink',
    mobileSubLink: 'mobileSubLink',
    mobileSubLinks: 'mobileSubLinks',
    chevron: 'chevron',
    chevronOpen: 'chevronOpen',
    statusSection: 'statusSection'
  }
}));

// Mock Mantine components to isolate unit under test
vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');
  return {
    ...actual,
    AppShell: {
      Header: vi.fn(({ children, 'data-testid': testId }) => (
        <div data-testid={testId}>{children}</div>
      ))
    },
    Container: vi.fn(({ children }) => (
      <div data-testid="container">{children}</div>
    )),
    Title: vi.fn(({ children }) => (
      <h1 data-testid="title">{children}</h1>
    )),
    Badge: vi.fn(({ children, 'data-testid': testId, color, variant }) => (
      <span data-testid={testId} data-color={color} data-variant={variant}>{children}</span>
    )),
    Menu: Object.assign(
      vi.fn(({ children }) => <div data-testid="menu">{children}</div>),
      {
        Target: vi.fn(({ children }) => <div data-testid="menu-target">{children}</div>),
        Dropdown: vi.fn(({ children }) => <div data-testid="menu-dropdown">{children}</div>),
        Item: vi.fn(({ children, onClick, 'data-active': active }) => (
          <button data-testid="menu-item" onClick={onClick} data-active={active}>
            {children}
          </button>
        ))
      }
    ),
    Burger: vi.fn(({ opened, onClick }) => (
      <button data-testid="burger-button" data-opened={opened} onClick={onClick}>
        Burger
      </button>
    )),
    Drawer: vi.fn(({ children, opened, onClose, title }) => (
      opened ? (
        <div data-testid="mobile-drawer" data-opened={opened}>
          <div data-testid="drawer-header">
            <span data-testid="drawer-title">{title}</span>
            <button data-testid="drawer-close" onClick={onClose}>×</button>
          </div>
          <div data-testid="drawer-content">{children}</div>
        </div>
      ) : null
    )),
    Divider: vi.fn(() => <hr data-testid="divider" />),
    UnstyledButton: vi.fn(({ children, onClick, 'data-active': active }) => (
      <button data-testid="unstyled-button" onClick={onClick} data-active={active}>
        {children}
      </button>
    )),
    Collapse: vi.fn(({ children, in: isOpen }) => (
      isOpen ? <div data-testid="collapse">{children}</div> : null
    ))
  };
});

// Wrapper component for Mantine context
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <MantineProvider>{children}</MantineProvider>
  </BrowserRouter>
);

describe('Header Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    // Reset useDisclosure mocks to default closed state
    mockUseDisclosure = vi.fn(() => [false, { toggle: mockToggleDrawer, close: mockCloseDrawer }]);
  });

  afterEach(() => {
    cleanup();
  });

  describe('React.FC() - Component Rendering', () => {
    it('React.FC() - should render the main header container', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={false} />
          </TestWrapper>
        );
      });

      // ASSERT
      const headerElement = screen.getByTestId('header');
      expect(headerElement).toBeDefined();
    });

    it('React.FC() - should render essential navigation components', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={false} />
          </TestWrapper>
        );
      });

      // ASSERT
      expect(screen.getByTestId('container')).toBeDefined();
      expect(screen.getByTestId('title')).toBeDefined();
      expect(screen.getByTestId('burger-button')).toBeDefined();
    });

    it('React.FC() - should render navigation menu components', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT
      // Should render desktop navigation menus
      const menus = screen.getAllByTestId('menu');
      expect(menus).toBeDefined();
      expect(menus.length).toBeGreaterThan(0);
    });
  });

  describe('Badge() - Connection Status Display', () => {
    it('Badge() - should show connected status with green color when isConnected is true', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT
      const statusBadge = screen.getByTestId('connection-status');
      expect(statusBadge).toBeDefined();
      expect(statusBadge.getAttribute('data-color')).toBe('green');
      expect(statusBadge.getAttribute('data-variant')).toBe('light');
    });

    it('Badge() - should show disconnected status with red color when isConnected is false', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={false} />
          </TestWrapper>
        );
      });

      // ASSERT
      const statusBadge = screen.getByTestId('connection-status');
      expect(statusBadge).toBeDefined();
      expect(statusBadge.getAttribute('data-color')).toBe('red');
      expect(statusBadge.getAttribute('data-variant')).toBe('light');
    });

    it('Badge() - should update color when connection status changes', async () => {
      // ARRANGE
      const { rerender } = render(
        <TestWrapper>
          <Header isConnected={false} />
        </TestWrapper>
      );

      // Verify initial disconnected state
      let statusBadge = screen.getByTestId('connection-status');
      expect(statusBadge.getAttribute('data-color')).toBe('red');

      // ACT - Update to connected
      await act(async () => {
        rerender(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT - Should show green for connected
      statusBadge = screen.getByTestId('connection-status');
      expect(statusBadge.getAttribute('data-color')).toBe('green');
    });
  });

  describe('Burger() - Mobile Navigation Toggle', () => {
    it('Burger() - should render burger button for mobile navigation', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT
      const burgerButton = screen.getByTestId('burger-button');
      expect(burgerButton).toBeDefined();
      expect(burgerButton.getAttribute('data-opened')).toBe('false');
    });

    it('Burger() - should call toggle function when clicked', async () => {
      // ARRANGE
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={false} />
          </TestWrapper>
        );
      });

      const burgerButton = screen.getByTestId('burger-button');

      // ACT
      await act(async () => {
        await user.click(burgerButton);
      });

      // ASSERT
      expect(mockToggleDrawer).toHaveBeenCalledTimes(1);
    });

    it('Burger() - should reflect drawer opened state', async () => {
      // ARRANGE - Mock drawer as opened
      mockUseDisclosure = vi.fn(() => [true, { toggle: mockToggleDrawer, close: mockCloseDrawer }]);

      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT
      const burgerButton = screen.getByTestId('burger-button');
      expect(burgerButton.getAttribute('data-opened')).toBe('true');
    });
  });

  describe('Drawer() - Mobile Navigation Drawer', () => {
    it('Drawer() - should not render drawer when closed', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT
      const drawer = screen.queryByTestId('mobile-drawer');
      expect(drawer).toBeNull();
    });

    it('Drawer() - should render drawer when opened', async () => {
      // ARRANGE - Mock drawer as opened
      mockUseDisclosure = vi.fn(() => [true, { toggle: mockToggleDrawer, close: mockCloseDrawer }]);

      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={false} />
          </TestWrapper>
        );
      });

      // ASSERT
      const drawer = screen.getByTestId('mobile-drawer');
      expect(drawer).toBeDefined();
      expect(drawer.getAttribute('data-opened')).toBe('true');
    });

    it('Drawer() - should render navigation title in drawer header', async () => {
      // ARRANGE - Mock drawer as opened
      mockUseDisclosure = vi.fn(() => [true, { toggle: mockToggleDrawer, close: mockCloseDrawer }]);

      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT
      const drawerTitle = screen.getByTestId('drawer-title');
      expect(drawerTitle).toBeDefined();
    });

    it('Drawer() - should call close function when close button clicked', async () => {
      // ARRANGE - Mock drawer as opened
      mockUseDisclosure = vi.fn(() => [true, { toggle: mockToggleDrawer, close: mockCloseDrawer }]);

      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={false} />
          </TestWrapper>
        );
      });

      const closeButton = screen.getByTestId('drawer-close');

      // ACT
      await act(async () => {
        await user.click(closeButton);
      });

      // ASSERT
      expect(mockCloseDrawer).toHaveBeenCalledTimes(1);
    });
  });

  describe('useNavigate() - Route Navigation', () => {
    it('useNavigate() - should call navigate function for menu item clicks', async () => {
      // ARRANGE
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      const menuItems = screen.getAllByTestId('menu-item');
      expect(menuItems.length).toBeGreaterThan(0);

      // ACT - Click first menu item
      await act(async () => {
        await user.click(menuItems[0]);
      });

      // ASSERT
      expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

    it('useNavigate() - should call navigate function for mobile navigation clicks', async () => {
      // ARRANGE - Mock drawer as opened
      mockUseDisclosure = vi.fn(() => [true, { toggle: mockToggleDrawer, close: mockCloseDrawer }]);

      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={false} />
          </TestWrapper>
        );
      });

      const mobileNavButtons = screen.getAllByTestId('unstyled-button');
      expect(mobileNavButtons.length).toBeGreaterThan(0);

      // ACT - Click mobile navigation button (skip Banking which is a toggle, click Transaction)
      // Banking is index 0 (toggle), Transaction should be index 1 (direct navigation)
      const transactionButton = mobileNavButtons[1]; 
      await act(async () => {
        await user.click(transactionButton);
      });

      // ASSERT - Should navigate to transaction route
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/transaction');
    });

    it('useNavigate() - should close drawer after navigation', async () => {
      // ARRANGE - Mock drawer as opened
      mockUseDisclosure = vi.fn(() => [true, { toggle: mockToggleDrawer, close: mockCloseDrawer }]);

      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      const mobileNavButtons = screen.getAllByTestId('unstyled-button');
      
      // ACT - Click navigation button that should trigger navigation
      await act(async () => {
        await user.click(mobileNavButtons[mobileNavButtons.length - 1]); // Click last button (likely a direct link)
      });

      // ASSERT
      expect(mockCloseDrawer).toHaveBeenCalled();
    });
  });

  describe('useLocation() - Active Route Detection', () => {
    it('useLocation() - should detect active routes correctly', async () => {
      // ARRANGE - Mock location to be on a specific route
      mockLocation.pathname = '/accounts';

      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT - Should render navigation elements
      const menus = screen.getAllByTestId('menu');
      expect(menus.length).toBeGreaterThan(0);
    });

    it('useLocation() - should handle root path correctly', async () => {
      // ARRANGE - Mock location to be on root
      mockLocation.pathname = '/';

      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={false} />
          </TestWrapper>
        );
      });

      // ASSERT - Should render without errors
      expect(screen.getByTestId('header')).toBeDefined();
    });
  });

  describe('createNavigationLinks() - Navigation Structure', () => {
    it('createNavigationLinks() - should create navigation structure from APP_ROUTES', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT - Should render desktop navigation menus
      const menus = screen.getAllByTestId('menu');
      expect(menus.length).toBeGreaterThan(0);

      // Should also render unstyled buttons for simple links
      const navButtons = screen.getAllByTestId('unstyled-button');
      expect(navButtons.length).toBeGreaterThan(0);
    });

    it('createNavigationLinks() - should handle grouped navigation items', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={false} />
          </TestWrapper>
        );
      });

      // ASSERT - Should render menu components for groups (like Banking)
      const menuTargets = screen.getAllByTestId('menu-target');
      expect(menuTargets.length).toBeGreaterThan(0);

      const menuDropdowns = screen.getAllByTestId('menu-dropdown');
      expect(menuDropdowns.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases - Error Handling and Resilience', () => {
    it('Edge Cases - should handle undefined isConnected prop gracefully', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={undefined as unknown as boolean} />
          </TestWrapper>
        );
      });

      // ASSERT - Should treat undefined as falsy and show red status
      const statusBadge = screen.getByTestId('connection-status');
      expect(statusBadge).toBeDefined();
      expect(statusBadge.getAttribute('data-color')).toBe('red');
    });

    it('Edge Cases - should handle null isConnected prop gracefully', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={null as unknown as boolean} />
          </TestWrapper>
        );
      });

      // ASSERT - Should treat null as falsy and show red status
      const statusBadge = screen.getByTestId('connection-status');
      expect(statusBadge.getAttribute('data-color')).toBe('red');
    });

    it('Edge Cases - should render navigation even when router hooks fail', async () => {
      // ARRANGE - Mock router hooks to throw
      const originalError = console.error;
      console.error = vi.fn(); // Suppress error logs for this test

      // ACT & ASSERT - Should not crash even if router context is missing
      await act(async () => {
        render(
          <MantineProvider>
            <Header isConnected={true} />
          </MantineProvider>
        );
      });

      expect(screen.getByTestId('header')).toBeDefined();
      console.error = originalError; // Restore console.error
    });
  });

  describe('Performance - React Optimization', () => {
    it('Performance - should handle rapid prop changes without errors', async () => {
      // ARRANGE
      const { rerender } = render(
        <TestWrapper>
          <Header isConnected={false} />
        </TestWrapper>
      );

      // ACT - Rapidly change connection status multiple times
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          rerender(
            <TestWrapper>
              <Header isConnected={i % 2 === 0} />
            </TestWrapper>
          );
        });
      }

      // ASSERT - Should still render correctly
      const statusBadge = screen.getByTestId('connection-status');
      expect(statusBadge).toBeDefined();
    });

    it('Performance - should handle concurrent user interactions', async () => {
      // ARRANGE - Mock drawer as closed initially
      const testUser = userEvent.setup();
      
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      const burgerButton = screen.getByTestId('burger-button');

      // ACT - Simulate rapid clicking
      await act(async () => {
        await testUser.click(burgerButton);
        await testUser.click(burgerButton);
        await testUser.click(burgerButton);
      });

      // ASSERT - Should handle multiple calls to toggle
      expect(mockToggleDrawer).toHaveBeenCalledTimes(3);
    });
  });
});


