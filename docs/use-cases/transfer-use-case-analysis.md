# Transfer Use Case Analysis

## Context: Supported Transfer Types

The system supports three types of money transfers:

1. **Internal Transfer** - Between accounts within the same bank (instant, low cost)
2. **Domestic Transfer** - Between different banks within the same country (ACH/wire, 1-2 business days)
3. **International Transfer** - Between banks in different countries (SWIFT wire, 3-5 business days)

The system must automatically determine the appropriate transfer type based on recipient information and route users to the correct form/process.

## Use Cases

### Use Case 1: International Transfer

**User query**: "Transfer $100 to Jack"
**Expected result**:
- User is navigated to the international wire transfer form
- The form has selected current checking account as "account from which the payment is made"
- The form "benefitiary" account is set to "Jack White"
- The form "amount" field is set to 100$
- User can review the form and submit the payment.

### Use Case 2: Internal Transfer  

**User query**: "Send $50 to my mum"
**Expected result**:
- User is navigated to the internal transfer form
- The form has selected current checking account as "from account"
- The form "to account" is set to "Amy Winehouse" (mum's account within same bank)
- The form "amount" field is set to $50
- User can review the form and submit the transfer.

# How it works?

1. **Intent Classification**: Initial classification identifies generic transfer intent
   - Query: "Transfer $100 to Jack" → Intent: `payments.transfer.external` (generic)
   - Query: "Send $50 to my mum" → Intent: `payments.transfer.internal` (generic)

2. **Entity Extraction**: Extract key information from user query
   - Amount: $100 / $50
   - Recipient: "Jack" / "my mum"

3. **Entity Enrichment**: Resolve recipient to full contact information
   - "Jack" → "Jack White" (international recipient at Royal Bank of Canada)
   - "my mum" → "Amy Winehouse" (internal account at same bank)

4. **Transfer Type Detection**: Determine specific transfer type based on enriched data
   - Jack White (foreign bank) → International Transfer → `international.wire.send`
   - Amy Winehouse (same bank) → Internal Transfer → `payments.transfer.internal`

5. **Form Navigation**: Route user to appropriate form with pre-filled data

# What is missing in the system?

## Data Model Gaps

**Enhanced Recipient Model:** ✅ PARTIALLY COMPLETE
- Current `Recipient` class HAS the required banking metadata fields
- Fields present: `alias`, `bank_country`, `routing_number`, `swift_code`, `bank_address`
- ⚠️ BUG: `transfer_type()` method incorrectly classifies same-bank transfers as "domestic"

**Test Data Gaps:** ✅ MOSTLY COMPLETE
- "Jack White" (international recipient) EXISTS with alias "Jack" 
- "Amy Winehouse" (internal recipient) EXISTS with alias "my mum"
- Test recipients include different banks (Wells Fargo, Chase, Royal Bank of Canada, etc.)

## Business Logic Gaps

**Recipient Resolution Strategy:**
- No strategy to resolve aliases ("Jack", "my mum") to full recipient records
- System has extensible enrichment architecture but lacks recipient-specific strategy
- `MockBankingService.search_recipients()` only searches by name, NOT by alias
- No confidence scoring for recipient matches

**Transfer Type Detection Logic:** ⚠️ PARTIALLY COMPLETE
- Logic EXISTS in `Recipient.transfer_type()` but has critical bug
- Bug: All US banks classified as "domestic" even when same bank (should be "internal")
- Missing integration with user profile to determine "home bank" automatically
- No connection between recipient resolution and transfer type detection

**Post-Enrichment Intent Refinement:**
- No mechanism to upgrade generic transfer intents to specific ones after enrichment
- Transfer intents missing `enrichment_requirements=["recipient_resolution"]` configuration
- Current confidence system exists but not leveraged for intent refinement
- Missing feedback loop between entity enrichment and intent classification

## Integration Gaps

**Clarification System Extension:** ✅ MOSTLY COMPLETE
- Current system DOES handle disambiguation via `validation["disambiguations"]`
- StateManager has robust clarification request/response mechanism
- ⚠️ Missing: Standardized ResponseType.DISAMBIGUATION_NEEDED enum value
- Disambiguation returns recipient list but needs better presentation format

**User Context Integration:**
- No user profile integration to determine "home bank" for internal transfer detection
- Missing relationship context for alias resolution ("my mum" → specific person)
- `transfer_type()` requires manual "home_bank" parameter instead of auto-detection

**Additional Missing Components:**
- No mechanism to compare pre/post enrichment confidence levels
- Missing confidence-based refinement thresholds configuration
- Intent refinement violates Single Responsibility Principle if added to pipeline

# Implementation Plan

## Phase 1: Bug Fixes & Configuration (Priority: CRITICAL, Effort: LOW)

**1.1 Fix Transfer Type Logic Bug**
- Fix `Recipient.transfer_type()` method in `mock_banking.py`:
  ```python
  if self.bank_name == home_bank:
      return "internal"
  elif self.bank_country == "US" and self.bank_name != home_bank:
      return "domestic"
  else:
      return "international"
  ```

**1.2 Add Enrichment Requirements to Intents**
- Update `intent_catalog.py` transfer intents:
  - `payments.transfer.internal`: Add `enrichment_requirements=["recipient_resolution"]`
  - `payments.transfer.external`: Add `enrichment_requirements=["recipient_resolution"]`
  - `international.wire.send`: Add `enrichment_requirements=["recipient_resolution"]`

**1.3 Fix Recipient Search**
- Update `MockBankingService.search_recipients()` to search by BOTH name and alias
- Return confidence scores with matches

## Phase 2: Recipient Resolution Strategy (Priority: HIGH, Effort: MEDIUM)

**2.1 RecipientResolutionStrategy Implementation**
- Create new strategy in `backend/src/entity_enricher.py` following existing pattern:
  - Extends `EnrichmentStrategy` abstract base class (Open-Closed Principle)
  - Implements confidence-based scoring aligned with intent classification:
    - Exact match: 0.99
    - Alias match: 0.90 (bank-configured aliases)
    - Partial match: 0.60-0.80 (based on similarity)
    - Banking metadata bonus: +0.10 for complete info
  - Disambiguation thresholds:
    - >= 0.85: Single high-confidence match
    - 0.60-0.84: Show options for disambiguation
    - < 0.60: No good matches, clarification needed

**2.2 Transfer Type Integration**
- After recipient resolution, determine transfer type
- Set `transfer_type` in enriched entities for downstream use
- Use mock "home_bank" = "Mock Bank" from user profile/session

## Phase 3: Intent Refinement Strategy (Priority: HIGH, Effort: MEDIUM)

**3.1 IntentRefinementStrategy Implementation**
- Create new enrichment strategy (follows Open-Closed Principle):
  - `get_strategy_name()` returns "intent_refinement"
  - Triggered after recipient resolution when `transfer_type` is set
  - Refinement thresholds aligned with ARCHITECTURE.md:
    - UPGRADE: 0.85 (high confidence to upgrade generic → specific)
    - MAINTAIN: 0.60 (medium confidence maintains current)
    - DOWNGRADE: < 0.60 (flag for clarification)

**3.2 Refinement Logic**
- Only refine when:
  - Original confidence is "probable" (0.60-0.85)
  - Enriched data provides clear disambiguation (clarity >= 0.90)
  - Business rules support the refinement
- Intent mapping:
  - `payments.transfer.external` + international → `international.wire.send`
  - `payments.transfer.external` + internal → `payments.transfer.internal`

## Phase 4: Enhanced Clarification (Priority: MEDIUM, Effort: LOW)

**4.1 Leverage Existing System**
- Current validator already returns `disambiguations`
- StateManager has clarification request/response flow
- Just need to enhance presentation:
  - Include bank name and last 4 digits of account
  - Show maximum 5 options (highest confidence)
  - Add "None of these" option

**4.2 Response Type Enhancement**
- Add `DISAMBIGUATION_NEEDED` to ResponseType enum
- Standardize disambiguation response format
- Ensure consistent handling across UI contexts

## Phase 5: Integration & Testing (Priority: HIGH, Effort: MEDIUM)

**5.1 End-to-End Testing**
- Create comprehensive test scenarios for both use cases:
  - "Transfer $100 to Jack" → International wire
  - "Send $50 to my mum" → Internal transfer
- Test disambiguation flows with multiple matches
- Validate confidence-based refinement
- Test edge cases (no matches, low confidence, etc.)

**5.2 User Profile Integration**
- Add mock user profile with `home_bank` = "Mock Bank"
- Pass user profile through pipeline for transfer type detection
- Update API to include user context in requests

**5.3 API Response Enhancements**
- Include transfer type in response metadata
- Add recipient resolution confidence scores
- Include intent refinement trail for audit

## Implementation Sequence

| Week | Phase | Deliverable | Dependencies |
|------|-------|------------|--------------|
| 1 | Phase 1 | Bug fixes & configuration updates | None |
| 2 | Phase 2 | RecipientResolutionStrategy with confidence scoring | Phase 1 |  
| 3 | Phase 3 | IntentRefinementStrategy (OCP-compliant) | Phase 2 |
| 4 | Phase 4 | Enhanced clarification presentation | Phase 2 |
| 5 | Phase 5 | Integration, user profile & testing | All phases |

## Architectural Improvements

**1. Follows SOLID Principles:**
- **Open-Closed**: Extends via strategies, not pipeline modifications
- **Single Responsibility**: Each strategy has one clear purpose
- **Dependency Inversion**: Strategies depend on abstractions

**2. Consistent with Existing Patterns:**
- Uses same additive confidence scoring as intent classification
- Leverages existing enrichment architecture
- Builds on current clarification system

**3. Maintains System Integrity:**
- Clear audit trail for all decisions
- Confidence thresholds aligned with ARCHITECTURE.md (0.6/0.85)
- Fail-safe approach: clarify when uncertain

## Success Criteria

**Use Case 1: "Transfer $100 to Jack"**
- ✅ Resolves "Jack" → "Jack White" via alias matching
- ✅ Detects international transfer type via bank country  
- ✅ Refines intent to `international.wire.send`
- ✅ Returns pre-filled international wire form configuration

**Use Case 2: "Send $50 to my mum"**  
- ✅ Resolves "my mum" → "Amy Winehouse" via alias matching
- ✅ Detects internal transfer type via same bank
- ✅ Maintains `payments.transfer.internal` intent
- ✅ Returns pre-filled internal transfer form configuration

**Edge Cases Handled:**
- ✅ Multiple recipients with same name (disambiguation)
- ✅ Low confidence classifications (enrichment-driven refinement)
- ✅ Missing recipient information (existing clarification system)
- ✅ Invalid or non-existent recipients (graceful error handling)