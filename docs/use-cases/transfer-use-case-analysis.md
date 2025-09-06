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

## Actual System Gaps (Verified via Code Analysis)

**Recipient Resolution Integration:** ❌ MISSING
- No `RecipientResolutionStrategy` in entity enrichment system
- Validator finds recipients but doesn't resolve to specific recipient ID
- No integration between validation and enrichment phases
- Transfer intents missing `enrichment_requirements=["recipient_resolution"]`

**Transfer Type Detection After Resolution:** ❌ MISSING  
- No strategy to determine transfer type after recipient is resolved
- `transfer_type()` method exists but not integrated into enrichment pipeline
- No connection between resolved recipient bank and transfer type classification

**Intent Refinement Based on Enrichment:** ❌ MISSING
- No mechanism to suggest better intent after recipient resolution
- Generic intents (`payments.transfer.external`) never upgraded to specific ones (`international.wire.send`)
- No confidence comparison between original and refined intents

**Enhanced Disambiguation Response:** ⚠️ PARTIALLY COMPLETE
- Disambiguation works via `validation["disambiguations"]`
- StateManager tracks disambiguation context correctly
- Missing only: `ResponseType.DISAMBIGUATION_NEEDED` enum value

**User Context Integration:** ⚠️ PARTIALLY COMPLETE
- Pipeline accepts `user_profile` parameter but doesn't use it for transfer type detection
- `transfer_type()` method requires explicit "home_bank" parameter  
- No automatic user profile integration in enrichment strategies

# Revised Implementation Plan (Architecture-Focused)

## Phase 1: Foundation Setup (Day 1 - 2 hours)

**1.1 Add Missing Enum Value**
- Add `DISAMBIGUATION_NEEDED = "disambiguation_needed"` to `ResponseType` enum in `context_aware_responses.py`
- Effort: 5 minutes

**1.2 Add Enrichment Requirements to Transfer Intents**
- Update `intent_catalog.py` transfer intents to include:
  ```python
  enrichment_requirements=["recipient_resolution", "transfer_type_detection"]
  ```
- Apply to: `payments.transfer.internal`, `payments.transfer.external`, `international.wire.send`
- Effort: 15 minutes

## Phase 2: Recipient Resolution Strategy (Day 1-2 - 4 hours)

**2.1 Create RecipientResolutionStrategy** 
- Create focused strategy following Single Responsibility Principle:
  ```python
  class RecipientResolutionStrategy(EnrichmentStrategy):
      def __init__(self, banking_service):
          self.banking = banking_service
      
      def get_strategy_name(self) -> str:
          return "recipient_resolution"
      
      def can_enrich(self, entities: Dict[str, Any]) -> bool:
          return "recipient" in entities and not entities.get("recipient_id")
      
      def enrich(self, entities: Dict[str, Any]) -> Dict[str, Any]:
          """Resolve recipient name/alias to recipient_id"""
          # Use existing search_recipients method
          # Add recipient_id to entities if single match
          # Return alternatives if multiple matches
          pass
  ```
- Location: Add to `entity_enricher.py` 
- Effort: 2 hours

## Phase 3: Transfer Type Detection Strategy (Day 2-3 - 3 hours)

**3.1 Create TransferTypeDetectionStrategy**
- Create strategy that uses resolved recipient data:
  ```python
  class TransferTypeDetectionStrategy(EnrichmentStrategy):
      def get_strategy_name(self) -> str:
          return "transfer_type_detection"
      
      def can_enrich(self, entities: Dict[str, Any]) -> bool:
          return "recipient_id" in entities and not entities.get("transfer_type")
      
      def enrich(self, entities: Dict[str, Any]) -> Dict[str, Any]:
          """Detect transfer type based on resolved recipient"""
          # Get recipient by ID
          # Use existing transfer_type() method
          # Add transfer_type to entities
          pass
  ```
- Effort: 2 hours

## Phase 4: Intent Refinement (Day 3-4 - 3 hours)

**4.1 Create Simple Intent Refinement Strategy**
- Add strategy that suggests better intent after enrichment:
  ```python
  class IntentRefinementStrategy(EnrichmentStrategy):
      def get_strategy_name(self) -> str:
          return "intent_refinement"
      
      def can_enrich(self, entities: Dict[str, Any]) -> bool:
          return "transfer_type" in entities
      
      def enrich(self, entities: Dict[str, Any]) -> Dict[str, Any]:
          """Suggest intent refinement based on transfer type"""
          # Simple mapping rules
          refinement_map = {
              ("payments.transfer.external", "international"): "international.wire.send",
              ("payments.transfer.external", "internal"): "payments.transfer.internal",
          }
          
          # Add suggested_intent field without changing original
          # Include confidence boost and reasoning
          pass
  ```
- Key Principle: **NEVER override explicit user keywords**
- Effort: 2 hours

## Phase 5: Testing & Integration (Day 4-5 - 4 hours)

**5.1 Core Test Scenarios**
```python
test_scenarios = [
    {
        "query": "Transfer $100 to Jack",
        "expected_enrichment": {
            "recipient_id": "RCP007",
            "transfer_type": "international", 
            "suggested_intent": "international.wire.send"
        }
    },
    {
        "query": "Send $50 to my mum", 
        "expected_enrichment": {
            "recipient_id": "RCP003",
            "transfer_type": "internal",
            "suggested_intent": None  # Already correct
        }
    }
]
```
- Effort: 3 hours

## Implementation Timeline

| Day | Phase | Tasks | Effort |
|-----|-------|-------|--------|
| 1 | Setup + Recipient Resolution | Add enum + enrichment requirements + RecipientResolutionStrategy | 6 hours |
| 2 | Transfer Detection | TransferTypeDetectionStrategy + integration | 4 hours |
| 3 | Intent Refinement | IntentRefinementStrategy + pipeline updates | 4 hours |
| 4-5 | Testing | Core scenarios + integration tests | 4 hours |

**Total Implementation Time: 18 hours (2.5 days)**

## Key Architecture Principles

1. **Single Responsibility**: Each strategy has one clear purpose
2. **Open-Closed Principle**: Extend via new strategies, don't modify pipeline
3. **Dependency Injection**: Strategies auto-discovered and instantiated
4. **Fail-Safe**: Enrichment failures don't break the pipeline
5. **No Side Effects**: Strategies only add data, never remove or modify existing

## Success Criteria

**Use Case 1: "Transfer $100 to Jack"**
- ✅ Enrichment resolves "Jack" → recipient_id="RCP007" (Jack White)
- ✅ Enrichment detects transfer_type="international" (Royal Bank of Canada)  
- ✅ Enrichment suggests intent refinement to `international.wire.send`
- ✅ Pipeline returns wire transfer form configuration
- ✅ User sees confirmation before execution

**Use Case 2: "Send $50 to my mum"**  
- ✅ Enrichment resolves "my mum" → recipient_id="RCP003" (Amy Winehouse)
- ✅ Enrichment detects transfer_type="internal" (Mock Bank)
- ✅ No intent refinement needed (already correct intent)
- ✅ Pipeline returns internal transfer form configuration

**Core Architecture Validation:**
- ✅ All enrichment happens via pluggable strategies
- ✅ Pipeline remains unchanged (Open-Closed Principle)
- ✅ Each strategy has single, clear responsibility
- ✅ Enrichment failures don't break the system
- ✅ Original entities never modified, only extended

**Disambiguation Handling:**
- ✅ Multiple recipients trigger disambiguation response
- ✅ StateManager tracks disambiguation context
- ✅ Response includes `DISAMBIGUATION_NEEDED` type
