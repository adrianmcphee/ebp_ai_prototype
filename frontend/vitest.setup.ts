import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock crypto.randomUUID for deterministic tests
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-123456789'
  }
});

// Mock ResizeObserver
globalThis.ResizeObserver = class ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    // Store callback to satisfy TypeScript
    void callback;
  }
  observe(target: Element) {
    void target;
  }
  unobserve(target: Element) {
    void target;
  }
  disconnect() {}
};

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Mock IntersectionObserver with proper interface
const mockIntersectionObserver = vi.fn(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
  root: null,
  rootMargin: '0px',
  thresholds: [0]
}));

globalThis.IntersectionObserver = mockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock requestAnimationFrame and cancelAnimationFrame
globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
  return setTimeout(callback, 0);
};

globalThis.cancelAnimationFrame = (id: number): void => {
  clearTimeout(id);
};
