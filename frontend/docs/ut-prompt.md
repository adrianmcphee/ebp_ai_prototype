As a Senior React Software Engineer with expertise in writing industry-standard unit tests, your goal is to create a comprehensive test suite for @[ComponentName].tsx. 

**CRITICAL SUCCESS CRITERIA:**
✅ >90% test coverage (statement, branch, function)
✅ 100% compliance with @test-rules.md standards
✅ Professional-grade, maintainable test architecture

**🚨 CRITICAL RULES - ZERO TOLERANCE:**
❌ NEVER test text content (textContent, innerHTML) - Text changes break tests
❌ NEVER test styling attributes (data-cols, data-variant, data-size, data-gap, data-padding, data-height, data-width, data-shadow, data-radius, etc.) - Focus on behavior, not presentation
✅ ONLY test functional attributes that affect component behavior (data-required, data-disabled, data-loading, etc.)
✅ Follows industry standards and test functionality, remember unit tests are the main safeguard for future changes

**APPROACH:**
1. **Clean Mock Architecture**: Mock external dependencies with minimal props - only children and functional callbacks
2. **Behavior-First Testing**: Test what the component DOES, not how it LOOKS  
3. **Semantic Validation**: Use element.tagName, element.type, element.length for structure
4. **Functional Testing**: Test interactions, state changes, prop handling, error cases

**FORBIDDEN PATTERNS:**
```typescript
❌ expect(element.textContent).toBe('...')           // Text content
❌ expect(element.getAttribute('data-cols')).toBe('2') // Style attribute  
❌ expect(element.getAttribute('data-size')).toBe('lg') // Style attribute
❌ Card: vi.fn(({ shadow, padding, radius }) => ...) // Style props in mocks
```

**REQUIRED PATTERNS:**
```typescript
✅ expect(element).toBeDefined()                     // Existence
✅ expect(element.tagName).toBe('BUTTON')           // Semantic validation  
✅ expect(elements).toHaveLength(3)                 // Structure validation
✅ expect(element.getAttribute('data-required')).toBe('true') // Functional attribute
✅ Card: vi.fn(({ children }) => <div>{children}</div>) // Clean mocks
```

**DELIVERABLES:**
1. Create comprehensive test suite following @test-rules.md exactly
2. **SELF-AUDIT**: After completion, perform critical review against test-rules.md
3. Identify and fix any violations before declaring completion
4. Provide coverage report and compliance confirmation

**QUALITY GATE:**
Your tests must pass this critical question: "Will these tests still pass if we change colors, spacing, fonts, or layout?" If no, refactor until the answer is yes.

Use @test-rules.md as your bible and @App.test.tsx/@Header.test.tsx as reference for compliant patterns.