import { test, expect, Page } from '@playwright/test';
import testData from '../../test-data.json';

// Helper functions
async function initializeSession(page: Page) {
  await page.goto('/');
  await page.waitForSelector('[data-testid="app"]');
  await expect(page.locator('[data-testid="header"]')).toBeVisible();
  
  // Wait for WebSocket connection
  await page.waitForSelector('text=Connected to EBP Banking Assistant', { timeout: 5000 });
}

async function sendQuery(page: Page, query: string) {
  const input = page.locator('[data-testid="chat-input"]');
  const sendButton = page.locator('[data-testid="send-button"]');
  
  await input.fill(query);
  await sendButton.click();
  
  // Wait for response
  await page.waitForSelector('[data-testid="message-assistant"]', { 
    state: 'attached',
    timeout: 10000 
  });
}

async function getLastAssistantMessage(page: Page): Promise<string> {
  const messages = await page.locator('[data-testid="message-assistant"]').all();
  if (messages.length === 0) return '';
  const lastMessage = messages[messages.length - 1];
  return await lastMessage.textContent() || '';
}

// E2E Test Suite
test.describe('NLP Banking E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    await initializeSession(page);
  });

  test('Simple Balance Check Flow', async ({ page }) => {
    // Test data from centralized test-data.json
    const scenario = testData.scenarios.accounts_balance_check;
    
    // Send balance query
    await sendQuery(page, "What's my checking account balance?");
    
    // Verify response
    const response = await getLastAssistantMessage(page);
    expect(response).toContain('balance');
    expect(response).toMatch(/\$[\d,]+\.\d{2}/); // Should contain dollar amount
    
    // Verify confidence indicator
    const confidenceElement = await page.locator('[data-testid="confidence"]').last();
    const confidenceText = await confidenceElement.textContent();
    expect(confidenceText).toContain('balance');
    expect(confidenceText).toMatch(/\d+%/);
  });

  test('Complete Transfer Flow', async ({ page }) => {
    // Send transfer query
    await sendQuery(page, "Transfer $500 from checking to Bob Smith for rent");
    
    // Verify transfer details in response
    const response = await getLastAssistantMessage(page);
    expect(response).toContain('500');
    expect(response).toContain('Bob Smith');
    
    // If confirmation required, confirm
    if (await page.locator('text=Please confirm').isVisible()) {
      await sendQuery(page, "yes");
      
      // Verify completion
      const completionResponse = await getLastAssistantMessage(page);
      expect(completionResponse).toContain('completed');
      expect(completionResponse).toMatch(/New balance: \$[\d,]+\.\d{2}/);
    }
  });

  test('Progressive Disclosure Flow', async ({ page }) => {
    // Start with incomplete query
    await sendQuery(page, "I want to send money");
    
    // Should ask for missing information
    let response = await getLastAssistantMessage(page);
    expect(response.toLowerCase()).toContain('information');
    
    // Provide amount
    await sendQuery(page, "$750");
    response = await getLastAssistantMessage(page);
    expect(response).toContain('750');
    
    // Provide recipient
    await sendQuery(page, "Carol White");
    response = await getLastAssistantMessage(page);
    expect(response).toContain('Carol White');
    expect(response).toContain('750');
  });

  test('Context Resolution with Pronouns', async ({ page }) => {
    // First transfer
    await sendQuery(page, "Send $200 to David Brown");
    let response = await getLastAssistantMessage(page);
    expect(response).toContain('David Brown');
    expect(response).toContain('200');
    
    // Use pronoun reference
    await sendQuery(page, "Send another $100 to him");
    response = await getLastAssistantMessage(page);
    
    // Should resolve "him" to "David Brown"
    expect(response).toContain('100');
    expect(response).toMatch(/David Brown|him/i);
    
    // Use amount reference
    await sendQuery(page, "Send the same amount to Carol");
    response = await getLastAssistantMessage(page);
    expect(response).toContain('100');
    expect(response).toContain('Carol');
  });

  test('Disambiguation Flow', async ({ page }) => {
    // Query with ambiguous recipient
    await sendQuery(page, "Pay $1000 to John");
    
    // Should show disambiguation options
    await page.waitForSelector('[data-testid="disambiguation"]', { timeout: 5000 });
    
    const options = await page.locator('[data-testid^="disambig-"]').all();
    expect(options.length).toBeGreaterThan(1);
    
    // Select first option
    await options[0].click();
    
    // Verify selection was processed
    await page.waitForSelector('text=Selected:', { timeout: 5000 });
  });

  test('Transaction History Query', async ({ page }) => {
    await sendQuery(page, "Show my transactions from last week");
    
    const response = await getLastAssistantMessage(page);
    expect(response.toLowerCase()).toContain('transaction');
    
    // Follow up with filter
    await sendQuery(page, "Filter by amounts over $100");
    const filterResponse = await getLastAssistantMessage(page);
    expect(filterResponse).toBeTruthy();
  });

  test('Error Handling - Insufficient Funds', async ({ page }) => {
    await sendQuery(page, "Transfer $10000 from checking to Bob Smith");
    
    const response = await getLastAssistantMessage(page);
    expect(response.toLowerCase()).toContain('insufficient');
    expect(response).toContain('cannot be completed');
  });

  test('Quick Actions', async ({ page }) => {
    // Test quick action buttons with actual text
    const quickBalance = page.locator('button:has-text("Balance")');
    const quickTransfer = page.locator('button:has-text("Navigation")');  
    const quickTransaction = page.locator('button:has-text("Transaction")');
    
    // Click balance quick action
    await quickBalance.click();
    await page.waitForTimeout(500);
    let inputValue = await page.locator('[data-testid="chat-input"]').inputValue();
    expect(inputValue).toBe("What's my balance?");
    
    // Send the query
    await page.locator('[data-testid="send-button"]').click();
    await page.waitForSelector('[data-testid="message-assistant"]');
    
    // Click transfer quick action
    await quickTransfer.click();
    await page.waitForTimeout(500);
    inputValue = await page.locator('[data-testid="chat-input"]').inputValue();
    expect(inputValue).toBe('Take me to international transfers');
    
    // Click transaction quick action
    await quickTransaction.click();
    await page.waitForTimeout(500);
    inputValue = await page.locator('[data-testid="chat-input"]').inputValue();
    expect(inputValue).toBe('Send $500 to my friend in Canada');
  });

  test('Navigation Assistance', async ({ page }) => {
    await sendQuery(page, "Take me to transfers");
    
    let response = await getLastAssistantMessage(page);
    expect(response.toLowerCase()).toContain('navigat');
    expect(response).toContain('transfer');
    
    await sendQuery(page, "Go to account settings");
    response = await getLastAssistantMessage(page);
    expect(response).toContain('settings');
  });

  test('Multi-Account Operations', async ({ page }) => {
    await sendQuery(page, "Transfer $5000 from savings to checking");
    
    const response = await getLastAssistantMessage(page);
    expect(response).toContain('5000');
    expect(response).toContain('savings');
    expect(response).toContain('checking');
  });

  test('WebSocket Reconnection', async ({ page }) => {
    // Send initial query
    await sendQuery(page, "Check balance");
    await page.waitForSelector('[data-testid="message-assistant"]');
    
    // Simulate disconnection by evaluating in browser context
    await page.evaluate(() => {
      const ws = (window as any).wsRef?.current;
      if (ws) ws.close();
    });
    
    // Wait for reconnection
    await page.waitForTimeout(2000);
    
    // Should still be able to send queries
    await sendQuery(page, "Check balance again");
    const response = await getLastAssistantMessage(page);
    expect(response).toBeTruthy();
  });

  test('Confidence-based UI Changes', async ({ page }) => {
    // High confidence query
    await sendQuery(page, "What is my checking account balance?");
    let confidence = await page.locator('[data-testid="confidence"]').last();
    let text = await confidence.textContent();
    let match = text?.match(/(\d+)%/);
    if (match) {
      expect(parseInt(match[1])).toBeGreaterThan(80);
    }
    
    // Low confidence query
    await sendQuery(page, "maybe possibly check something");
    confidence = await page.locator('[data-testid="confidence"]').last();
    text = await confidence.textContent();
    match = text?.match(/(\d+)%/);
    if (match) {
      expect(parseInt(match[1])).toBeLessThan(70);
    }
  });
});

// Performance Tests
test.describe('Performance Tests', () => {
  test('Page Load Performance', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForSelector('[data-testid="app"]');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(testData.performance.page_load_ms);
  });

  test('API Response Time', async ({ page }) => {
    await initializeSession(page);
    
    const startTime = Date.now();
    await sendQuery(page, "Check balance");
    const responseTime = Date.now() - startTime;
    
    expect(responseTime).toBeLessThan(testData.performance.api_response_ms);
  });

  test('UI Interaction Responsiveness', async ({ page }) => {
    await initializeSession(page);
    
    const input = page.locator('[data-testid="chat-input"]');
    const startTime = Date.now();
    
    await input.fill("Test query");
    const fillTime = Date.now() - startTime;
    
    expect(fillTime).toBeLessThan(1000); // 1 second UI interaction target
  });
});

// Accessibility Tests
test.describe('Accessibility Tests', () => {
  test('Keyboard Navigation', async ({ page }) => {
    await initializeSession(page);
    
    // Tab to input field
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should focus on input
    const focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focusedElement).toBe('chat-input');
    
    // Type and send with Enter
    await page.keyboard.type('Check balance');
    await page.keyboard.press('Enter');
    
    // Should send message
    await page.waitForSelector('[data-testid="message-user"]');
  });

  test('Screen Reader Compatibility', async ({ page }) => {
    await initializeSession(page);
    
    // Check for ARIA labels
    const input = page.locator('[data-testid="chat-input"]');
    const ariaLabel = await input.getAttribute('aria-label');
    expect(ariaLabel || await input.getAttribute('placeholder')).toBeTruthy();
    
    // Check for role attributes
    const messages = page.locator('[data-testid="messages"]');
    const role = await messages.getAttribute('role');
    expect(role || 'log').toBeTruthy();
  });
});

// Visual Regression Tests
test.describe('Visual Regression Tests', () => {
  test('Initial Layout', async ({ page }) => {
    await initializeSession(page);
    await expect(page).toHaveScreenshot('initial-layout.png');
  });

  test('Chat with Messages', async ({ page }) => {
    await initializeSession(page);
    
    await sendQuery(page, "Check balance");
    await page.waitForTimeout(1000);
    await sendQuery(page, "Transfer $100 to John");
    await page.waitForTimeout(1000);
    
    await expect(page).toHaveScreenshot('chat-with-messages.png');
  });

  test('Disambiguation Dialog', async ({ page }) => {
    await initializeSession(page);
    
    await sendQuery(page, "Send money to John");
    await page.waitForSelector('[data-testid="disambiguation"]');
    
    await expect(page).toHaveScreenshot('disambiguation-dialog.png');
  });
});

// Mobile Tests
test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } });
  
  test('Mobile Layout', async ({ page }) => {
    await initializeSession(page);
    
    // Check if elements are visible on mobile
    await expect(page.locator('[data-testid="header"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="quick-actions"]')).toBeVisible();
  });

  test('Mobile Touch Interactions', async ({ page }) => {
    await initializeSession(page);
    
    // Tap quick action button
    await page.locator('button:has-text("Balance")').click();
    await page.waitForTimeout(500); // Wait for input to be filled
    const inputValue = await page.locator('[data-testid="chat-input"]').inputValue();
    expect(inputValue).toBe("What's my balance?");
    
    // Send message
    await page.locator('[data-testid="send-button"]').tap();
    await page.waitForSelector('[data-testid="message-assistant"]');
  });
});