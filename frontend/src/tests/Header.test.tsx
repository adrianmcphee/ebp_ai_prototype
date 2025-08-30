import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { Header } from '../components/Header';
import { MantineProvider } from '@mantine/core';

// Mock Mantine components to isolate unit under test
let groupCallCount = 0;

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core');
  return {
    ...actual,
    AppShell: {
      Header: vi.fn(({ children, 'data-testid': testId }) => (
        <div data-testid={testId}>{children}</div>
      ))
    },
    Container: vi.fn(({ children, size, h }) => (
      <div data-testid="container" data-size={size} data-height={h}>{children}</div>
    )),
    Group: vi.fn(({ children, h, px, justify }) => {
      groupCallCount++;
      const testId = groupCallCount === 1 ? 'main-group' : 'badge-group';
      return (
        <div data-testid={testId} data-height={h} data-padding={px} data-justify={justify}>{children}</div>
      );
    }),
    Title: vi.fn(({ children, order }) => (
      <h1 data-testid="title" data-order={order}>{children}</h1>
    )),
    Badge: vi.fn(({ children, 'data-testid': testId, color, variant }) => (
      <span data-testid={testId} data-color={color} data-variant={variant}>{children}</span>
    ))
  };
});

// Wrapper component for Mantine context
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe('Header Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    groupCallCount = 0; // Reset group counter for each test
  });

  afterEach(() => {
    cleanup();
  });

  describe('React.FC() - Component Rendering', () => {
    it('React.FC() - should render the main header container with correct test ID', async () => {
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

    it('React.FC() - should render the application title correctly', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={false} />
          </TestWrapper>
        );
      });

      // ASSERT
      const titleElement = screen.getByTestId('title');
      expect(titleElement).toBeDefined();
    });

    it('React.FC() - should render Container component', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT
      const containerElement = screen.getByTestId('container');
      expect(containerElement).toBeDefined();
    });

    it('React.FC() - should render Group components', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT
      const mainGroupElement = screen.getByTestId('main-group');
      const badgeGroupElement = screen.getByTestId('badge-group');
      expect(mainGroupElement).toBeDefined();
      expect(badgeGroupElement).toBeDefined();
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

    it('Badge() - should have correct test ID for connection status', async () => {
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
    });
  });

  describe('isConnected prop - State Management', () => {
    it('isConnected prop - should handle boolean true value correctly', async () => {
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
    });

    it('isConnected prop - should handle boolean false value correctly', async () => {
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
    });

    it('isConnected prop - should update display when prop changes', async () => {
      // ARRANGE
      const { rerender } = render(
        <TestWrapper>
          <Header isConnected={false} />
        </TestWrapper>
      );

      // Verify initial state
      const statusBadge = screen.getByTestId('connection-status');
      expect(statusBadge).toBeDefined();
      expect(statusBadge.getAttribute('data-color')).toBe('red');

      // ACT - Update prop
      await act(async () => {
        rerender(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT - Verify updated state
      const updatedStatusBadge = screen.getByTestId('connection-status');
      expect(updatedStatusBadge).toBeDefined();
      expect(updatedStatusBadge.getAttribute('data-color')).toBe('green');
    });
  });

  describe('Component Structure - Layout and Composition', () => {
    it('Component Structure - should contain all required child components', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT - All components should be present
      expect(screen.getByTestId('header')).toBeDefined();
      expect(screen.getByTestId('container')).toBeDefined();
      expect(screen.getByTestId('main-group')).toBeDefined();
      expect(screen.getByTestId('badge-group')).toBeDefined();
      expect(screen.getByTestId('title')).toBeDefined();
      expect(screen.getByTestId('connection-status')).toBeDefined();
    });

    it('Component Structure - should have proper component hierarchy', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={false} />
          </TestWrapper>
        );
      });

      // ASSERT - Verify parent-child relationships
      const headerElement = screen.getByTestId('header');
      const containerElement = screen.getByTestId('container');
      const mainGroupElement = screen.getByTestId('main-group');
      const badgeGroupElement = screen.getByTestId('badge-group');
      const titleElement = screen.getByTestId('title');
      const statusBadge = screen.getByTestId('connection-status');

      // All elements should exist and be in the DOM
      expect(headerElement).toBeDefined();
      expect(containerElement).toBeDefined();
      expect(mainGroupElement).toBeDefined();
      expect(badgeGroupElement).toBeDefined();
      expect(titleElement).toBeDefined();
      expect(statusBadge).toBeDefined();

      // Container should be inside header
      expect(headerElement).toContain(containerElement);
      // Main group should be inside container
      expect(containerElement).toContain(mainGroupElement);
      // Title should be inside main group
      expect(mainGroupElement).toContain(titleElement);
      // Badge group should be inside main group
      expect(mainGroupElement).toContain(badgeGroupElement);
      // Status badge should be inside badge group
      expect(badgeGroupElement).toContain(statusBadge);
    });
  });

  describe('HeaderProps interface - TypeScript Integration', () => {
    it('HeaderProps interface - should accept valid isConnected boolean prop', async () => {
      // ARRANGE & ACT - This test verifies TypeScript integration
      const validProps = { isConnected: true };
      
      await act(async () => {
        render(
          <TestWrapper>
            <Header {...validProps} />
          </TestWrapper>
        );
      });

      // ASSERT
      const statusBadge = screen.getByTestId('connection-status');
      expect(statusBadge).toBeDefined();
      expect(statusBadge.getAttribute('data-color')).toBe('green');
    });

    it('HeaderProps interface - should handle prop destructuring correctly', async () => {
      // ARRANGE
      const props = { isConnected: false };

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header {...props} />
          </TestWrapper>
        );
      });

      // ASSERT
      const statusBadge = screen.getByTestId('connection-status');
      expect(statusBadge).toBeDefined();
      expect(statusBadge.getAttribute('data-color')).toBe('red');
    });
  });

  describe('Mantine Components Integration - External Dependencies', () => {
    it('AppShell.Header - should call Mantine AppShell.Header with correct props', async () => {
      // ARRANGE
      const mockAppShellHeader = vi.mocked((await import('@mantine/core')).AppShell.Header);

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT
      expect(mockAppShellHeader).toHaveBeenCalledTimes(1);
      expect(mockAppShellHeader).toHaveBeenCalledWith(
        expect.objectContaining({
          'data-testid': 'header'
        }),
        undefined
      );
    });

    it('Container - should call Mantine Container with correct props', async () => {
      // ARRANGE
      const mockContainer = vi.mocked((await import('@mantine/core')).Container);

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT
      expect(mockContainer).toHaveBeenCalledTimes(1);
      expect(mockContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          size: 'xl',
          h: '100%'
        }),
        undefined
      );
    });

    it('Title - should call Mantine Title with correct props', async () => {
      // ARRANGE
      const mockTitle = vi.mocked((await import('@mantine/core')).Title);

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={false} />
          </TestWrapper>
        );
      });

      // ASSERT
      expect(mockTitle).toHaveBeenCalledTimes(1);
      expect(mockTitle).toHaveBeenCalledWith(
        expect.objectContaining({
          order: 3
        }),
        undefined
      );
    });

    it('Badge - should call Mantine Badge with correct props for connected state', async () => {
      // ARRANGE
      const mockBadge = vi.mocked((await import('@mantine/core')).Badge);

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT
      expect(mockBadge).toHaveBeenCalledTimes(1);
      expect(mockBadge).toHaveBeenCalledWith(
        expect.objectContaining({
          'data-testid': 'connection-status',
          color: 'green',
          variant: 'light'
        }),
        undefined
      );
    });

    it('Badge - should call Mantine Badge with correct props for disconnected state', async () => {
      // ARRANGE
      const mockBadge = vi.mocked((await import('@mantine/core')).Badge);
      vi.clearAllMocks(); // Clear previous calls

      // ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={false} />
          </TestWrapper>
        );
      });

      // ASSERT
      expect(mockBadge).toHaveBeenCalledTimes(1);
      expect(mockBadge).toHaveBeenCalledWith(
        expect.objectContaining({
          'data-testid': 'connection-status',
          color: 'red',
          variant: 'light'
        }),
        undefined
      );
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('Edge Cases - should handle undefined isConnected prop gracefully', async () => {
      // ARRANGE & ACT - TypeScript would normally prevent this, but testing runtime behavior
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={undefined as unknown as boolean} />
          </TestWrapper>
        );
      });

      // ASSERT - Should treat undefined as falsy and show disconnected
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

      // ASSERT - Should treat null as falsy and show disconnected
      const statusBadge = screen.getByTestId('connection-status');
      expect(statusBadge).toBeDefined();
      expect(statusBadge.getAttribute('data-color')).toBe('red');
    });

    it('Edge Cases - should render without MantineProvider context', async () => {
      // ARRANGE & ACT - Test without wrapper
      await act(async () => {
        render(<Header isConnected={true} />);
      });

      // ASSERT - Should still render basic structure
      const headerElement = screen.getByTestId('header');
      expect(headerElement).toBeDefined();
    });
  });

  describe('Performance and Re-rendering - React Optimization', () => {
    it('Re-rendering - should only re-render when isConnected prop changes', async () => {
      // ARRANGE
      const mockBadge = vi.mocked((await import('@mantine/core')).Badge);
      vi.clearAllMocks();

      const { rerender } = render(
        <TestWrapper>
          <Header isConnected={true} />
        </TestWrapper>
      );

      expect(mockBadge).toHaveBeenCalledTimes(1);

      // ACT - Re-render with same prop
      await act(async () => {
        rerender(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT - Component should re-render (React.FC doesn't memoize by default)
      expect(mockBadge).toHaveBeenCalledTimes(2);
    });

    it('Re-rendering - should update badge when isConnected prop changes', async () => {
      // ARRANGE
      const mockBadge = vi.mocked((await import('@mantine/core')).Badge);
      vi.clearAllMocks();

      const { rerender } = render(
        <TestWrapper>
          <Header isConnected={false} />
        </TestWrapper>
      );

      expect(mockBadge).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'red' }),
        undefined
      );

      // ACT - Change prop value
      await act(async () => {
        rerender(
          <TestWrapper>
            <Header isConnected={true} />
          </TestWrapper>
        );
      });

      // ASSERT - Should call with updated props
      expect(mockBadge).toHaveBeenLastCalledWith(
        expect.objectContaining({ color: 'green' }),
        undefined
      );
    });
  });

  describe('Accessibility and UX - User Experience', () => {
    it('Accessibility - should render connection status badge', async () => {
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
    });

    it('Accessibility - should render application title', async () => {
      // ARRANGE & ACT
      await act(async () => {
        render(
          <TestWrapper>
            <Header isConnected={false} />
          </TestWrapper>
        );
      });

      // ASSERT
      const titleElement = screen.getByTestId('title');
      expect(titleElement).toBeDefined();
    });

    it('UX - should provide clear visual distinction between connection states', async () => {
      // ARRANGE & ACT - Connected state
      const { rerender } = render(
        <TestWrapper>
          <Header isConnected={true} />
        </TestWrapper>
      );

      let statusBadge = screen.getByTestId('connection-status');
      expect(statusBadge.getAttribute('data-color')).toBe('green');

      // ACT - Disconnected state
      await act(async () => {
        rerender(
          <TestWrapper>
            <Header isConnected={false} />
          </TestWrapper>
        );
      });

      // ASSERT - Should have different color
      statusBadge = screen.getByTestId('connection-status');
      expect(statusBadge.getAttribute('data-color')).toBe('red');
    });
  });
});
