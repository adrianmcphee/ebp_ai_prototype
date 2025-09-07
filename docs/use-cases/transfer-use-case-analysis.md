# Transfer Use Case Analysis

## Context: Supported Transfer Types

The system supports four types of money transfers and payments:

1. **Internal Transfer** (`payments.transfer.internal`) - Between accounts within the same bank (instant, low cost)
2. **External Transfer** (`payments.transfer.external`) - To external accounts at different banks within the same country (ACH/wire, 1-2 business days)
3. **P2P Payment** (`payments.p2p.send`) - Person-to-person payments using services like Zelle, Venmo (instant, medium cost)
4. **International Wire** (`international.wire.send`) - Between banks in different countries (SWIFT wire, 3-5 business days, high cost)

Each of the operation is defined by an intent in the backend/src/intent_catalog.py

### Key Differences

| Type | Speed | Daily Limit (transfers) | Daily Limit (amounts) | Required Info | User Thinks |
|------|-------|-------------|-------------|---------------|-------------|
| **Internal**      | Instant  | 200 | 100000 | Account name      | "Move to my savings" |
| **P2P**           | Instant  | 100 | 1000   | Phone/email       | "Pay my friend" |
| **External**      | 1-3 days | 20  | 10000  | Account + routing | "Send to another bank" |
| **International** | 3-5 days | 10  | 100000 | SWIFT + details   | "Send money abroad" |

**Decision Flow:**
- Same customer? → Internal
- Have their phone? → P2P  
- Different bank in US? → External
- Different country? → International

## Use Cases

### Given (assumptions due to the system development state):
1. User of the system is a client of `Mock Bank`, located in `US`

### Internal Transfer use cases

**User query**: "Transfer $100 to my savings account"
**Expected result**:
- **Initial intents**: `payments.transfer.internal` (identified explicitly by "my" indicating same customer)
- **Extracted entities**: 
  - `amount`: $100
  - `to_account`: "my savings" (account type reference)
- **Enriched entities**:
  - `to_account`: SAV001 (Savings Account) - resolved from account type "savings", as user has single saving account (NO ASSUMPTIONS MADE)
- **Confirmed intent**: `payments.transfer.internal` (no change)
- **Status**: `awaiting_user_input` - form presented requesting missing `from_account` entity

**User query**: "Move $500 from checking to business account"
**Expected result**:
- **Initial intents**: `payments.transfer.internal` (identified explicitly by specific account names)
- **Extracted entities**: 
  - `amount`: $500
  - `from_account`: "checking" (account name reference)
  - `to_account`: "business account" (account name reference)
- **Enriched entities**:
  - `from_account`: "checking" - AMBIGUOUS (could be CHK001 Primary or CHK002 Business)
  - `to_account`: CHK002 (Business Checking) - resolved from "business account" unambiguously
- **Ambiguity removal**: Since `to_account` = CHK002 and accounts can't be same, `from_account` must be CHK001 (Primary Checking)
- **Confirmed intent**: `payments.transfer.internal` (no change)
- **Status**: `awaiting_user_confirmation` - pre-filled form presented for user approval

### External Transfer use cases
**User query**: "Send $2000 to Sarah at Wells Fargo"  
**Expected result**:
- **Initial intents**: [`payments.transfer.external`, `payments.p2p.send`, `international.wire.send`] (multiple possible until recipient resolved)
- **Extracted entities**: 
  - `amount`: $2000
  - `recipient`: "Sarah"
- **Enriched entities**:
  - `recipient`: RCP004 (Sarah Johnson) - resolved from "Sarah" (match to recipient alias, which is also unique across the list)
  - `recipient_account`: 1234567890123 - obtained from resolved recipient
- **Confirmed intent**: `payments.transfer.external` ($2000 exceeds P2P daily limit of $1000, external bank confirmed)
- **Status**: `awaiting_user_confirmation` - form presented with account selection required

**User query**: "Transfer $3000 to my mum"
**Expected result**:
- **Initial intents**: [`payments.transfer.internal`, `payments.p2p.send`] ("my" suggests internal, but could be P2P)
- **Extracted entities**: 
  - `amount`: $3000
  - `recipient`: "my mum" (recipient alias)
- **Enriched entities**:
  - `recipient`: RCP003 (Amy Winehouse) - resolved from alias "my mum" (alias of the recipient)
  - `recipient_account`: 4532891067834523 - obtained from resolved recipient
- **Confirmed intent**: `payments.transfer.external` ($3000 exceeds P2P limit of $1000, different customer confirmed)
- **Status**: `awaiting_user_confirmation` - pre-filled form presented for user approval

### P2P Payment use cases
**User query**: "Zelle $50 to my friend Mike"
**Expected result**:
- **Initial intents**: `payments.p2p.send` (identified explicitly by "Zelle" keyword)
- **Extracted entities**: 
  - `amount`: $50
  - `recipient`: "my friend Mike"
- **Enriched entities**:
  - `recipient`: RCP005 (Michael Davis) - resolved from "Mike" reference
- **Confirmed intent**: `payments.p2p.send` (no change)
- **Status**: `awaiting_user_confirmation` - pre-filled form presented for user approval

**User query**: "Pay Sarah $25 for coffee"
**Expected result**:
- **Initial intents**: [`payments.p2p.send`, `payments.transfer.external`] ("pay" could be P2P or traditional transfer)
- **Extracted entities**: 
  - `amount`: $25
  - `recipient`: "Sarah"
  - `memo`: "for coffee" (optional)
- **Enriched entities**:
  - `recipient`: RCP004 (Sarah Johnson) - resolved from "Sarah"
- **Confirmed intent**: `payments.p2p.send` (social context "for coffee" suggests P2P over formal transfer)
- **Status**: `awaiting_user_confirmation` - pre-filled form presented for user approval

### International Wire use cases
**User query**: "Send $1500 to Jack"
**Expected result**:
- **Initial intents**: [`payments.transfer.external`, `payments.p2p.send`, `international.wire.send`] (generic "send" - multiple possibilities)
- **Extracted entities**: 
  - `amount`: $1500
  - `recipient`: "Jack"
- **Enriched entities**:
  - `recipient`: RCP007 (Jack White) - resolved from "Jack"
  - `recipient_account`: 123456789 - obtained from resolved recipient
  - `swift_code`: ROYCCAT2 - obtained from resolved recipient bank
- **Confirmed intent**: `international.wire.send` (after finding Jack at international bank, amount exceeds P2P limit)
- **Status**: `awaiting_user_input` - form presented requesting missing `currency` entity

**User query**: "Send $800 to Hans"
**Expected result**:
- **Initial intents**: [`payments.transfer.external`, `payments.p2p.send`, `international.wire.send`] (generic "send" - multiple possibilities)
- **Extracted entities**: 
  - `amount`: $800
  - `recipient`: "Hans"
- **Enriched entities**:
  - `recipient`: RCP008 (Hans Mueller) - resolved from "Hans"
  - `recipient_account`: DE89370400440532013000 - obtained from resolved recipient (IBAN format)
  - `swift_code`: DEUTDEFF - obtained from resolved recipient bank
- **Confirmed intent**: `international.wire.send` (after finding Hans at international bank, amount exceeds P2P limit)
- **Status**: `awaiting_user_input` - form presented requesting missing `currency` entity


# How it should work?

1. **Intent Classification**: Initial classification with confidence scoring, then refined after recipient resolution
   - "Transfer $100 to my savings account" → `payments.transfer.internal` (confidence: 0.92, clear keywords, no recipient)
   - "Send $2000 to Sarah at Wells Fargo" → [`payments.transfer.external`, `payments.p2p.send`, `international.wire.send`] (confidence: 0.78, multiple possibilities) → `payments.transfer.external` (after resolving Sarah and P2P limits)  
   - "Zelle to my friend Mike" → `payments.p2p.send` (confidence: 0.95, explicit P2P service name + social context)
   - "Send $800 to Hans" → [`payments.transfer.external`, `payments.p2p.send`, `international.wire.send`] (confidence: 0.75, generic "send") → `international.wire.send` (after resolving Hans)

2. **Entity Extraction**: Extract entities directly from user query
   - "Transfer $100 to my savings" → amount: 100.0, currency: "$", to_account: "my savings"
   - "Move $500 from checking to business account" → amount: 500.0, currency: "$", from_account: "checking", to_account: "business account"
   - "Send $2000 to Sarah" → amount: 2000.0, currency: "$", recipient: "Sarah"
   - "Pay Sarah $25 for coffee" → amount: 25.0, currency: "$", recipient: "Sarah", memo: "for coffee"
   - "Send $800 to Hans" → amount: 800.0, currency: "$", recipient: "Hans"
   - "Transfer $3000 to my mum" → amount: 3000.0, currency: "$", recipient: "my mum"

3. **Entity Enrichment**: Resolve extracted entities to actual data
   - "my savings" → SAV001 (Savings Account, $15,000 balance) - unambiguous (only 1 savings account)
   - "checking" → AMBIGUOUS: CHK001 (Primary) vs CHK002 (Business) - multiple matches found
   - "business account" → CHK002 (Business Checking) - unambiguous account name match
   - "Sarah" → RCP004 (Sarah Johnson at Wells Fargo, routing: 121000248)
   - "Hans" → RCP008 (Hans Mueller at Deutsche Bank AG, SWIFT: DEUTDEFF)
   - "my mum" → RCP003 (Amy Winehouse at Mock Bank - external transfer due to different customer)

4. **Ambiguity Removal**: Apply business logic to resolve conflicts based on intent-specific rules
   - "Move $500 from checking to business account" → `from_account` ambiguity resolved: "checking" could be CHK001 or CHK002, but since `to_account` is CHK002 (business) and accounts can't be same, `from_account` must be CHK001 (Primary Checking)
   - "Send $2000 to Sarah" → Amount exceeds P2P limit ($1000), eliminate `payments.p2p.send` from initial possibilities. Upgrade to `payments.transfer.external`
   - "Transfer $3000 to my mum" → Amount exceeds P2P limit ($1000), eliminate `payments.p2p.send` from possibilities
   - "Send $1500 to Jack" → After recipient resolution shows international location, amount is within limits ($100000), proceed with international wire, i.e. upgrade to `international.wire.send`
   - "Send $800 to Hans" → After recipient resolution shows international location, amount is within limits ($100000), proceed with international wire, i.e. upgrade to `international.wire.send`

5. **Confidence Evaluation**: Apply confidence thresholds per ARCHITECTURE.md requirements
   - Confidence ≥ 0.85: Proceed with confirmation → "Transfer $100 to my savings" (0.92), "Zelle $50 to Mike" (0.95)
   - Confidence 0.6-0.85: Present disambiguation choices → "Send $2000 to Sarah" (0.78), "Send $800 to Hans" (0.75)  
   - Confidence < 0.6: Request clarification → [None in our examples]

6. **Human-in-the-Loop Confirmation**: Present dynamic form with AI suggestions for user confirmation (CRITICAL for banking compliance)
   - UI Context determines execution method: `ui_context: "transaction"` → Dynamic form assembly
   - "Move $500 from checking to business account" → Show pre-filled form: "Transfer $500 from Primary Checking to Business Checking - Confirm?"
   - "Send $2000 to Sarah" → Show pre-filled form: "Send $2000 to Sarah Johnson (Wells Fargo) from [account selection] - Confirm?"
   - "Transfer $100 to my savings" → Show form requesting missing from_account: "Transfer $100 to Savings Account from [account selection] - Confirm?"
   - "Send $1500 to Jack" → Show form requesting missing currency: "Send $1500 to Jack White (Canada) in [currency selection] - Confirm?"

7. **Status**: Final status after processing through all steps including user confirmation
   - "Transfer $100 to my savings" → `awaiting_user_input` - form presented requesting missing `from_account` entity
   - "Move $500 from checking to business account" → `awaiting_user_confirmation` - pre-filled form presented for user approval
   - "Send $2000 to Sarah" → `awaiting_user_confirmation` - form presented with account selection required
   - "Transfer $3000 to my mum" → `awaiting_user_confirmation` - pre-filled form presented for user approval  
   - "Send $1500 to Jack" → `awaiting_user_input` - form presented requesting missing `currency` entity
   - "Send $800 to Hans" → `awaiting_user_input` - form presented requesting missing `currency` entity
   - "Zelle $50 to my friend Mike" → `awaiting_user_confirmation` - pre-filled form presented for user approval
   - "Pay Sarah $25 for coffee" → `awaiting_user_confirmation` - pre-filled form presented for user approval

**Note**: Final `success` status only occurs AFTER user confirms and system executes the transaction 

# Gap Analysis

## Missing Systems (High Level)

1. **RecipientResolutionStrategy**: Missing enrichment strategy class for recipient lookup/resolution from aliases ("my mum" → RCP003)
2. **LLM-based Intent Refinement**: Missing post-enrichment intent reclassification using LLM after recipient metadata is available
3. **Banking Operation Method Stubs**: Missing method stubs in MockBankingService (`send_payment`, `block_card`, etc.) 
4. **Enhanced Entity Types**: Missing recipient-specific entity types in EntityExtractor
5. **Intent Enrichment Requirements**: Transfer intents missing `enrichment_requirements` declarations
6. **Business Rules (limits for P2P)**: Missing P2P daily limit validation ($1000) that drives intent refinement in use cases
7. **Account Disambiguation Logic**: Missing sophisticated "checking" account disambiguation when user has multiple checking accounts

## Existing Systems Improvements

### Overall Pipeline (@pipeline.py)
- **Current**: Basic entity enrichment via `_apply_entity_enrichment` 
- **Gap**: Missing LLM-based intent refinement after entity enrichment
- **Fix**: Add post-enrichment intent reclassification hook using LLM

### Banking Data & Structure (@mock_banking.py)
- **Current**: Rich recipient data with international metadata, solid account structure
- **Gap**: Missing method stubs called by banking operations (`send_payment`, `block_card`, `dispute_transaction`)
- **Strength**: Transfer type detection via `recipient.transfer_type()` method already implemented, `search_recipients()` method available
- **Fix**: Add simple method stubs (no complex business logic needed for now)

### Intents Structure and Data (@intent_catalog.py)
- **Current**: Comprehensive intent definitions with proper risk levels and entity requirements
- **Gap**: Missing `enrichment_requirements` population for transfer intents
- **Fix**: Add enrichment strategies to transfer intents (`["account_resolution", "recipient_resolution"]`)

### Intents Classification (@intent_classifier.py)
- **Current**: LLM-first with pattern-based fallback, solid caching
- **Gap**: No post-enrichment LLM-based intent reclassification after recipient resolution
- **Strength**: Unified catalog integration works correctly, LLM approach is solid foundation
- **Fix**: Add LLM-based intent refinement method that considers enriched entity metadata

### Entity Extraction (@entity_extractor.py)  
- **Current**: Modern hybrid approach with LLM function calling and comprehensive entity types
- **Gap**: Missing recipient-specific entity types (`recipient_id`, `recipient_account`, `swift_code`)
- **Strength**: LLM-based extraction with structured functions is excellent foundation
- **Fix**: Extend entity extraction functions to include recipient-specific fields

### Entity Enrichment (@entity_enricher.py)
- **Current**: Strategy pattern implemented with account resolution, auto-discovery works perfectly
- **Gap**: Missing `RecipientResolutionStrategy` class despite `banking_service.search_recipients()` being available
- **Strength**: Auto-discovery of enrichment strategies follows Open-Closed Principle correctly
- **Existing Assets**: `ConversationStateManager._match_clarification_response()` has sophisticated fuzzy matching logic for disambiguation
- **Fix**: Add `RecipientResolutionStrategy` class that reuses existing search and disambiguation patterns

### Banking Operations (@banking_operations.py)
- **Current**: Well-structured operation definitions with business rules like `["amount_within_limits"]`
- **Gap**: Transfer-specific limits missing from existing business rule framework  
- **Strength**: Good separation of concerns between operations and execution
- **Fix**: Extend existing business rules with transfer limits and implement missing MockBankingService method stubs

### State Management (@state_manager.py)  
- **Current**: Context preservation and reference resolution implemented
- **Gap**: Missing disambiguation context management for complex scenarios  
- **Strength**: `_match_clarification_response()` already handles sophisticated fuzzy matching, partial matches, and typo tolerance
- **Fix**: Reuse existing disambiguation logic for recipient resolution, add multi-turn tracking

# Implementation Plan

## Phase 1: Core Transfer Infrastructure (High Priority)

### 1.1 Missing MockBankingService Method Stubs  
```python
# Add simple stubs to MockBankingService
async def send_payment(self, recipient: str, amount: float, from_account: str) -> dict:
    # Simple success stub - no complex business logic
    return {"success": True, "payment_id": f"PAY-{datetime.now().strftime('%Y%m%d%H%M%S')}"}

async def block_card(self, card_id: str, temporary: bool = True) -> dict:
    return {"success": True, "card_blocked": card_id, "temporary": temporary}

async def dispute_transaction(self, transaction_id: str) -> dict:  
    return {"success": True, "dispute_id": f"DIS-{datetime.now().strftime('%Y%m%d%H%M%S')}"}
```

### 1.2 RecipientResolutionStrategy Class
```python
# Reuse existing patterns: AccountResolutionStrategy + state_manager disambiguation logic
class RecipientResolutionStrategy(EnrichmentStrategy):
    def __init__(self, banking_service):
        self.banking = banking_service
        
    def get_strategy_name(self) -> str:
        return "recipient_resolution"
        
    def can_enrich(self, entities: Dict[str, Any]) -> bool:
        return "recipient" in entities
        
    def enrich(self, entities: Dict[str, Any]) -> Dict[str, Any]:
        recipient_query = self._extract_entity_value(entities["recipient"])
        
        # Use existing banking.search_recipients() for initial search
        matches = await self.banking.search_recipients(recipient_query)
        
        if len(matches) == 1:
            # Single match - enrich existing entity with full recipient data
            entities["recipient"]["enriched_entity"] = matches[0]
            return entities
        elif len(matches) > 1:
            # Multiple matches - use existing fuzzy matching logic from state_manager
            best_match = self._find_best_match(recipient_query, matches)
            if best_match:
                entities["recipient"]["enriched_entity"] = best_match
                return entities
            # Set disambiguation_needed flag for pipeline to handle
            
        # Also search by account_number if no name/alias matches
        return self._search_by_account_number(entities, recipient_query)
    
    def _find_best_match(self, query: str, options: List[Dict]) -> Optional[Dict]:
        # REUSE existing ConversationStateManager._match_clarification_response logic
        # This already handles:
        # - Exact matches: "John Smith" → John Smith
        # - Partial matches: "John" → John Smith, "Smith" → John Smith  
        # - Typos: "Jonh" → John, "Jon" → John (partial matching handles this)
        # - Multiple matches: Returns None, sets disambiguation_needed flag
        
        # Import and adapt the existing logic:
        from .state_manager import ConversationStateManager
        state_manager = ConversationStateManager(None, None)  # Just for the method
        return state_manager._match_clarification_response(query, options)
```

### 1.3 LLM-based Intent Refinement (Simple Extension)
```python
# REUSE existing _classify_with_llm structure with minimal changes
async def refine_intent_with_enriched_entities(self, original_intent: str, entities: Dict[str, Any], query: str) -> str:
    # Build simple context from enriched entities
    context_parts = [f"Original intent: {original_intent}"]
    
    if "recipient" in entities:
        # Get recipient details via banking service if needed
        recipient_id = entities["recipient"].get("value") 
        context_parts.append(f"Recipient resolved: {recipient_id}")
    
    amount = entities.get("amount", {}).get("value", 0)
    if amount > 0:
        context_parts.append(f"Amount: ${amount}")
    
    # REUSE existing prompt structure - simple and clean
    prompt = f"""Refine this banking intent classification based on enriched entity data.

Query: "{query}"
Context:
{chr(10).join(context_parts)}

Available intents: payments.p2p.send, payments.transfer.external, payments.transfer.internal, international.wire.send

Apply these rules:
- If recipient is international → international.wire.send
- If amount > $1000 → eliminate payments.p2p.send option
- Otherwise keep original intent if still valid

Return JSON: {{"intent_id": "refined_intent", "confidence": 0.0-1.0, "reasoning": "brief explanation"}}"""
    
    # REUSE existing LLM call pattern exactly
    response = await self.llm.complete(prompt=prompt, temperature=0.2, response_format={"type": "json_object"})
    return self._validate_llm_response(response)
```

### 1.4 Business Rule Integration (Extend Existing Pattern)
```python
# EXTEND existing context_aware_responses.py business_rules instead of new class
def _initialize_business_rules(self) -> dict[str, Any]:
    rules = super()._initialize_business_rules()  # Get existing rules
    
    # ADD transfer-specific limits to existing structure  
    rules.update({
        "p2p_limit_check": {
            "description": "P2P payment limit check",
            "daily_limit": 1000,
            "error_message": "Amount exceeds P2P limit of $1000. Consider external transfer.",
        },
        "external_limit_check": {
            "description": "External transfer limit check", 
            "daily_limit": 10000,
            "error_message": "Amount exceeds external transfer limit of $10000.",
        },
        "international_limit_check": {
            "description": "International wire limit check",
            "daily_limit": 100000, 
            "error_message": "Amount exceeds international wire limit of $100000.",
        }
    })
    return rules

# SIMPLE helper function for intent refinement (no complex class needed)
def should_upgrade_intent(intent_id: str, amount: float, recipient_international: bool) -> Optional[str]:
    if recipient_international:
        return "international.wire.send" 
    if intent_id == "payments.p2p.send" and amount > 1000:
        return "payments.transfer.external"
    return None
```

### 1.5 Account Disambiguation (Extend Existing Validation)  
```python
# EXTEND existing _resolve_account_id with simple exclusion logic
def _resolve_account_id_with_exclusion(self, entities: Dict[str, Any], exclude_account_id: str = None) -> str:
    # REUSE existing resolution logic but exclude specified account
    candidates = []
    
    if "account_type" in entities:
        account_type = self._extract_entity_value(entities["account_type"]).lower()
        for acc_id, account in self.banking.accounts.items():
            if account.type.lower() == account_type and acc_id != exclude_account_id:
                candidates.append(acc_id)
    
    # Return first valid candidate (simple and predictable)
    return candidates[0] if candidates else None

# SIMPLE disambiguation helper (no complex hardcoded rules)
def resolve_transfer_accounts(self, entities: Dict[str, Any]) -> Dict[str, str]:
    resolved = {}
    
    # Resolve to_account first
    if "to_account" in entities:
        resolved["to_account"] = self._resolve_account_id(entities["to_account"])
    
    # Resolve from_account, excluding to_account to avoid same-account transfers  
    if "from_account" in entities:
        resolved["from_account"] = self._resolve_account_id_with_exclusion(
            entities["from_account"], 
            exclude_account_id=resolved.get("to_account")
        )
    
    return resolved
```

## Phase 2: Enhanced Entity Handling (Medium Priority)

### 2.1 Enhanced Entity Types for Transfers
```python
# REUSE existing LLM extraction function structure (_define_extraction_functions)
# ADD new fields to existing "extract_banking_entities" function:

def _define_extraction_functions(self) -> list[dict[str, Any]]:
    return [
        {
            "name": "extract_banking_entities",
            "parameters": {
                "type": "object", 
                "properties": {
                    # ... existing fields ...
                    "recipient": {"type": "string", "description": "Person or entity receiving money"},
                    
                    # NEW fields for recipient enrichment
                    "recipient_account": {"type": "string", "description": "Recipient account number if mentioned"},
                    "swift_code": {"type": "string", "description": "SWIFT/BIC code if mentioned"},
                    "recipient_bank": {"type": "string", "description": "Recipient bank name if mentioned"},
                    
                    # NEW EntityType enum values  
                    EntityType.RECIPIENT_ID = "recipient_id"
                    EntityType.RECIPIENT_ACCOUNT = "recipient_account"
                    EntityType.SWIFT_CODE = "swift_code"
                }
            }
        }
    ]
```

### 2.2 Intent Catalog Enrichment Requirements
```python
# Update transfer intent definitions
"payments.transfer.internal": BankingIntent(
    enrichment_requirements=["account_resolution"],
)
"payments.transfer.external": BankingIntent(  
    enrichment_requirements=["recipient_resolution", "account_resolution"],
)
"international.wire.send": BankingIntent(
    enrichment_requirements=["recipient_resolution", "account_resolution"],
)
```

## Phase 3: Pipeline Integration (Lower Priority)

### 3.1 Enhanced Search Capabilities (For Use Case Coverage)
```python
# EXTEND existing search_recipients following OCP - add new method for completeness
async def search_recipients_with_account(self, query: str) -> list[dict[str, Any]]:
    # REUSE existing search_recipients for name/alias matching
    matches = await self.search_recipients(query)
    
    # EXTEND with account number search for edge cases
    if not matches:
        account_matches = [
            r.to_dict() for r in self.recipients 
            if query in r.account_number  # Support account number queries
        ]
        matches.extend(account_matches)
    
    return matches
```

### 3.2 Post-Enrichment Intent Refinement Hook (Simple Integration)
```python
# ADD to existing pipeline.py process() method after entity enrichment
async def process(...):
    # ... existing enrichment logic ...
    entities = await self._apply_entity_enrichment(classification.get("intent_id"), entities)
    
    # NEW: Simple intent refinement check after enrichment
    if "recipient" in entities.get("entities", {}):
        amount = entities.get("entities", {}).get("amount", {}).get("value", 0)
        recipient_id = entities.get("entities", {}).get("recipient", {}).get("value")
        
        # SIMPLE upgrade check using helper function - would need to lookup recipient details if needed
        # For now, use simple amount-based rules
        suggested_intent = should_upgrade_intent(
            classification.get("intent_id"), 
            amount, 
            False  # Would determine from banking service if needed
        )
        
        if suggested_intent:
            refined_classification = await self.classifier.refine_intent_with_enriched_entities(
                classification.get("intent_id"), entities.get("entities", {}), resolved_query
            )
            if refined_classification.get("intent_id") == suggested_intent:
                classification = refined_classification
```

## Implementation Notes

### SOLID Principles & Code Reuse
- **Open-Closed Principle**: Add `RecipientResolutionStrategy` without modifying existing enrichment system; extend search_recipients via new method
- **Single Responsibility**: Each component maintains clear responsibility - enrichment strategies only enrich, classifier only classifies
- **Dependency Inversion**: Strategies depend on banking_service abstraction, not concrete implementation

### Reusing Existing Code Assets
- **Disambiguation Logic**: Reuse `ConversationStateManager._match_clarification_response()` for fuzzy recipient matching and typo handling
- **LLM Classification**: Extend existing `_classify_with_llm()` prompt structure for intent refinement
- **Entity Extraction**: Extend existing `extract_banking_entities` function schema for new recipient fields
- **Search Capabilities**: Build upon existing `search_recipients()` method with enhanced version

### Architecture Preservation  
- **LLM-First Approach**: Maintain existing LLM-based classification and entity extraction patterns
- **Simple Stubs**: Banking operation stubs return success - no complex business logic needed
- **Probabilistic → Deterministic Flow**: Keep existing architecture with added enrichment + business rule validation steps
- **Auto-Discovery**: Entity enrichment strategies auto-discovered by existing `_auto_discover_strategies()`

### Critical Use Case Alignment
- **P2P Business Rules**: Simple business rule extension with $1000 P2P limit validation
- **Amount-based Intent Refinement**: Clean helper function eliminates P2P when amount > $1000
- **Account Disambiguation**: Simple exclusion logic prevents same-account transfers
- **Recipient-driven Intent Changes**: International recipient detection triggers intent upgrade

### Banking Compliance
- **Human-in-the-Loop**: All transfer operations require user confirmation via existing approval workflow
- **Business Rule Enforcement**: Transfer limits validated before execution (P2P: $1000, External: $10000, International: $100000)
- **Audit Trail**: Leverage existing audit logging in pipeline processing with enhanced business rule tracking

# Success Criteria

These success criteria demonstrate the expected system behavior for each transfer use case through standardized `/api/process` request-response pairs that follow the exact ProcessResponse schema and match the defined use cases.

## UC1: Transfer to Single Savings Account
**Use Case**: "Transfer $100 to my savings account" → `payments.transfer.internal`  
**Expected**: SAV001 resolved, missing from_account requires user input

**Request:**
```json
POST /api/process
{
  "query": "Transfer $100 to my savings account",
  "session_id": "session_123",
  "ui_context": "transaction"
}
```

**Expected Response:**
```json
{
  "intent": "payments.transfer.internal",
  "confidence": 0.92,
  "entities": {
    "amount": {"value": 100.0, "raw": "$100", "confidence": 0.98, "source": "extraction"},
    "to_account": {
      "value": "SAV001",
      "raw": "my savings",
      "confidence": 0.95,
      "source": "enrichment",
      "enriched_entity": {
        "id": "SAV001",
        "name": "Savings Account",
        "type": "savings",
        "balance": 15000.00,
        "currency": "USD"
      }
    }
  },
  "missing_fields": ["from_account"],
  "pending_clarification": {
    "type": "missing_entity",
    "entity": "from_account",
    "message": "Which account would you like to transfer from?"
  }
}
```

## UC2: Account Disambiguation with Business Logic
**Use Case**: "Move $500 from checking to business account" → `payments.transfer.internal`  
**Expected**: CHK002 resolved for "business", CHK001 for "checking" via exclusion

**Request:**
```json
POST /api/process
{
  "query": "Move $500 from checking to business account",
  "session_id": "session_123",
  "ui_context": "transaction"
}
```

**Expected Response:**
```json
{
  "intent": "payments.transfer.internal",
  "confidence": 0.89,
  "entities": {
    "amount": {"value": 500.0, "raw": "$500", "confidence": 0.98, "source": "extraction"},
    "from_account": {
      "value": "CHK001",
      "raw": "checking",
      "confidence": 0.85,
      "source": "enrichment",
      "enriched_entity": {
        "id": "CHK001",
        "name": "Primary Checking",
        "type": "checking",
        "balance": 5000.00,
        "currency": "USD"
      }
    },
    "to_account": {
      "value": "CHK002",
      "raw": "business account",
      "confidence": 0.92,
      "source": "enrichment",
      "enriched_entity": {
        "id": "CHK002",
        "name": "Business Checking",
        "type": "checking",
        "balance": 25000.00,
        "currency": "USD"
      }
    }
  },
}
```

## UC3: External Transfer with P2P Limit Logic
**Use Case**: "Send $2000 to Sarah at Wells Fargo" → `payments.transfer.external`  
**Expected**: RCP004 resolved, amount exceeds P2P limit, missing from_account

**Request:**
```json
POST /api/process
{
  "query": "Send $2000 to Sarah at Wells Fargo",
  "session_id": "session_123",
  "ui_context": "transaction"
}
```

**Expected Response:**
```json
{
  "intent": "payments.transfer.external",
  "confidence": 0.87,
  "entities": {
    "amount": {"value": 2000.0, "raw": "$2000", "confidence": 0.98, "source": "extraction"},
    "recipient": {
      "value": "RCP004",
      "raw": "Sarah",
      "confidence": 0.91,
      "source": "enrichment",
      "enriched_entity": {
        "id": "RCP004",
        "name": "Sarah Johnson",
        "account_number": "1234567890123",
        "bank_name": "Wells Fargo Bank",
        "alias": "Sarah",
        "bank_country": "US",
        "routing_number": "121000248",
        "swift_code": null,
        "bank_address": null
      }
    }
  },
  "missing_fields": ["from_account"],
  "pending_clarification": {
    "type": "missing_entity",
    "entity": "from_account",
    "message": "Which account would you like to send from?"
  }
}
```

## UC4: Recipient Alias Resolution with Intent Refinement  
**Use Case**: "Transfer $3000 to my mum" → `payments.transfer.external`  
**Expected**: RCP003 resolved from alias, P2P limit exceeded

**Request:**
```json
POST /api/process
{
  "query": "Transfer $3000 to my mum",
  "session_id": "session_123",
  "ui_context": "transaction"
}
```

**Expected Response:**
```json
{
  "intent": "payments.transfer.external",
  "confidence": 0.84,
  "entities": {
    "amount": {"value": 3000.0, "raw": "$3000", "confidence": 0.98, "source": "extraction"},
    "recipient": {
      "value": "RCP003",
      "raw": "my mum",
      "confidence": 0.88,
      "source": "enrichment",
      "enriched_entity": {
        "id": "RCP003",
        "name": "Amy Winehouse",
        "account_number": "4532891067834523",
        "bank_name": "Mock Bank",
        "alias": "my mum",
        "bank_country": "US",
        "routing_number": "123456789",
        "swift_code": null,
        "bank_address": null
      }
    }
  },
  "missing_fields": ["from_account"],
  "pending_clarification": {
    "type": "missing_entity",
    "entity": "from_account", 
    "message": "Which account would you like to send from?"
  }
}
```

## UC5: Explicit P2P Service Recognition
**Use Case**: "Zelle $50 to my friend Mike" → `payments.p2p.send`  
**Expected**: RCP005 resolved, Zelle keyword recognized, within P2P limits

**Request:**
```json
POST /api/process
{
  "query": "Zelle $50 to my friend Mike",
  "session_id": "session_123",
  "ui_context": "transaction"
}
```

**Expected Response:**
```json
{
  "intent": "payments.p2p.send",
  "confidence": 0.95,
  "entities": {
    "amount": {"value": 50.0, "raw": "$50", "confidence": 0.98, "source": "extraction"},
    "recipient": {
      "value": "RCP005",
      "raw": "my friend Mike",
      "confidence": 0.89,
      "source": "enrichment", 
      "enriched_entity": {
        "id": "RCP005",
        "name": "Michael Davis",
        "account_number": "9876543210987",
        "bank_name": "Chase Bank",
        "alias": "Mike",
        "bank_country": "US",
        "routing_number": "021000021",
        "swift_code": null,
        "bank_address": null
      }
    }
  },
  "missing_fields": ["from_account"],
  "pending_clarification": {
    "type": "missing_entity",
    "entity": "from_account",
    "message": "Which account would you like to send from?"
  }
}
```

## UC6: Social Context with Optional Memo
**Use Case**: "Pay Sarah $25 for coffee" → `payments.p2p.send`  
**Expected**: RCP004 resolved, memo extracted, social context suggests P2P

**Request:**
```json
POST /api/process  
{
  "query": "Pay Sarah $25 for coffee",
  "session_id": "session_123",
  "ui_context": "transaction"
}
```

**Expected Response:**
```json
{
  "intent": "payments.p2p.send",
  "confidence": 0.91,
  "entities": {
    "amount": {"value": 25.0, "raw": "$25", "confidence": 0.98, "source": "extraction"},
    "recipient": {
      "value": "RCP004", 
      "raw": "Sarah",
      "confidence": 0.91,
      "source": "enrichment",
      "enriched_entity": {
        "id": "RCP004",
        "name": "Sarah Johnson", 
        "account_number": "1234567890123",
        "bank_name": "Wells Fargo Bank",
        "alias": "Sarah",
        "bank_country": "US",
        "routing_number": "121000248",
      }
    },
    "memo": {"value": "for coffee", "raw": "for coffee", "confidence": 0.87, "source": "extraction"}
  },
  "missing_fields": ["from_account"],
  "pending_clarification": {
    "type": "missing_entity", 
    "entity": "from_account",
    "message": "Which account would you like to send from?"
  }
}
```

## UC7: International Transfer with Currency Requirement
**Use Case**: "Send $1500 to Jack" → `international.wire.send`  
**Expected**: RCP007 (Canada) resolved, international detected, currency missing

**Request:**
```json
POST /api/process
{
  "query": "Send $1500 to Jack",
  "session_id": "session_123",
  "ui_context": "transaction"
}
```

**Expected Response:**
```json
{
  "intent": "international.wire.send",
  "confidence": 0.86,
  "entities": {
    "amount": {"value": 1500.0, "raw": "$1500", "confidence": 0.98, "source": "extraction"},
    "recipient": {
      "value": "RCP007",
      "raw": "Jack",
      "confidence": 0.87,
      "source": "enrichment",
      "enriched_entity": {
        "id": "RCP007",
        "name": "Jack White",
        "account_number": "123456789",
        "bank_name": "Royal Bank of Canada",
        "alias": "Jack W",
        "bank_country": "CA",
        "routing_number": null,
        "swift_code": "ROYCCAT2",
        "bank_address": "200 Bay Street, Toronto, ON M5J 2J5, Canada"
      }
    }
  },
  "missing_fields": ["currency", "from_account"],
  "pending_clarification": {
    "type": "missing_entities",
    "entities": ["currency", "from_account"],
    "message": "I need to know the destination currency and which account to send from."
  }
}
```

## UC8: International IBAN Format Detection  
**Use Case**: "Send $800 to Hans" → `international.wire.send`  
**Expected**: RCP008 (Germany) resolved, IBAN format detected, currency missing

**Request:**
```json
POST /api/process
{
  "query": "Send $800 to Hans",
  "session_id": "session_123", 
  "ui_context": "transaction"
}
```

**Expected Response:**
```json
{
  "intent": "international.wire.send",
  "confidence": 0.85,
  "entities": {
    "amount": {"value": 800.0, "raw": "$800", "confidence": 0.98, "source": "extraction"},
    "recipient": {
      "value": "RCP008",
      "raw": "Hans", 
      "confidence": 0.86,
      "source": "enrichment",
      "enriched_entity": {
        "id": "RCP008",
        "name": "Hans Mueller",
        "account_number": "DE89370400440532013000",
        "bank_name": "Deutsche Bank AG",
        "alias": "Hans",
        "bank_country": "Germany",
        "routing_number": null,
        "swift_code": "DEUTDEFF",
        "bank_address": "60 Wall Street, New York, NY 10005"
      }
    }
  },
  "missing_fields": ["currency", "from_account"],
  "pending_clarification": {
    "type": "missing_entities",
    "entities": ["currency", "from_account"],
    "message": "I need to know the destination currency and which account to send from."
  }
}
```