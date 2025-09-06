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

**Enhanced Recipient Model:**
- Current `Recipient` class lacks banking metadata required for transfer type determination
- Missing fields: `alias`, `bank_country`, `routing_number`, `swift_code`, `bank_address`
- All test recipients currently use same bank ("Mock Bank"), preventing transfer type testing

**Test Data Gaps:**
- No "Jack White" (international recipient) in current test data
- No "Amy Winehouse" (internal recipient with alias "my mum") in current test data  
- Missing recipients with different banking attributes (domestic external, international)

## Business Logic Gaps

**Recipient Resolution Strategy:**
- No strategy to resolve aliases ("Jack", "my mum") to full recipient records
- System has extensible enrichment architecture but lacks recipient-specific strategy
- No handling of ambiguous matches (multiple "Jack" recipients)

**Transfer Type Detection Logic:**
- No automatic classification of transfer type based on recipient banking data
- Missing business rules: same bank = internal, different country = international  
- No integration between recipient resolution and intent classification

**Post-Enrichment Intent Refinement:**
- No mechanism to upgrade generic transfer intents to specific ones after enrichment
- Current confidence system exists but not leveraged for intent refinement
- Missing feedback loop between entity enrichment and intent classification

## Integration Gaps

**Clarification System Extension:**
- Current system handles missing entities but not ambiguous recipient resolution
- Need disambiguation handling for multiple recipient matches
- Existing `clarification_needed` flow needs extension for recipient selection

**User Context Integration:**
- No user profile integration to determine "home bank" for internal transfer detection
- Missing relationship context for alias resolution ("my mum" → specific person)

# Implementation Plan

## Phase 1: Data Model Foundation (Priority: HIGH, Effort: LOW)

**1.1 Enhanced Recipient Model**
- Extend `backend/src/mock_banking.py` `Recipient` class with banking fields:
  - `alias: Optional[str]` - For nickname resolution ("Jack", "my mum")
  - `bank_country: str = "US"` - Country code for transfer type detection  
  - `routing_number: Optional[str]` - For domestic transfers
  - `swift_code: Optional[str]` - For international transfers (SWIFT standard)
  - `bank_address: Optional[str]` - For international transfers (regulatory requirement)
- Add transfer type classification methods:
  - `is_international()` property based on `bank_country`
  - `transfer_type()` property returning "internal", "domestic", or "international"

**1.2 Enhanced Test Data**
- Add use case recipients to `mock_banking.py`:
  - Jack White (international, Canada, with alias "Jack")
  - Amy Winehouse (internal, same bank, with alias "my mum")
  - Additional test recipients for domestic transfers
- Update existing recipients with proper banking metadata

## Phase 2: Recipient Resolution Strategy (Priority: HIGH, Effort: MEDIUM)

**2.1 RecipientResolutionStrategy Implementation**
- Create new strategy in `backend/src/entity_enricher.py` following existing pattern:
  - Extends `EnrichmentStrategy` abstract base class (Open-Closed Principle)
  - Implements alias-based recipient lookup with confidence scoring
  - Handles multiple matches with disambiguation logic
- Integration points:
  - Auto-discovered by `IntentDrivenEnricher` 
  - Triggered by intents with `enrichment_requirements=["recipient_resolution"]`

**2.2 Enhanced Search Capabilities**
- Extend `MockBankingService.search_recipients()` to include alias matching
- Add fuzzy matching for partial name matches
- Return confidence scores for recipient matches

## Phase 3: Transfer Type Detection (Priority: HIGH, Effort: LOW)

**3.1 Transfer Type Classification Logic**
- Add business rules engine for transfer type determination:
  - Same `bank_name` = Internal transfer
  - Different `bank_name` + same `bank_country` = Domestic transfer  
  - Different `bank_country` = International transfer
- Implement as part of recipient resolution enrichment
- Add transfer type metadata to enriched entities

**3.2 Intent Catalog Updates**
- Add `enrichment_requirements=["recipient_resolution"]` to transfer intents:
  - `payments.transfer.external`
  - `payments.transfer.internal`  
  - `international.wire.send`

## Phase 4: Intent Refinement System (Priority: MEDIUM, Effort: MEDIUM)

**4.1 Confidence-Based Refinement**
- Implement post-enrichment intent refinement in `backend/src/pipeline.py`
- Leverage existing confidence thresholds from intent classification
- Add refinement logic:
  - If confidence < threshold AND enrichment provides clarity → re-classify
  - Automatic upgrade: `payments.transfer.external` → `international.wire.send` when international recipient detected

**4.2 Enhanced Classification Flow**
- Modify pipeline to support iterative refinement:
  - Initial classification → entity enrichment → intent refinement (if needed)
  - Preserve original classification confidence for comparison
  - Add refinement metadata to response

## Phase 5: Enhanced Clarification System (Priority: MEDIUM, Effort: MEDIUM)

**5.1 Disambiguation Response Type**
- Extend `ResponseType` enum in `context_aware_responses.py`:
  - Add `DISAMBIGUATION_NEEDED` for multiple recipient matches
- Update clarification handlers in `pipeline.py` for recipient selection
- Add disambiguation UI response format

**5.2 Multi-Turn Disambiguation Flow**
- Extend state manager to handle disambiguation sessions
- Store disambiguation options in conversation state
- Handle user selection and continue with original intent

## Phase 6: Integration & Testing (Priority: MEDIUM, Effort: LOW)

**6.1 End-to-End Testing**
- Create comprehensive test scenarios for both use cases
- Test disambiguation flows with multiple "Jack" recipients
- Validate confidence-based refinement with various inputs

**6.2 API Response Enhancements**
- Update API responses to include transfer type metadata
- Add form pre-population hints for UI
- Include confidence and refinement information

## Implementation Sequence

| Week | Phase | Deliverable | Dependencies |
|------|-------|------------|--------------|
| 1 | Phase 1 | Enhanced data model + test data | None |
| 2 | Phase 2 | Recipient resolution strategy | Phase 1 |  
| 3 | Phase 3 | Transfer type detection | Phase 1, 2 |
| 4 | Phase 4 | Intent refinement system | Phase 1-3 |
| 5 | Phase 5 | Disambiguation system | Phase 2, 4 |
| 6 | Phase 6 | Integration & testing | All phases |

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