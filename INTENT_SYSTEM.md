# Banking Intent System

The EBP NLP system features a comprehensive banking intent catalog with 36 standard banking intents across 16 categories, designed to handle all common banking operations and customer requests.

## Intent Categories

The system supports the following banking domains:

- **Account Management** (6 intents) - Balance inquiries, statements, alerts, account lifecycle
- **Payments** (5 intents) - Bill payments, P2P transfers, payment scheduling and status
- **Transfers** (2 intents) - Internal and external money transfers
- **Cards** (5 intents) - Card management, blocking, replacement, PIN changes, limit increases
- **Lending** (3 intents) - Personal loans, mortgages, loan payments
- **Investments** (3 intents) - Portfolio viewing, stock trading
- **Disputes** (1 intent) - Transaction dispute initiation
- **Support** (1 intent) - Agent assistance requests
- **Security** (2 intents) - Password reset, 2FA setup
- **Authentication** (2 intents) - Login/logout operations
- **Profile** (1 intent) - Contact information updates
- **Onboarding** (1 intent) - New account opening
- **Business Banking** (1 intent) - Business account services
- **Cash Management** (1 intent) - Cash deposit scheduling
- **International** (1 intent) - International wire transfers
- **Inquiries** (1 intent) - Transaction search and history

## Intent Structure

Each banking intent includes:

```python
BankingIntent(
    intent_id="accounts.balance.check",
    name="Check Account Balance",
    category=IntentCategory.ACCOUNT_MANAGEMENT,
    subcategory="Balance Inquiry",
    description="View current account balance",
    confidence_threshold=0.95,
    risk_level=RiskLevel.LOW,
    auth_required=AuthLevel.BASIC,
    required_entities=["account_type"],
    optional_entities=["account_id", "currency"],
    example_utterances=[...],
    keywords=[...],
    patterns=[...],
    preconditions=["account_exists"],
    daily_limit=1000,
    timeout_ms=1000,
)
```

### Intent Attributes

- **intent_id**: Unique identifier in dot notation (category.action.type)
- **name**: Human-readable intent name
- **category**: High-level banking domain
- **subcategory**: Specific functional area
- **confidence_threshold**: Minimum confidence for reliable classification
- **risk_level**: Security classification (LOW, MEDIUM, HIGH, CRITICAL)
- **auth_required**: Authentication level needed (NONE, BASIC, FULL, CHALLENGE)
- **required_entities**: Must be extracted for execution
- **optional_entities**: Enhance functionality when present
- **example_utterances**: Training examples for the intent
- **keywords**: Key terms that indicate this intent
- **patterns**: Regex patterns for pattern-based matching
- **preconditions**: Business rules that must be satisfied
- **daily_limit**: Maximum executions per day
- **timeout_ms**: Maximum processing time

## Classification Process

The system uses a hybrid approach for intent classification:

1. **LLM Classification**: Primary method using advanced language models for context-aware classification
2. **Pattern Matching**: Fallback using regex patterns and keyword matching
3. **Confidence Scoring**: Combines keyword matches (60%) and pattern matches (40%)

### Classification Pipeline

```python
from src.intent_classifier import IntentClassifier
from src.intent_catalog import intent_catalog

classifier = IntentClassifier(llm_client, cache)
result = await classifier.classify("What's my balance?")
```

Result structure:
```python
{
    "intent_id": "accounts.balance.check",
    "name": "Check Account Balance",
    "category": "Account Management",
    "subcategory": "Balance Inquiry",
    "confidence": 0.92,
    "risk_level": "low",
    "auth_required": "basic",
    "required_entities": ["account_type"],
    "optional_entities": ["account_id", "currency"],
    "preconditions": ["account_exists"],
    "alternatives": [...],
    "reasoning": "...",
    "response_time_ms": 145
}
```

## Risk Assessment

Intents are classified by risk level for security and compliance:

### Risk Levels

- **LOW**: Read-only operations (balance inquiries, transaction history)
- **MEDIUM**: Standard transactions (internal transfers, bill payments)
- **HIGH**: Sensitive operations (external transfers, card blocking, account changes)
- **CRITICAL**: High-impact operations (large transfers, account closure)

### Authentication Requirements

- **NONE**: Public information access
- **BASIC**: Standard login required
- **FULL**: Strong authentication needed
- **CHALLENGE**: Multi-factor authentication required

## Usage Examples

### Intent Matching
```python
from src.intent_catalog import intent_catalog

# Direct intent matching
result = intent_catalog.match_intent("Transfer $500 to savings")
# Returns: payments.transfer.internal

# Search for top matches
matches = intent_catalog.search_intents("buy stocks", top_k=3)
# Returns: [(intent_id, confidence), ...]
```

### Category Filtering
```python
from src.intent_catalog import IntentCategory

# Get all payment-related intents
payment_intents = intent_catalog.get_intents_by_category(IntentCategory.PAYMENTS)

# Get high-risk intents for security review
high_risk = intent_catalog.get_high_risk_intents()
```

### Intent Configuration
```python
# Get specific intent details
intent = intent_catalog.get_intent("cards.block.temporary")
print(f"Risk Level: {intent.risk_level}")
print(f"Required Entities: {intent.required_entities}")
```

## Integration Points

### Pipeline Integration
The intent system integrates with the main NLP pipeline:

```python
from src.pipeline import IntentPipeline

pipeline = IntentPipeline(classifier, extractor, validator, state_manager, banking_service)
result = await pipeline.process("I want to check my balance", session_id)
```

### API Integration
Intent classification is exposed via REST API:

```bash
POST /api/process
{
    "query": "Transfer money to my savings account",
    "session_id": "user123"
}
```

## Performance Characteristics

- **Total Intents**: 36 comprehensive banking intents
- **Categories**: 16 banking domains covered
- **Classification Speed**: ~100-200ms average response time
- **Fallback Coverage**: 100% coverage with pattern-based matching
- **Cache Hit Rate**: ~85% for repeated queries
- **Daily Limits**: Configurable per intent type

## Extensibility

The system is designed for easy extension:

### Adding New Intents
```python
new_intent = BankingIntent(
    intent_id="new.category.action",
    name="New Banking Action",
    category=IntentCategory.NEW_CATEGORY,
    # ... other attributes
)

# Add to catalog
BANKING_INTENTS["new.category.action"] = new_intent
```

### Custom Categories
```python
class IntentCategory(Enum):
    # Existing categories...
    NEW_CATEGORY = "New Banking Domain"
```

The intent catalog automatically updates all classification and routing logic when new intents are added. 