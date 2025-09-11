# Transfer Use Case Analysis

## Architecture Overview

This document defines the complete specification for implementing transfer capabilities in the EBP NLP Banking system. The implementation follows a **two-pass architecture**: initial intent classification followed by entity enrichment and intent refinement.

## System Context

### Assumptions
- User is authenticated as a client of Mock Bank (US-based)
- MockBankingService provides account and recipient data
- All transfers require explicit user confirmation before execution
- System operates in USD by default unless specified

### Supported Transfer Types

The system supports four types of money transfers, each with distinct characteristics and business rules:

| Intent ID | Type | Speed | Daily Limit | Per-Transaction Limit | Key Trigger |
|-----------|------|-------|-------------|----------------------|-------------|
| `payments.transfer.internal` | Internal Transfer | Instant | 200 txns | $100,000 | Same customer, different accounts |
| `payments.p2p.send` | P2P Payment | Instant | 100 txns | $1,000 | Social context, small amounts |
| `payments.transfer.external` | External Transfer | 1-3 days | 20 txns | $10,000 | Different bank, same country |
| `international.wire.send` | International Wire | 3-5 days | 10 txns | $100,000 | Different country |

### Decision Tree for Intent Selection

```
User Query → Initial Classification
    ↓
Contains "Zelle"/"Venmo" → payments.p2p.send
Contains "my" + account → payments.transfer.internal  
Generic "send"/"transfer" → Multiple candidates
    ↓
Entity Enrichment
    ↓
Recipient Country != US → international.wire.send
Amount > $1,000 → Eliminate payments.p2p.send
Same customer → payments.transfer.internal
Different bank → payments.transfer.external
```

## Processing Pipeline Architecture

### Two-Pass Processing Model

```python
# Pass 1: Initial Intent Classification + Entity Extraction
query → LLM Intent Classifier → Initial Intent + Confidence
     → LLM Entity Extractor → Raw Entities

# Pass 2: Enrichment + Refinement  
raw_entities + initial_intent → Entity Enricher → Enriched Entities
enriched_entities → Intent Refiner → Final Intent
```

### Key Architecture Decisions

1. **Intent Classification First**: Provides context for entity enrichment
2. **Enrichment Before Refinement**: Enriched data drives intent changes
3. **Deterministic Refinement**: Rule-based refinement for predictability
4. **Source Attribution**: Every enrichment tracks its data source
5. **Fail-Safe Design**: Missing enrichment doesn't break the flow

## Detailed Use Cases

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


## Processing Flow Specification

### Step 1: Intent Classification
Initial intent classification based on query patterns and keywords.

```python
# Intent confidence thresholds
CONFIDENCE_HIGH = 0.85  # Proceed with single intent
CONFIDENCE_MEDIUM = 0.60  # Present options to user
CONFIDENCE_LOW = 0.59  # Request clarification

# Examples
"Transfer $100 to my savings" → payments.transfer.internal (0.92)
"Zelle $50 to Mike" → payments.p2p.send (0.95)
"Send $2000 to Sarah" → [multiple candidates] (0.78)
```

### Step 2: Entity Extraction
Extract structured entities from the user query.

```python
# Entities to extract
- amount: Monetary value
- currency: Currency code (default: USD)
- from_account: Source account reference
- to_account: Destination account reference  
- recipient: Person/entity name
- memo: Transaction description

# Examples
"Transfer $100 to my savings" → {
    "amount": {"value": 100.0, "raw": "$100"},
    "to_account": {"value": "my savings", "raw": "my savings"}
}
```

### Step 3: Entity Enrichment
Resolve raw entities to actual database records.

```python
# Enrichment strategies
1. AccountResolutionStrategy: Maps account references to account IDs
2. RecipientResolutionStrategy: Maps recipient names to recipient records

# Resolution examples
"my savings" → SAV001 (unambiguous match)
"checking" → [CHK001, CHK002] (requires disambiguation)
"Sarah" → RCP004 (Sarah Johnson, Wells Fargo)
"Hans" → RCP008 (Hans Mueller, Deutsche Bank, Germany)
```

### Step 4: Intent Refinement
Apply business rules to refine intent based on enriched entities.

```python
# Refinement rules (in order of precedence)
1. If recipient.country != "US" → international.wire.send
2. If intent == "payments.p2p.send" AND amount > 1000 → payments.transfer.external  
3. If recipient.bank == "Mock Bank" AND different customer → payments.transfer.external
4. Keep initial intent if no rules apply

# Examples
"Send $2000 to Sarah" + Sarah@WellsFargo → payments.transfer.external (P2P limit exceeded)
"Send $800 to Hans" + Hans@Germany → international.wire.send (international recipient)
```

### Step 5: Disambiguation Resolution
Handle ambiguous entities through business logic.

```python
# Disambiguation strategies
1. Exclusion: If to_account identified, exclude it from from_account candidates
2. Context: Use transaction type to narrow options
3. User prompt: If still ambiguous, request clarification

# Example
"from checking to business" →
  to_account = CHK002 (business)
  from_account = CHK001 (only other checking account)
```

### Step 6: Response Generation
Determine final status and required user actions.

```python
# Status determination
if all_required_entities_present:
    if all_entities_unambiguous:
        status = "awaiting_user_confirmation"
    else:
        status = "awaiting_disambiguation"
else:
    status = "awaiting_user_input"
    
# Response includes
- Final intent
- Enriched entities
- Missing fields
- Disambiguation options (if any)
- Suggested form values
``` 

## Current System Analysis

### What Exists and Works
1. **Intent Catalog**: All transfer intents defined with proper risk levels
2. **MockBankingService**: Has `search_recipients()` and recipient data structure
3. **Entity Enricher**: Strategy pattern with auto-discovery implemented
4. **State Manager**: Disambiguation logic with fuzzy matching available
5. **Pipeline**: Two-pass architecture supports enrichment flow

### What's Missing
1. **RecipientResolutionStrategy**: Enrichment strategy for recipient lookup
2. **Intent Refinement**: Post-enrichment intent adjustment based on business rules
3. **Transfer Limits**: P2P $1,000 limit enforcement
4. **Banking Method Stubs**: `send_payment()`, `block_card()`, etc.
5. **Enhanced Entities**: Recipient-specific entity types in extractor

## Implementation Guide

### Phase 1: Minimal Working Implementation (2 Hours)

#### 1.1 Add MockBankingService Method Stubs
**File**: `backend/src/services/mock_banking.py`

```python
from datetime import datetime

class MockBankingService:
    # ... existing code ...
    
    async def send_payment(self, 
                          recipient_id: str, 
                          amount: float, 
                          from_account: str,
                          transfer_type: str = None) -> dict:
        """Execute a payment transfer."""
        # Validate inputs
        if recipient_id not in [r.id for r in self.recipients]:
            return {"success": False, "error": "Invalid recipient"}
        if from_account not in self.accounts:
            return {"success": False, "error": "Invalid account"}
            
        # Generate confirmation
        return {
            "success": True,
            "payment_id": f"PAY-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "transfer_type": transfer_type or "external",
            "estimated_completion": "instant" if transfer_type == "internal" else "1-3 days"
        }
    
    async def block_card(self, card_id: str, temporary: bool = True) -> dict:
        """Block a card."""
        return {
            "success": True,
            "card_id": card_id,
            "status": "temporarily_blocked" if temporary else "permanently_blocked",
            "timestamp": datetime.now().isoformat()
        }
```

#### 1.2 Create RecipientResolutionStrategy
**File**: `backend/src/services/entity_enricher.py`

```python
from typing import Dict, Any, List, Optional
from .enrichment_strategies import EnrichmentStrategy

class RecipientResolutionStrategy(EnrichmentStrategy):
    """Resolves recipient names to recipient records."""
    
    def __init__(self, banking_service):
        self.banking = banking_service
        
    def get_strategy_name(self) -> str:
        return "recipient_resolution"
        
    def can_enrich(self, entities: Dict[str, Any]) -> bool:
        return "recipient" in entities and "enriched_entity" not in entities.get("recipient", {})
        
    async def enrich(self, entities: Dict[str, Any]) -> Dict[str, Any]:
        recipient_data = entities["recipient"]
        query = self._extract_entity_value(recipient_data)
        
        # Search for recipient
        matches = await self.banking.search_recipients(query)
        
        if len(matches) == 1:
            # Single match - enrich with full data
            recipient_data["enriched_entity"] = matches[0]
            recipient_data["source"] = "enrichment"
            recipient_data["confidence"] = 0.95
            
            # Add transfer type for intent refinement
            recipient_data["transfer_type"] = self._determine_transfer_type(matches[0])
            
        elif len(matches) > 1:
            # Multiple matches - needs disambiguation
            recipient_data["disambiguation_required"] = True
            recipient_data["options"] = matches
            recipient_data["confidence"] = 0.60
            
        else:
            # No matches
            recipient_data["not_found"] = True
            recipient_data["confidence"] = 0.0
            
        return entities
    
    def _determine_transfer_type(self, recipient: dict) -> str:
        """Determine transfer type based on recipient data."""
        if recipient.get("bank_country") not in [None, "US"]:
            return "international"
        elif recipient.get("bank_name") == "Mock Bank":
            return "internal"  
        else:
            return "external"
```

#### 1.3 Add Intent Refinement Logic
**File**: `backend/src/services/intent_refiner.py` (NEW FILE)

```python
from typing import Dict, Any, Optional

class IntentRefiner:
    """Refines intent classification based on enriched entities."""
    
    # Transfer type limits
    P2P_LIMIT = 1000
    EXTERNAL_LIMIT = 10000
    INTERNATIONAL_LIMIT = 100000
    
    def refine_intent(self, 
                     initial_intent: str, 
                     entities: Dict[str, Any]) -> tuple[str, str]:
        """
        Refine intent based on business rules.
        Returns: (final_intent, refinement_reason)
        """
        
        # Extract key data
        amount = entities.get("amount", {}).get("value", 0)
        recipient = entities.get("recipient", {})
        transfer_type = recipient.get("transfer_type")
        
        # Rule 1: International recipient always becomes international wire
        if transfer_type == "international":
            if initial_intent != "international.wire.send":
                return "international.wire.send", "international_recipient"
                
        # Rule 2: Amount exceeds P2P limit
        if initial_intent == "payments.p2p.send" and amount > self.P2P_LIMIT:
            # Upgrade to external transfer
            return "payments.transfer.external", "p2p_limit_exceeded"
            
        # Rule 3: Internal bank but different customer
        if transfer_type == "internal" and recipient.get("enriched_entity"):
            recipient_data = recipient["enriched_entity"]
            # Check if it's actually a different customer at same bank
            if recipient_data.get("customer_id") != "current_user":
                return "payments.transfer.external", "different_customer_same_bank"
                
        # Rule 4: Explicit P2P keywords override amount limits for suggestions
        query_lower = entities.get("original_query", "").lower()
        if any(keyword in query_lower for keyword in ["zelle", "venmo", "cash app"]):
            if amount <= self.P2P_LIMIT:
                return "payments.p2p.send", "explicit_p2p_service"
                
        # No refinement needed
        return initial_intent, "no_refinement"
```

#### 1.4 Pipeline Integration
**File**: `backend/src/services/pipeline.py`

```python
# Add to existing pipeline.py
from .intent_refiner import IntentRefiner

class Pipeline:
    def __init__(self, ...):
        # ... existing init ...
        self.intent_refiner = IntentRefiner()
    
    async def process(self, query: str, session_id: str, ui_context: str = None):
        # ... existing code through entity enrichment ...
        
        # NEW: Intent refinement after enrichment
        if classification.get("intent_id"):
            original_intent = classification["intent_id"]
            final_intent, reason = self.intent_refiner.refine_intent(
                original_intent, 
                entities
            )
            
            if final_intent != original_intent:
                classification["intent_id"] = final_intent
                classification["refinement_applied"] = True
                classification["refinement_reason"] = reason
                
                # Log the refinement for debugging
                logger.info(f"Intent refined: {original_intent} → {final_intent} ({reason})")
        
        # ... continue with existing flow ...
```

#### 1.5 Update Intent Catalog
**File**: `backend/src/intent_catalog.py`

```python
# Add enrichment requirements to transfer intents
INTENT_CATALOG = {
    "payments.transfer.internal": BankingIntent(
        # ... existing fields ...
        enrichment_requirements=["account_resolution"],
    ),
    "payments.transfer.external": BankingIntent(
        # ... existing fields ...
        enrichment_requirements=["recipient_resolution", "account_resolution"],
    ),
    "payments.p2p.send": BankingIntent(
        # ... existing fields ...
        enrichment_requirements=["recipient_resolution"],
    ),
    "international.wire.send": BankingIntent(
        # ... existing fields ...
        enrichment_requirements=["recipient_resolution", "account_resolution"],
    ),
    # ... other intents ...
}
```

### Phase 2: Testing Strategy

#### 2.1 Unit Tests for Core Components
**File**: `backend/tests/test_transfer_implementation.py`

```python
import pytest
from src.services.intent_refiner import IntentRefiner
from src.services.entity_enricher import RecipientResolutionStrategy

class TestIntentRefiner:
    def test_p2p_limit_enforcement(self):
        refiner = IntentRefiner()
        entities = {
            "amount": {"value": 1500},
            "recipient": {"transfer_type": "external"}
        }
        
        final_intent, reason = refiner.refine_intent("payments.p2p.send", entities)
        assert final_intent == "payments.transfer.external"
        assert reason == "p2p_limit_exceeded"
    
    def test_international_recipient_upgrade(self):
        refiner = IntentRefiner()
        entities = {
            "amount": {"value": 800},
            "recipient": {"transfer_type": "international"}
        }
        
        final_intent, reason = refiner.refine_intent("payments.p2p.send", entities)
        assert final_intent == "international.wire.send"
        assert reason == "international_recipient"

class TestRecipientResolution:
    @pytest.mark.asyncio
    async def test_single_match_enrichment(self, mock_banking_service):
        strategy = RecipientResolutionStrategy(mock_banking_service)
        entities = {"recipient": {"value": "Sarah"}}
        
        enriched = await strategy.enrich(entities)
        
        assert "enriched_entity" in enriched["recipient"]
        assert enriched["recipient"]["confidence"] == 0.95
        assert enriched["recipient"]["transfer_type"] == "external"
```

#### 2.2 Integration Test for Full Pipeline
**File**: `backend/tests/test_transfer_pipeline.py`

```python
@pytest.mark.asyncio
async def test_transfer_with_intent_refinement(test_client):
    """Test: 'Send $2000 to Sarah' → P2P becomes External due to limit."""
    response = await test_client.post("/api/process", json={
        "query": "Send $2000 to Sarah at Wells Fargo",
        "session_id": "test_123",
        "ui_context": "transaction"
    })
    
    assert response.status_code == 200
    data = response.json()
    
    # Should refine from P2P to External
    assert data["intent"] == "payments.transfer.external"
    assert data.get("refinement_applied") == True
    assert data.get("refinement_reason") == "p2p_limit_exceeded"
    
    # Should have enriched recipient
    assert "recipient" in data["entities"]
    assert data["entities"]["recipient"]["enriched_entity"]["name"] == "Sarah Johnson"
```

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

## Implementation Checklist

### Immediate Actions (Phase 1 - 2 Hours)
- [ ] Add `send_payment()` and `block_card()` to MockBankingService
- [ ] Create `RecipientResolutionStrategy` class in entity_enricher.py
- [ ] Create new `intent_refiner.py` with IntentRefiner class
- [ ] Update Pipeline to call intent refinement after enrichment
- [ ] Add enrichment_requirements to transfer intents in intent_catalog.py
- [ ] Run existing tests to ensure no regression

### Testing & Validation (30 Minutes)
- [ ] Test UC1: Internal transfer with account resolution
- [ ] Test UC3: External transfer with P2P limit enforcement
- [ ] Test UC7: International wire detection
- [ ] Verify intent refinement logging works
- [ ] Check disambiguation flow for multiple recipients

### Future Enhancements (Phase 2)
- [ ] Add fuzzy matching for recipient names
- [ ] Implement vulnerable customer detection
- [ ] Add transaction velocity checks
- [ ] Create audit trail for all refinement decisions
- [ ] Add confidence score adjustments based on enrichment quality

### Architecture Notes
- Two-pass processing ensures clean separation of concerns
- Deterministic refinement rules provide predictable behavior
- Strategy pattern allows easy addition of new enrichment types
- All decisions are traceable through logging and source attribution
- System fails gracefully when enrichment is unavailable