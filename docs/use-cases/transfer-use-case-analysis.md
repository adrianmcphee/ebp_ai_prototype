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

## Phase 1: Bug Fixes & Core Improvements (Priority: CRITICAL, Effort: LOW)

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

**1.3 Enhance Recipient Resolution with LLM**
- Update RecipientResolutionStrategy to leverage LLM for typo handling:
  ```python
  class RecipientResolutionStrategy(EnrichmentStrategy):
      def __init__(self, banking_service, llm_client):
          self.banking = banking_service
          self.llm = llm_client
      
      async def enrich(self, entities: Dict[str, Any]) -> Dict[str, Any]:
          """Use LLM to handle typos and resolve recipients"""
          if "recipient" not in entities:
              return entities
          
          recipient_query = self._extract_entity_value(entities["recipient"])
          
          # Get all recipients for LLM to consider
          all_recipients = await self.banking.get_all_recipients()
          
          # Let LLM handle typo resolution and matching
          prompt = f'''Find the best matching recipient for "{recipient_query}".
          Consider typos, common misspellings, and aliases.
          
          Available recipients:
          {json.dumps([{"name": r["name"], "alias": r.get("alias"), "bank": r["bank_name"]} for r in all_recipients], indent=2)}
          
          Return JSON with:
          {{
              "best_match_id": "recipient_id or null",
              "confidence": 0.0-1.0,
              "reason": "why this match",
              "alternatives": ["other possible matches"]
          }}'''
          
          result = await self.llm.complete(prompt, response_format={"type": "json_object"})
          # Process LLM result to enrich entities
          return enriched_entities
  ```

**1.4 Add Explicit Intent Detection**
- Add to RecipientResolutionStrategy:
  ```python
  def detect_explicit_intent(self, query: str) -> Optional[str]:
      """Detect if user explicitly specified transfer type"""
      explicit_patterns = {
          "international": ["international", "wire", "swift"],
          "internal": ["internal", "between my accounts"],
          "external": ["external", "ach", "domestic"]
      }
      query_lower = query.lower()
      for intent_type, keywords in explicit_patterns.items():
          if any(keyword in query_lower for keyword in keywords):
              return intent_type
      return None
  ```

## Phase 2: Enhanced Recipient Resolution (Priority: HIGH, Effort: LOW with LLM)

**2.1 LLM-Powered RecipientResolutionStrategy**
- Leverage existing LLM client for intelligent matching:
  ```python
  class RecipientResolutionStrategy(EnrichmentStrategy):
      """Let LLM handle all the complexity of matching, typos, and confidence"""
      
      async def resolve_recipient(self, query: str, recipients: List[dict]) -> dict:
          """Use LLM's natural understanding for recipient matching"""
          
          # If no recipients, quick return
          if not recipients:
              return {"matched": None, "confidence": 0.0}
          
          # For single exact match, skip LLM
          if len(recipients) == 1 and recipients[0]["name"].lower() == query.lower():
              return {"matched": recipients[0], "confidence": 0.99}
          
          # Let LLM handle everything else
          prompt = f'''Match "{query}" to the correct recipient.
          Consider: exact matches, aliases, typos (like Jonh→John), nicknames.
          
          Recipients: {json.dumps(recipients, indent=2)}
          
          Return: {{"recipient_id": "...", "confidence": 0.0-1.0, "alternatives": []}}'''
          
          return await self.llm.complete(prompt, response_format={"type": "json_object"})
  ```

**2.2 Store Disambiguation Choices**
- Add to StateManager:
  ```python
  async def record_recipient_choice(self, session_id: str, query: str, chosen_id: str, options: List[str]):
      """Record user's disambiguation choice for learning"""
      context = await self.get_context(session_id)
      if "recipient_choices" not in context:
          context["recipient_choices"] = {}
      
      context["recipient_choices"][query.lower()] = {
          "chosen": chosen_id,
          "rejected": [opt for opt in options if opt != chosen_id],
          "timestamp": datetime.now().isoformat()
      }
      await self._save_context(session_id, context)
  ```

**2.3 Enhanced Disambiguation Display**
- Include meaningful information:
  ```python
  def format_recipient_option(self, recipient: Recipient) -> str:
      """Format recipient for disambiguation display"""
      display = f"{recipient.name}"
      if recipient.bank_name != "Mock Bank":
          display += f" ({recipient.bank_name})"
      if recipient.account_number:
          display += f" - ****{recipient.account_number[-4:]}"
      return display
  ```

## Phase 3: Safe Intent Refinement (Priority: HIGH, Effort: MEDIUM)

**3.1 IntentRefinementStrategy with Guardrails**
- Create new enrichment strategy with explicit intent protection:
  ```python
  class IntentRefinementStrategy(EnrichmentStrategy):
      def should_refine(self, original_query: str, original_confidence: float) -> bool:
          """Never override explicit user intent"""
          # Check for explicit keywords
          explicit_keywords = ["international", "wire", "swift", "ach", "internal", "external"]
          if any(keyword in original_query.lower() for keyword in explicit_keywords):
              return False  # User was explicit, don't refine
          
          # Only refine medium-confidence intents
          return 0.60 <= original_confidence <= 0.85
      
      def refine_intent(self, original_intent: str, transfer_type: str, original_confidence: float) -> dict:
          """Suggest refinement with alternatives"""
          refinement_map = {
              ("payments.transfer.external", "international"): "international.wire.send",
              ("payments.transfer.external", "internal"): "payments.transfer.internal",
          }
          
          new_intent = refinement_map.get((original_intent, transfer_type), original_intent)
          
          return {
              "intent": new_intent,
              "confidence": min(original_confidence + 0.10, 0.90),  # Slight boost
              "refined": new_intent != original_intent,
              "reason": f"Based on {transfer_type} transfer type",
              "requires_confirmation": True  # Always confirm refinements
          }
  ```

**3.2 User Confirmation for Refinements**
- Add to pipeline response:
  ```python
  if result.get("refined"):
      response["refinement_suggested"] = {
          "original": original_intent,
          "suggested": result["intent"],
          "reason": result["reason"],
          "message": f"I think you want to do a {transfer_type} transfer. Is that correct?"
      }
  ```

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
- Create comprehensive test scenarios:
  - "Transfer $100 to Jack" → International wire
  - "Send $50 to my mum" → Internal transfer
  - "Send $100 to Jonh" → Fuzzy match to "John"
  - "Wire money to Jack" → Explicit intent respected
- Test disambiguation flows with multiple matches
- Validate that explicit intents are never overridden
- Test edge cases (no matches, low confidence, typos)

**5.2 User Profile Integration**
- Add mock user profile with `home_bank` = "Mock Bank"
- Pass user profile through pipeline for transfer type detection
- Update API to include user context in requests

**5.3 API Response Enhancements**
- Include match type and confidence in disambiguation options
- Add refinement suggestions as optional, not automatic
- Include clear audit trail of all decisions

## Phase 6: Advanced Features (Priority: LOW, Effort: HIGH) - FOLLOW-UP

**6.1 Learning System**
- Track recipient choices per user over time:
  ```python
  class RecipientLearningSystem:
      def get_historical_boost(self, user_id: str, query: str, recipient_id: str) -> float:
          """Boost confidence based on historical choices"""
          choices = self.get_user_choices(user_id, query)
          if recipient_id in choices.get("previously_chosen", []):
              days_ago = (datetime.now() - choices["last_chosen"]).days
              recency_factor = max(0, 1 - (days_ago / 30))  # Decay over 30 days
              return 0.15 * recency_factor
          return 0.0
  ```

**6.2 User-Specific Aliases**
- Separate user aliases from global recipient data:
  ```python
  class UserAliasService:
      async def get_user_aliases(self, user_id: str) -> Dict[str, str]:
          """Get aliases specific to this user"""
          # "my mum" → recipient_id mapping is per-user
          return await self.db.get_user_aliases(user_id)
      
      async def set_user_alias(self, user_id: str, alias: str, recipient_id: str):
          """Allow users to set their own aliases"""
          await self.db.set_user_alias(user_id, alias.lower(), recipient_id)
  ```

**6.3 Enhanced LLM Prompts for Better Matching**
- Improve LLM prompts to handle edge cases:
  ```python
  def create_advanced_matching_prompt(self, query: str, recipients: List[dict], user_history: dict) -> str:
      """Create sophisticated prompt that considers context and history"""
      return f'''Match "{query}" to a recipient, considering:
      
      1. Typos and misspellings (Jonh→John, Sarh→Sarah)
      2. Phonetic similarity (Jon/John, Catherine/Katherine)
      3. Common nicknames (Bob→Robert, Bill→William)
      4. User's previous choices: {json.dumps(user_history.get("recent_recipients", []))}
      5. Cultural variations (Mohammed/Muhammad, Isabel/Isabella)
      
      Recipients: {json.dumps(recipients)}
      
      Return the best match with confidence score and reasoning.'''
  ```

**6.4 Multi-Entity Bank Handling**
- Handle complex bank relationships:
  ```python
  class BankRelationshipService:
      def get_effective_transfer_type(self, sender_bank: str, recipient_bank: str) -> str:
          """Handle bank mergers, shared networks, etc."""
          # Bank of America NA = Bank of America International
          if self.same_bank_group(sender_bank, recipient_bank):
              return "internal"
          
          # Zelle network participants
          if self.in_shared_network(sender_bank, recipient_bank, "zelle"):
              return "instant_network"
          
          return self.standard_transfer_type(sender_bank, recipient_bank)
  ```


## Implementation Sequence

| Week | Phase | Deliverable | Dependencies |
|------|-------|------------|--------------|
| 1 | Phase 1 | Bug fixes, LLM recipient matching, explicit intent | None |
| 2 | Phase 2 | Session storage, disambiguation tracking | Phase 1 |  
| 3 | Phase 3 | Safe intent refinement with user confirmation | Phase 2 |
| 4 | Phase 4 | Enhanced clarification and testing | Phase 2, 3 |
| 5 | Phase 5 | Integration, user profile & comprehensive testing | All phases |
| Future | Phase 6 | User aliases, learning system, A/B testing | Phase 1-5 |

## Success Criteria

**Use Case 1: "Transfer $100 to Jack"**
- ✅ Resolves "Jack" → "Jack White" via alias matching (0.95 confidence)
- ✅ Detects international transfer type via bank country  
- ✅ Suggests (not forces) intent refinement to `international.wire.send`
- ✅ Returns pre-filled international wire form configuration
- ✅ Records user's choice if disambiguation needed

**Use Case 2: "Send $50 to my mum"**  
- ✅ Resolves "my mum" → "Amy Winehouse" via alias matching
- ✅ Detects internal transfer type via same bank
- ✅ Maintains `payments.transfer.internal` intent
- ✅ Returns pre-filled internal transfer form configuration

**Additional Critical Cases:**
- ✅ "Send $100 to Jonh" → LLM matches to "John Smith" (handles typos naturally)
- ✅ "Do an international wire to Jack" → Respects explicit intent, no refinement
- ✅ "Send money to Jack" (multiple Jacks) → LLM presents options with reasoning
- ✅ User chooses "Jack Brown" → System remembers for session context

**Edge Cases Handled by LLM:**
- ✅ Multiple recipients with same name (LLM explains differences)
- ✅ Typos and misspellings (LLM handles naturally, no manual algorithm)
- ✅ Phonetic similarities (Jon/John, Catherine/Katherine)
- ✅ Cultural name variations (Mohammed/Muhammad)
- ✅ Nicknames (Bob→Robert, Bill→William)
- ✅ Explicit user intent (simple keyword check prevents override)
- ✅ Previous choices influence future matches (passed as LLM context)
