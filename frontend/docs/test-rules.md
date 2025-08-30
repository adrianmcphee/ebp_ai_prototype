# Unit Testing Rules & Best Practices

## 📋 **Overview**

This document outlines the **golden standards** for writing unit tests in this React/TypeScript project using **Vitest** and **React Testing Library**. These rules ensure high-quality, maintainable, and discoverable tests that follow industry best practices.

**Reference Implementation:** `src/tests/App.test.tsx` - 42 tests with 97.95% statement coverage and 94.54% branch coverage.

## 🔺 **Testing Pyramid Context**

**Unit tests** are the foundation of the testing pyramid:

```
    /\     E2E Tests (Few, Slow, High Confidence)
   /  \    
  /____\   Integration Tests (Some, Medium Speed)
 /      \  
/_______\  Unit Tests (Many, Fast, Low-Level Confidence)
```

**Unit Test Characteristics:**
- ✅ **Fast execution** (<30 seconds for entire suite)
- ✅ **Isolated** - Test individual functions/components
- ✅ **Deterministic** - Same input always produces same output
- ✅ **Independent** - No dependencies between tests
- ✅ **Focused** - Single responsibility per test

---

## 🏗️ **1. Project Structure & Setup**

### **Directory Structure**
```
frontend/
├── vitest.setup.ts              ← Global test setup (Vitest convention)
├── vite.config.ts               ← Test configuration
├── src/
│   ├── tests/                   ← All test files here
│   │   ├── App.test.tsx         ← Component tests
│   │   └── utils.test.ts        ← Utility tests (future)
│   ├── App.tsx                  ← Source components
│   └── ...
└── coverage/                    ← Generated reports (gitignored)
```

### **Required Setup Files**

**`vitest.setup.ts` (Project Root):**
```typescript
import '@testing-library/jest-dom/vitest';

// Mock crypto.randomUUID for tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9)
  }
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor(cb: ResizeObserverCallback) {}
  observe(target: Element) {}
  unobserve(target: Element) {}
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
```

**`vite.config.ts` Test Configuration:**
```typescript
test: {
  globals: true,
  environment: 'jsdom',
  setupFiles: ['./vitest.setup.ts'],
  css: true,
}
```

---

## 🏷️ **2. Naming Conventions**

### **CRITICAL: Function-Based Test Naming**

Every test name MUST clearly indicate which function it tests:

#### **❌ Vague Naming (BAD)**
```typescript
describe('Component Initialization', () => {
  it('should render correctly', () => {
    // Which function does this test?
  });
});
```

#### **✅ Function-Specific Naming (GOOD)**
```typescript
describe('useEffect() - Component Lifecycle', () => {
  it('initializeSession() - should call API service on component mount', () => {
    // Clear which function is being tested
  });
  
  it('loadAccounts() - should call API service on component mount', () => {
    // Function name prefix makes intent obvious
  });
});
```

### **Naming Pattern Rules**

1. **Describe blocks:** `functionName() - Purpose`
   - `handleSubmit() - Message Processing`
   - `connectWebSocket() - WebSocket State Management`
   - `renderBankingScreen() - Banking Screen Rendering`

2. **Test blocks:** `functionName() - specific behavior`
   - `handleSubmit() - should process chat message submission via API`
   - `connectWebSocket() onopen - should update connection status`
   - `useState(activeTab) - should start with banking tab active by default`

3. **Group related functions:**
   - `initializeSession() / handleSubmit() / loadAccounts() - Error Handling`
   - `handleSubmit() / handleWebSocketMessage() - Edge Cases`

---

## 📊 **3. Test Organization**

### **Logical Grouping by Function Responsibility**

Organize tests by what they actually test, not arbitrary categories:

```typescript
describe('Component Name', () => {
  // 1. Lifecycle & Setup
  describe('useEffect() - Component Lifecycle', () => {});
  
  // 2. State Management
  describe('setActiveTab() - Tab State Management', () => {});
  
  // 3. API Integration
  describe('handleSubmit() - Message Processing', () => {});
  
  // 4. UI Interactions
  describe('handleUIAssistance() - UI Assistance Processing', () => {});
  
  // 5. Error Handling
  describe('initializeSession() / handleSubmit() - Error Handling', () => {});
  
  // 6. Edge Cases
  describe('handleSubmit() / handleWebSocketMessage() - Edge Cases', () => {});
});
```

---

## 🎯 **4. Testing Patterns**

### **Required Test Structure (AAA Pattern)**

Every test MUST follow **Arrange-Act-Assert** pattern:

```typescript
it('functionName() - should do specific behavior', async () => {
  // ARRANGE: Set up test data and mocks
  const mockData = { id: '1', name: 'Test' };
  vi.mocked(apiService.getData).mockResolvedValueOnce(mockData);
  
  // ACT: Render component and perform actions
  await act(async () => {
    render(<Component />);
  });
  
  await act(async () => {
    await user.click(screen.getByTestId('submit-button'));
  });
  
  // ASSERT: Verify expected outcomes
  await waitFor(() => {
    expect(vi.mocked(apiService.getData)).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('result')).toBeInTheDocument();
  });
});
```

### **Required Async Patterns**

**Always use these patterns for React testing:**

```typescript
// ✅ Component rendering
await act(async () => {
  render(<App />);
});

// ✅ User interactions
await act(async () => {
  await user.click(screen.getByTestId('button'));
});

// ✅ Waiting for state changes
await waitFor(() => {
  expect(screen.getByTestId('result')).toBeInTheDocument();
});
```

### **Required Query Methods**

**ALWAYS use `getByTestId()` - NEVER use `getByText()`:**

```typescript
// ❌ NEVER USE - Fragile to content changes
expect(screen.getByText('Submit')).toBeInTheDocument();

// ✅ ALWAYS USE - Stable test IDs
expect(screen.getByTestId('submit-button')).toBeInTheDocument();
```

---

## 🎭 **5. Mocking Strategies & Test Doubles**

### **Types of Test Doubles**

Understanding test double types helps choose the right approach:

- **🎭 Mock**: Records calls and can verify interactions
- **🎯 Stub**: Returns predefined responses  
- **👥 Spy**: Wraps real objects to record calls
- **🏠 Fake**: Simplified working implementations
- **🥸 Dummy**: Objects passed but never used

### **Vitest Test Double Usage**

```typescript
// Mock - Verify function calls and behavior
const mockApiCall = vi.fn().mockResolvedValue(responseData);
expect(mockApiCall).toHaveBeenCalledWith(expectedArgs);

// Stub - Return predefined data
vi.mocked(service.getData).mockReturnValue(stubbedData);

// Spy - Monitor real object behavior  
const spy = vi.spyOn(realObject, 'method');
expect(spy).toHaveBeenCalled();
```

### **Service Mocking Pattern**

Mock all external dependencies at the module level:

```typescript
// Import for accessing mocked services
import { apiService } from '../services/api';
import { websocketService } from '../services/websocket';

// Mock the services
vi.mock('../services/api', () => ({
  apiService: {
    initializeSession: vi.fn().mockResolvedValue(undefined),
    getAccounts: vi.fn().mockResolvedValue([]),
    processMessage: vi.fn().mockResolvedValue({
      message: 'Test response',
      intent: 'test',
      confidence: 0.9
    })
  }
}));

vi.mock('../services/websocket', () => ({
  websocketService: {
    connect: vi.fn().mockReturnValue({
      onopen: null,
      onclose: null,
      onmessage: null,
      close: vi.fn(),
      send: vi.fn()
    }),
    disconnect: vi.fn()
  }
}));
```

### **Component Mocking Pattern**

Mock child components to isolate unit under test:

```typescript
vi.mock('../components/ChildComponent', () => ({
  ChildComponent: vi.fn(({ prop1, onAction }) => (
    <div data-testid="child-component">
      <span data-testid="prop-display">{prop1}</span>
      <button data-testid="action-button" onClick={() => onAction('test')}>
        Action
      </button>
    </div>
  ))
}));
```

### **Browser API Mocking**

Mock browser APIs in `vitest.setup.ts`:

```typescript
// Mock notifications
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn()
  }
}));
```

---

## 📈 **6. Coverage Requirements**

### **Minimum Coverage Targets**
- **Statement Coverage:** ≥95%
- **Branch Coverage:** ≥90%
- **Function Coverage:** ≥90%

### **Required Function Coverage**

**Every function MUST have tests for:**

1. **Happy Path:** Normal successful execution
2. **Error Cases:** Exception handling and graceful failures
3. **Edge Cases:** Boundary conditions and unusual inputs
4. **State Changes:** All state transitions and side effects
5. **Integration Points:** All external service calls

### **Coverage Verification**

```bash
# Generate coverage report
npm run test:coverage

# Run tests in watch mode during development
npm run test:watch

# Coverage should show in terminal and generate detailed HTML report
```

---

## ⚡ **7. Code Quality Standards**

### **Test Performance**

```typescript
describe('Component Tests', () => {
  const user = userEvent.setup();
  const mockWebSocket = {
    onopen: null as ((event: Event) => void) | null,
    onclose: null as ((event: CloseEvent) => void) | null,
    onmessage: null as ((event: MessageEvent) => void) | null,
    close: vi.fn(),
    send: vi.fn()
  };
  
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Reset specific mocks
    vi.mocked(websocketService.connect).mockReturnValue(mockWebSocket as unknown as WebSocket);
  });

  afterEach(() => {
    cleanup(); // Clean up DOM after each test
  });
});
```

### **Type Safety**

Always use proper TypeScript types:

```typescript
const mockResponse: ProcessResponse = {
  status: 'success',
  message: 'Test response',
  intent: 'test_intent',
  confidence: 0.95
};
```

---

## 🌟 **8. Industry Best Practices**

### **Test Independence**
- Each test MUST be completely independent
- No shared state between tests
- Clean mocks between tests with `beforeEach()`

### **Single Responsibility**
- One test = One behavior
- Clear, descriptive test names
- Focused assertions

### **Test Data Management**
```typescript
// ✅ Create specific test data for each test
const mockUserData = {
  id: '123',
  name: 'Test User',
  email: 'test@example.com'
};

// ❌ Don't reuse generic test data across tests
```

### **Error Testing**
```typescript
it('functionName() - should handle API errors gracefully', async () => {
  const mockError = new Error('API failed');
  vi.mocked(apiService.call).mockRejectedValueOnce(mockError);
  
  await act(async () => {
    render(<Component />);
  });
  
  // Verify error handling behavior
  await waitFor(() => {
    expect(screen.getByTestId('error-message')).toBeInTheDocument();
  });
});
```

---

## 🚫 **9. Common Pitfalls to Avoid**

### **❌ DON'T: Vague Test Names**
```typescript
it('should work correctly', () => {}); // What function? What behavior?
```

### **❌ DON'T: Test Implementation Details**
```typescript
expect(component.state.isLoading).toBe(true); // Internal state
```

### **❌ DON'T: Using getByText for UI Elements**
```typescript
expect(screen.getByText('Submit')).toBeInTheDocument(); // Fragile
```

### **❌ DON'T: Forgetting Async/Await**
```typescript
// Missing await - test will be flaky
user.click(button);
expect(result).toBeInTheDocument();
```

### **❌ DON'T: Shared Test State**
```typescript
let sharedData; // Don't share data between tests
```

### **❌ DON'T: Non-Deterministic Tests**
```typescript
// BAD: Using real dates/random values
expect(result.timestamp).toBe(new Date().toISOString());
expect(result.id).toBe(Math.random().toString());

// GOOD: Use fixed test data
expect(result.timestamp).toBe('2024-01-01T00:00:00.000Z');
expect(result.id).toBe('test-uuid-123');
```

---

## 🛡️ **Preventing Flaky Tests**

**Flaky tests** randomly pass/fail and destroy confidence. Prevent them by:

### **1. Deterministic Test Data**
```typescript
// ✅ Always use consistent test data
const FIXED_TEST_DATE = '2024-01-01T00:00:00.000Z';
const FIXED_TEST_ID = 'test-uuid-123';

// ✅ Mock random functions
vi.mocked(crypto.randomUUID).mockReturnValue(FIXED_TEST_ID);
```

### **2. Proper Async Handling**
```typescript
// ❌ Race condition - flaky
render(<AsyncComponent />);
expect(screen.getByTestId('result')).toBeInTheDocument();

// ✅ Wait for async operations
await waitFor(() => {
  expect(screen.getByTestId('result')).toBeInTheDocument();
});
```

### **3. Clean State Between Tests**
```typescript
beforeEach(() => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  cleanup();
});
```

### **4. Avoid Time-Dependent Tests**
```typescript
// ❌ Flaky - depends on execution timing
setTimeout(() => expect(callback).toHaveBeenCalled(), 100);

// ✅ Mock timers
vi.useFakeTimers();
vi.advanceTimersByTime(100);
expect(callback).toHaveBeenCalled();
vi.useRealTimers();
```

---

## 📝 **11. Test Template**

Use this template for all new component tests:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Component from '../Component';
import type { ComponentProps } from '../types';

// Mock external dependencies
vi.mock('../services/api', () => ({
  apiService: {
    method: vi.fn().mockResolvedValue('default response')
  }
}));

vi.mock('../components/ChildComponent', () => ({
  ChildComponent: vi.fn(({ onAction }) => (
    <div data-testid="child-component">
      <button data-testid="child-action" onClick={() => onAction('test')}>
        Child Action
      </button>
    </div>
  ))
}));

describe('Component Name', () => {
  const user = userEvent.setup();
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('functionName() - Function Purpose', () => {
    it('functionName() - should handle specific behavior', async () => {
      // ARRANGE
      const mockData = { id: '1', value: 'test' };
      
      // ACT
      await act(async () => {
        render(<Component />);
      });
      
      await act(async () => {
        await user.click(screen.getByTestId('action-button'));
      });
      
      // ASSERT
      await waitFor(() => {
        expect(screen.getByTestId('result')).toBeInTheDocument();
      });
    });
    
    it('functionName() - should handle error cases gracefully', async () => {
      // Test error scenarios
    });
    
    it('functionName() - should handle edge cases', async () => {
      // Test boundary conditions
    });
  });
});
```

---

## 🎯 **12. Success Criteria**

A test suite is considered **high-quality** when it meets ALL these criteria:

✅ **Function Coverage:** Every function has dedicated tests with clear naming  
✅ **Behavior Coverage:** All paths, errors, and edge cases are tested  
✅ **Statement Coverage:** ≥95% of code lines executed  
✅ **Branch Coverage:** ≥90% of code branches tested  
✅ **Test IDs:** All UI interactions use `data-testid` attributes  
✅ **Independence:** All tests run in isolation without dependencies  
✅ **Performance:** Test suite completes in <10 seconds  
✅ **Maintainability:** Clear naming and structure for easy updates  
✅ **Documentation:** Self-documenting through descriptive test names  

---

## 🔧 **12. npm Scripts**

Ensure these scripts are available:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:ui": "vitest --ui",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## 🎯 **13. Test-Driven Development (TDD) Principles**

While not mandatory, following TDD principles improves code quality:

### **Red-Green-Refactor Cycle**
1. **🔴 Red**: Write failing test first
2. **🟢 Green**: Write minimal code to make test pass
3. **🔵 Refactor**: Improve code while keeping tests green

### **Benefits of TDD Approach**
- ✅ **Better design** - Tests force good API design
- ✅ **Complete coverage** - Every line has a failing test first
- ✅ **Regression safety** - Refactoring is safer
- ✅ **Documentation** - Tests document expected behavior

### **TDD Example**
```typescript
// 1. RED: Write failing test
it('calculateTotal() - should sum item prices with tax', () => {
  expect(calculateTotal([{ price: 100 }, { price: 50 }], 0.1))
    .toBe(165); // 150 + 15% tax
});

// 2. GREEN: Implement minimal code
function calculateTotal(items, taxRate) {
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);
  return subtotal * (1 + taxRate);
}

// 3. REFACTOR: Improve without breaking test
```

---

## ⚖️ **14. Testing Confidence vs Speed Balance**

**Golden Rule:** Optimize for confidence first, then speed.

### **Confidence Levels**
- **🔴 Low Confidence**: Unit tests (fast, isolated)
- **🟡 Medium Confidence**: Integration tests (slower, realistic)
- **🟢 High Confidence**: E2E tests (slow, full user journey)

### **When to Use Each Level**
```typescript
// Unit Tests (This Document) - 95% of your tests
it('formatCurrency() - should format numbers as currency', () => {
  expect(formatCurrency(1234.56)).toBe('$1,234.56');
});

// Integration Tests - 4% of your tests  
it('should save user data to database', async () => {
  const user = await createUser(userData);
  expect(await findUserById(user.id)).toMatchObject(userData);
});

// E2E Tests - 1% of your tests
it('user can complete checkout flow', () => {
  cy.visit('/products');
  cy.get('[data-testid=add-to-cart]').click();
  cy.get('[data-testid=checkout]').click();
  // ... full user journey
});
```

---

## 📚 **15. Additional Resources**

- **React Testing Library Docs:** https://testing-library.com/docs/react-testing-library/intro
- **Vitest Documentation:** https://vitest.dev/
- **Jest-DOM Matchers:** https://github.com/testing-library/jest-dom
- **Testing Best Practices:** https://kentcdodds.com/blog/common-mistakes-with-react-testing-library
- **TDD Guide:** https://martinfowler.com/bliki/TestDrivenDevelopment.html
- **Testing Trophy:** https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications

---

**Remember:** These rules exist to ensure **consistent, maintainable, and reliable** tests. Always prioritize **clarity** and **function coverage** over clever test implementations. **Test behavior, not implementation.**
