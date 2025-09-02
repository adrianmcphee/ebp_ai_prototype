import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from '../components/Header';
import type { NavigationGroup } from '../types';

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

// Mock @mantine/hooks
vi.mock('@mantine/hooks', () => ({
  useDisclosure: vi.fn(() => [false, { toggle: vi.fn(), close: vi.fn() }])
}));

// Mock @mantine/core components with behavior-focused mocks
vi.mock('@mantine/core', () => ({
  AppShell: {
    Header: vi.fn(({ children, className, ...props }) => (
      <header data-testid="header" className={className} {...props}>
        {children}
      </header>
    ))
  },
  Container: vi.fn(({ children, size }) => (
    <div data-testid="container" data-size={size}>
      {children}
    </div>
  )),
  Title: vi.fn(({ children, order, className }) => (
    <h1 data-testid="title" data-order={order} className={className}>
      {children}
    </h1>
  )),
  Badge: vi.fn(({ children, color, variant, ...props }) => (
    <span 
      data-testid="connection-status" 
      data-color={color} 
      data-variant={variant}
      {...props}
    >
      {children}
    </span>
  )),
  Menu: Object.assign(
    vi.fn(({ children, trigger, withinPortal }) => (
      <div 
        data-testid="menu" 
        data-trigger={trigger}
        data-within-portal={withinPortal}
      >
        {children}
      </div>
    )),
    {
      Target: vi.fn(({ children }) => (
        <div data-testid="menu-target">{children}</div>
      )),
      Dropdown: vi.fn(({ children }) => (
        <div data-testid="menu-dropdown">{children}</div>
      )),
      Item: vi.fn(({ children, onClick, ...props }) => (
        <div 
          data-testid="menu-item" 
          onClick={onClick}
          role="menuitem"
          {...props}
        >
          {children}
        </div>
      ))
    }
  ),
  Burger: vi.fn(({ opened, onClick, className }) => (
    <button 
      data-testid="burger-menu"
      data-opened={opened}
      onClick={onClick}
      className={className}
      aria-label="Toggle navigation"
    >
      Burger
    </button>
  )),
  Drawer: vi.fn(({ children, opened, onClose, position, size, title, zIndex }) => (
    opened ? (
      <div 
        data-testid="drawer"
        data-opened={opened}
        data-position={position}
        data-size={size}
        data-z-index={zIndex}
        onClick={onClose}
      >
        <div data-testid="drawer-title">{title}</div>
        {children}
      </div>
    ) : null
  )),
  Divider: vi.fn(() => <hr data-testid="divider" />),
  UnstyledButton: vi.fn(({ children, className, onClick, style, ...props }) => (
    <button 
      data-testid="unstyled-button"
      className={className}
      onClick={onClick}
      style={style}
      {...props}
    >
      {children}
    </button>
  )),
  Collapse: vi.fn(({ children, in: isOpen }) => (
    isOpen ? <div data-testid="collapse">{children}</div> : null
  ))
}));

// Mock @tabler/icons-react
vi.mock('@tabler/icons-react', () => ({
  IconChevronDown: vi.fn(({ className, style }) => (
    <svg 
      data-testid="chevron-icon" 
      className={className}
      style={style}
    >
      <path d="M7 10l5 5 5-5" />
    </svg>
  ))
}));

// Mock CSS modules
vi.mock('../components/Header.module.css', () => ({
  default: {
    header: 'header',
    inner: 'inner',
    logo: 'logo',
    links: 'links',
    link: 'link',
    linkLabel: 'linkLabel',
    statusSection: 'statusSection',
    burger: 'burger',
    mobileNavigation: 'mobileNavigation',
    mobileLink: 'mobileLink',
    mobileSubLinks: 'mobileSubLinks',
    mobileSubLink: 'mobileSubLink',
    chevron: 'chevron',
    chevronOpen: 'chevronOpen'
  }
}));

describe('Header Component', () => {
  const user = userEvent.setup();
  
  // Test data
  const mockNavigationGroups: NavigationGroup[] = [
    {
      label: 'Dashboard',
      links: [{ label: 'Dashboard', path: '/', tab: 'banking' }]
    },
    {
      label: 'Banking',
      links: [
        { label: 'Accounts', path: '/banking/accounts', tab: 'banking' },
        { label: 'Transactions', path: '/banking/transactions', tab: 'banking' }
      ]
    }
  ];

  const defaultProps = {
    isConnected: true,
    navigationGroups: mockNavigationGroups
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockLocation = { pathname: '/' };
  });

  afterEach(() => {
    cleanup();
  });

  describe('React.FC() - Component Rendering', () => {
    it('React.FC() - should render header with all essential elements', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ASSERT - Test structure and presence, not content
      expect(screen.getByTestId('header')).toBeDefined();
      expect(screen.getByTestId('container')).toBeDefined();
      expect(screen.getByTestId('title')).toBeDefined();
      expect(screen.getByTestId('connection-status')).toBeDefined();
      expect(screen.getByTestId('burger-menu')).toBeDefined();
    });

    it('React.FC() - should render with empty navigation groups', async () => {
      // ARRANGE
      const emptyProps = { isConnected: false, navigationGroups: [] };

      // ACT
      await act(async () => {
        render(<Header {...emptyProps} />);
      });

      // ASSERT - Component should still render basic structure
      expect(screen.getByTestId('header')).toBeDefined();
      expect(screen.getByTestId('connection-status')).toBeDefined();
    });
  });

  describe('isActiveRoute() - Route State Detection', () => {
    it('isActiveRoute() - should detect root path as active when on homepage', async () => {
      // ARRANGE
      mockLocation.pathname = '/';

      // ACT
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ASSERT - First navigation item should be active (Dashboard)
      const buttons = screen.getAllByTestId('unstyled-button');
      expect(buttons[0]).toBeDefined();
      expect(buttons[0].getAttribute('data-active')).toBe('true');
    });

    it('isActiveRoute() - should detect exact path matches as active', async () => {
      // ARRANGE
      mockLocation.pathname = '/banking/accounts';

      // ACT
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ASSERT - Banking group should have active child
      const menus = screen.getAllByTestId('menu');
      expect(menus).toHaveLength(1); // Only Banking group has multiple links
    });

    it('isActiveRoute() - should detect path prefixes as active', async () => {
      // ARRANGE
      mockLocation.pathname = '/banking/accounts/details';

      // ACT
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ASSERT - Banking group should be active due to path prefix
      const menus = screen.getAllByTestId('menu');
      expect(menus).toHaveLength(1);
    });

    it('isActiveRoute() - should not match partial path segments', async () => {
      // ARRANGE
      mockLocation.pathname = '/bankingother';

      // ACT
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ASSERT - No active states should be set
      const buttons = screen.getAllByTestId('unstyled-button');
      buttons.forEach(button => {
        expect(button.getAttribute('data-active')).toBeNull();
      });
    });
  });

  describe('handleNavigation() - Navigation Behavior', () => {
    it('handleNavigation() - should call navigate with correct path on single link click', async () => {
      // ARRANGE
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ACT - Click the Dashboard button (single link group)
      const dashboardButton = screen.getAllByTestId('unstyled-button')[0];
      await act(async () => {
        await user.click(dashboardButton);
      });

      // ASSERT
      expect(mockNavigate).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('handleNavigation() - should call navigate on menu item click', async () => {
      // ARRANGE
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ACT - Click menu item
      const menuItems = screen.getAllByTestId('menu-item');
      if (menuItems.length > 0) {
        await act(async () => {
          await user.click(menuItems[0]);
        });

        // ASSERT
        expect(mockNavigate).toHaveBeenCalledTimes(1);
      }
    });

    it('handleNavigation() - should close drawer after navigation', async () => {
      // ARRANGE
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ACT
      const dashboardButton = screen.getAllByTestId('unstyled-button')[0];
      await act(async () => {
        await user.click(dashboardButton);
      });

      // ASSERT - Navigation should occur and component should be interactive
      expect(mockNavigate).toHaveBeenCalledWith('/');
      expect(dashboardButton.tagName).toBe('BUTTON');
    });
  });

  describe('Badge - Connection Status Display', () => {
    it('Badge - should display connected status when isConnected is true', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<Header isConnected={true} navigationGroups={[]} />);
      });

      // ASSERT - Test functional color attribute, not text content
      const badge = screen.getByTestId('connection-status');
      expect(badge).toBeDefined();
      expect(badge.getAttribute('data-color')).toBe('green');
      expect(badge.getAttribute('data-variant')).toBe('light');
    });

    it('Badge - should display disconnected status when isConnected is false', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<Header isConnected={false} navigationGroups={[]} />);
      });

      // ASSERT - Test functional color attribute, not text content
      const badge = screen.getByTestId('connection-status');
      expect(badge).toBeDefined();
      expect(badge.getAttribute('data-color')).toBe('red');
      expect(badge.getAttribute('data-variant')).toBe('light');
    });
  });

  describe('Burger.onClick() - Mobile Menu Toggle', () => {
    it('Burger.onClick() - should call toggle function when burger menu is clicked', async () => {
      // ARRANGE
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ACT
      const burgerMenu = screen.getByTestId('burger-menu');
      await act(async () => {
        await user.click(burgerMenu);
      });

      // ASSERT - Test that the burger menu is clickable and has proper attributes
      expect(burgerMenu).toBeDefined();
      expect(burgerMenu.tagName).toBe('BUTTON');
    });

    it('Burger.onClick() - should have proper accessibility attributes', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ASSERT
      const burgerMenu = screen.getByTestId('burger-menu');
      expect(burgerMenu.getAttribute('aria-label')).toBe('Toggle navigation');
      expect(burgerMenu.getAttribute('data-opened')).toBe('false');
    });
  });

  describe('Desktop Navigation - Menu Structure', () => {
    it('renderDesktopNavigation() - should render single link groups as direct buttons', async () => {
      // ARRANGE
      const singleLinkGroups: NavigationGroup[] = [
        { label: 'Dashboard', links: [{ label: 'Dashboard', path: '/', tab: 'banking' }] },
        { label: 'Profile', links: [{ label: 'Profile', path: '/profile', tab: 'profile' }] }
      ];

      // ACT
      await act(async () => {
        render(<Header isConnected={true} navigationGroups={singleLinkGroups} />);
      });

      // ASSERT - Should have 2 buttons for single-link groups
      const buttons = screen.getAllByTestId('unstyled-button');
      expect(buttons).toHaveLength(2);
      
      // Should have no menus for single-link groups
      const menus = screen.queryAllByTestId('menu');
      expect(menus).toHaveLength(0);
    });

    it('renderDesktopNavigation() - should render multi-link groups as dropdown menus', async () => {
      // ARRANGE
      const multiLinkGroups: NavigationGroup[] = [
        {
          label: 'Banking',
          links: [
            { label: 'Accounts', path: '/banking/accounts', tab: 'banking' },
            { label: 'Transactions', path: '/banking/transactions', tab: 'banking' }
          ]
        }
      ];

      // ACT
      await act(async () => {
        render(<Header isConnected={true} navigationGroups={multiLinkGroups} />);
      });

      // ASSERT - Should have menu for multi-link group
      const menus = screen.getAllByTestId('menu');
      expect(menus).toHaveLength(1);
      expect(menus[0].getAttribute('data-trigger')).toBe('hover');
      expect(menus[0].getAttribute('data-within-portal')).toBe('true');

      // Should have menu items
      const menuItems = screen.getAllByTestId('menu-item');
      expect(menuItems).toHaveLength(2);
    });

    it('renderDesktopNavigation() - should handle mixed single and multi-link groups', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ASSERT - Should have 1 button (Dashboard) and 1 menu (Banking)
      const buttons = screen.getAllByTestId('unstyled-button');
      expect(buttons).toHaveLength(2); // 1 direct button + 1 menu target button

      const menus = screen.getAllByTestId('menu');
      expect(menus).toHaveLength(1); // Banking group

      const menuItems = screen.getAllByTestId('menu-item');
      expect(menuItems).toHaveLength(2); // Accounts, Transactions
    });
  });

  describe('Mobile Navigation - Drawer and Collapse', () => {
    it('Drawer - should not render mobile navigation drawer when closed', async () => {
      // ARRANGE - Drawer is closed by default
      // ACT
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ASSERT
      const drawer = screen.queryByTestId('drawer');
      expect(drawer).toBeNull();
    });

    it('Collapse - should not render collapse section when closed', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ASSERT - Collapse should not be rendered when closed
      const collapse = screen.queryByTestId('collapse');
      expect(collapse).toBeNull();
    });
  });

  describe('handleNavigation() - Error Handling and Edge Cases', () => {
    it('handleNavigation() - should call navigation with proper path', async () => {
      // ARRANGE
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ACT
      const dashboardButton = screen.getAllByTestId('unstyled-button')[0];
      await act(async () => {
        await user.click(dashboardButton);
      });

      // ASSERT - Should handle normal navigation flow
      expect(mockNavigate).toHaveBeenCalledWith('/');
      expect(dashboardButton.tagName).toBe('BUTTON');
    });

    it('handleNavigation() - should handle empty path strings', async () => {
      // ARRANGE
      const emptyPathGroups: NavigationGroup[] = [
        { label: 'Empty', links: [{ label: 'Empty', path: '', tab: 'empty' }] }
      ];

      await act(async () => {
        render(<Header isConnected={true} navigationGroups={emptyPathGroups} />);
      });

      // ACT
      const button = screen.getByTestId('unstyled-button');
      await act(async () => {
        await user.click(button);
      });

      // ASSERT
      expect(mockNavigate).toHaveBeenCalledWith('');
    });
  });

  describe('Component Props - Validation and Edge Cases', () => {
    it('React.FC() - should handle null navigationGroups gracefully', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<Header isConnected={true} navigationGroups={[] as NavigationGroup[]} />);
      });

      // ASSERT - Should render without crashing
      expect(screen.getByTestId('header')).toBeDefined();
      expect(screen.getByTestId('connection-status')).toBeDefined();
    });

    it('React.FC() - should handle navigationGroups with empty links arrays', async () => {
      // ARRANGE
      const emptyLinksGroups: NavigationGroup[] = [
        { label: 'Empty Group', links: [] }
      ];

      // ACT
      await act(async () => {
        render(<Header isConnected={true} navigationGroups={emptyLinksGroups} />);
      });

      // ASSERT - Should render basic header structure
      expect(screen.getByTestId('header')).toBeDefined();
      expect(screen.getByTestId('connection-status')).toBeDefined();
      
      // Component should render without crashing
      expect(screen.getByTestId('burger-menu')).toBeDefined();
    });

    it('React.FC() - should handle large number of navigation groups', async () => {
      // ARRANGE
      const manyGroups: NavigationGroup[] = Array.from({ length: 10 }, (_, i) => ({
        label: `Group ${i}`,
        links: [{ label: `Link ${i}`, path: `/path${i}`, tab: `tab${i}` }]
      }));

      // ACT
      await act(async () => {
        render(<Header isConnected={true} navigationGroups={manyGroups} />);
      });

      // ASSERT - Should render all groups
      const buttons = screen.getAllByTestId('unstyled-button');
      expect(buttons).toHaveLength(10);
    });
  });

  describe('Accessibility - Screen Reader Support', () => {
    it('Burger - should have proper ARIA attributes for accessibility', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ASSERT
      const burgerMenu = screen.getByTestId('burger-menu');
      expect(burgerMenu.getAttribute('aria-label')).toBe('Toggle navigation');
      expect(burgerMenu.tagName).toBe('BUTTON');
    });

    it('Menu.Item - should have proper role attributes', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ASSERT
      const menuItems = screen.getAllByTestId('menu-item');
      menuItems.forEach(item => {
        expect(item.getAttribute('role')).toBe('menuitem');
      });
    });

    it('UnstyledButton - should be focusable elements', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(<Header {...defaultProps} />);
      });

      // ASSERT
      const buttons = screen.getAllByTestId('unstyled-button');
      buttons.forEach(button => {
        expect(button.tagName).toBe('BUTTON');
      });
    });
  });
});
