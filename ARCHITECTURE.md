# EBP AI Banking - System Architecture

## 🏗️ **ARCHITECTURAL OVERVIEW**

The EBP (Enterprise Banking Platform) AI system transforms natural language banking conversations into deterministic, auditable banking operations while maintaining regulatory compliance and user control.

### **Core Principle: The Certainty Gradient**

```
Natural Language → Probabilistic Understanding → Deterministic Action
     ↓                    ↓                         ↓
  (Ambiguous)         (Confidence %)            (Executed)
```

The system bridges the gap between probabilistic AI understanding and the deterministic requirements of financial services.

---

## 🧠 **CONCEPTUAL FOUNDATIONS**

### **1. Intent Classification**
**What it is**: The system's ability to understand what a user wants to do from natural language.

**How it works**: 
- **Probabilistic Layer**: AI analyzes user queries and assigns confidence scores (0.0-1.0)
- **Pattern Matching**: Fallback rules ensure reliability when AI confidence is low
- **Risk Assessment**: Each intent has an associated risk level (LOW → CRITICAL)

**Why it matters**: Banks need to understand customer intent reliably before executing financial operations.

```python
# Example: "What's my balance?" → 
{
  "intent_id": "accounts.balance.check",
  "confidence": 0.89,
  "risk_level": "LOW"
}
```

### **2. Confidence Scoring**
**What it is**: A numerical measure (0.0-1.0) of how certain the system is about understanding user intent.

**Decision Thresholds**:
- **> 0.85**: Execute with confirmation
- **0.6-0.85**: Disambiguate choices  
- **< 0.6**: Request clarification

**The 4 States of Certainty**:
1. **UNCERTAIN**: "I think you want..." (< 0.6)
2. **PROBABLE**: "Did you mean..." (0.6-0.85)
3. **CONFIDENT**: "I'll do this..." (> 0.85)
4. **EXECUTED**: "Done." (Action completed)

**Why it matters**: Financial operations require high certainty. Low confidence triggers human intervention.

### **3. Entity Extraction**
**What it is**: Identifying specific pieces of information needed to complete banking operations.

**Types**:
- **Required Entities**: Must have to proceed (e.g., amount for transfers)
- **Optional Entities**: Enhance if present (e.g., memo for payments)
- **Inferred Entities**: Derived from context (e.g., "checking" as default account)

**Example**:
```
Query: "Send $500 to John from my savings"
Entities: {
  "amount": 500,
  "recipient": "John", 
  "from_account": "savings"
}
```

### **4. Conversation Memory & Context**
**What it is**: The system's ability to remember previous interactions and resolve references.

**Context Types**:
- **Session Context**: Current conversation state
- **Customer Context**: Long-term user preferences and history
- **Reference Resolution**: Understanding "it", "there", "same amount", etc.

**Why it's crucial**: Natural conversations reference previous statements. "Transfer it there again" must be understood.

**Resolution Rules**:
- "him/her" → last_recipient
- "same amount" → last_amount  
- "there" → last_account
- "again" → repeat last_action

---

## 📁 **SYSTEM CATALOGS**

### **1. Intent Catalog (34 Banking Intents)**
**Purpose**: Defines all possible banking operations the system can understand.

**Structure**:
```python
BankingIntent(
    intent_id="accounts.balance.check",
    name="Check Account Balance",
    category=IntentCategory.ACCOUNT_MANAGEMENT,
    risk_level=RiskLevel.LOW,
    auth_required=AuthLevel.BASIC,
    required_entities=["account_type"],
    keywords=["balance", "how much", "available funds"]
)
```

**Categories**:
- Account Management (9 intents)
- Payments & Transfers (8 intents) 
- Card Services (6 intents)
- Support & Inquiries (7 intents)
- System Navigation (4 intents)

### **2. Banking Operations Catalog**
**Purpose**: Maps intents to concrete banking operations with business rules.

**Structure**:
```python
BankingOperation(
    operation_id="check_balance",
    name="Check Account Balance",
    type=OperationType.READ_ONLY,
    required_entities=["account_type"],
    business_rules=["account_must_exist", "user_must_own_account"],
    risk_level=RiskLevel.LOW,
    execution_handler=_execute_balance_check
)
```

**Operation Types**:
- **READ_ONLY**: View information (low risk)
- **TRANSACTIONAL**: Move money (medium-high risk)
- **ADMINISTRATIVE**: Account management (medium-high risk)
- **NAVIGATIONAL**: UI guidance (low risk)

### **3. UI Screen Catalog** *(Phase 2 - In Development)*
**Purpose**: Maps banking operations to pre-built UI screens for navigation assistance.

**Navigation Assistance**: Routes users to existing banking interfaces based on intent detection.

**Navigation Example**:
```
Customer: "Take me to international transfers"
AI Analysis: Intent = navigation.screen.transfers.international
System Action: Routes to existing wire transfer screen (/banking/transfers/international)
Result: User lands on pre-built international transfer interface
```

**Transaction Assistance**: Dynamically builds custom UI based on specific user intent.

**Transaction Example**:
```
Customer: "Send $500 to my friend in Canada"  
AI Analysis: Intent = payments.transfer.international + entities
System Action: Builds custom form with 4 relevant fields
Result: Streamlined interface specific to this transaction type
```

**Concept**:
```python
UIScreen(
    screen_id="transfer_screen",
    name="Money Transfer",
    related_intents=["payments.transfer.internal", "payments.transfer.external"],
    navigation_path="/transfers",
    help_content="Guide users through transfer process",
    customer_language=["send money", "pay someone", "transfer funds"],
    bank_terminology=["Wire Transfer", "ACH", "International Remittance"]
)
```

**Navigation vs Transaction Assistance**:
- **Navigation**: "Take me to transfers" → Routes to existing /banking/transfers screen
- **Transaction**: "Send $500 to Canada" → Builds custom form specific to this transaction
- **Shared Architecture**: Both use the same intent classification and entity extraction system

### **Transaction Assistance: Dynamic Form Assembly**

**The Core Concept**: Instead of navigating to pre-built screens, the system dynamically constructs the perfect interface for each specific transaction.

```python
# Navigation Assistance: Routes to existing screen
Customer: "Take me to wire transfers"
→ Routes to: /banking/transfers/wire (pre-built 57-field form)

# Transaction Assistance: Builds custom interface  
Customer: "Send $500 to my friend in Canada"
→ Builds: Custom 4-field form specific to this transaction
```

**Dynamic Form Assembly**:
```python
# Traditional approach: One-size-fits-all form
WireTransferForm(
    fields=["recipient_name", "bank_name", "swift_code", "iban", "routing", 
            "account_number", "purpose_code", "correspondent_bank", ...]
)

# Transaction Assistance: Intent-driven form assembly
User: "Send $500 to my friend in Canada"
System assembles: ["recipient_name", "amount", "canadian_bank_details"]
System hides: ["swift_code", "correspondent_bank", "purpose_codes"]
System pre-fills: ["your_account", "currency_conversion_info"]
```

**Form Intelligence**:
- **Context-Aware Fields**: Only show what's needed for this specific transaction
- **Smart Defaults**: Pre-fill based on previous transactions and preferences  
- **Progressive Disclosure**: "Need to add intermediary bank details? Click here"
- **Validation Intelligence**: "This looks like a Canadian routing number, should be 9 digits"
- **Help When Needed**: "Can't find SWIFT code? I'll look it up for you"

**Real-World Example**:
```
Traditional Form: [57 fields, user overwhelmed]
├── Recipient Name: _______________
├── Recipient Address Line 1: _______________  
├── Recipient Address Line 2: _______________
├── Bank Name: _______________
├── Bank Address: _______________
├── SWIFT/BIC Code: _______________
├── IBAN: _______________
├── Account Number: _______________
├── Routing Number: _______________
├── Correspondent Bank: _______________
├── Purpose Code: [dropdown with 127 options]
└── ... 46 more fields

Smart Form: "Send $500 to friend in Canada"
├── ✓ Amount: $500 (detected from intent)
├── Friend's Name: _______________
├── Their Bank: [Canadian banks dropdown]
├── Account Number: _______________
└── That's it! (System handles routing, currency, compliance)
```

### **Dynamic Form Assembly: Probabilistic → Deterministic → Auditable**

**🎯 Probabilistic Layer (AI Understanding)**:
```python
User Input: "Send $500 to my friend in Canada"
AI Analysis:
├── Intent: payments.transfer.international (confidence: 0.94)
├── Amount: $500 (confidence: 0.98)
├── Recipient Type: "friend" = personal (confidence: 0.89)
├── Destination: Canada = international (confidence: 0.99)
└── Form Type Needed: international_personal_transfer
```

**⚖️ Deterministic Layer (Business Rules)**:
```python
Form Assembly Rules:
if (intent == "international_transfer" AND destination == "Canada"):
    required_fields = ["recipient_name", "amount", "canadian_bank_details"]
    hide_fields = ["swift_code", "correspondent_bank", "purpose_codes"]
    pre_populate = ["source_account", "currency_conversion"]
    validation_rules = ["canadian_routing_format", "amount_limits"]
    
if (recipient_type == "personal" AND amount < 10000):
    compliance_level = "standard"
    skip_fields = ["business_registration", "tax_codes"]
```

**📋 Auditable Layer (Transaction Record)**:
```python
Form_Generation_Audit = {
    "user_input": "Send $500 to my friend in Canada",
    "ai_analysis": {
        "intent_confidence": 0.94,
        "form_type_selected": "international_personal_transfer",
        "fields_shown": ["recipient_name", "amount", "bank_details"],
        "fields_hidden": ["swift_code", "correspondent_bank"],
        "business_rules_applied": ["canadian_transfer_rules", "personal_recipient_rules"]
    },
    "form_configuration": {
        "total_possible_fields": 57,
        "fields_displayed": 4,
        "complexity_reduction": "93%",
        "user_action_required": "minimal"
    },
    "compliance_trail": "All required fields captured, business rules enforced"
}
```

**Why This Matters for Banks**:
- **🤖 AI Innovation**: Natural language creates perfect forms
- **⚖️ Bank Control**: Deterministic rules ensure compliance
- **📊 Regulator Transparency**: Complete audit trail of decisions
- **👤 Customer Experience**: 93% complexity reduction

**Benefits**:
- **Natural Language Access**: "Pay my rent" → Direct to bill pay setup
- **Context-Aware Routing**: Knows if you've done this before, suggests shortcuts
- **Progressive Disclosure**: Shows only relevant options based on your situation
- **Dynamic Form Generation**: Assembles perfect form for each specific intent
- **Intelligent Field Management**: Hides complexity, surfaces relevance
- **Cross-Channel Consistency**: Same logic works on web, mobile, voice
- **Reduced Support Calls**: Self-service with intelligent guidance

---

## 🔄 **THE PROCESSING PIPELINE**

### **Pipeline Flow**
```
1. Natural Language Input
   ↓
2. Intent Classification (Probabilistic)
   ↓  
3. Entity Extraction (Probabilistic)
   ↓
4. Confidence Evaluation (Deterministic Rules)
   ↓
5. Business Rule Validation (Deterministic)
   ↓
6. Banking Operation Execution (Deterministic)
   ↓
7. Audit Logging (Deterministic)
```

### **Layer-by-Layer Example: "Transfer $500 to my mom"**

Let's trace this query through each layer to see exactly what happens:

#### **Layer 1: Language Understanding (Probabilistic)**
**Input**: "Transfer $500 to my mom"

**Intent Classification**:
- AI analyzes: "transfer" = payment intent
- Confidence: 0.92 (high confidence)
- Result: `payments.transfer.external`

**Entity Extraction**:
- AI identifies: "$500" = amount
- AI identifies: "my mom" = recipient
- Missing: from_account (needs clarification)
- Result: `{amount: 500, recipient: "my mom", from_account: null}`

#### **Layer 2: Business Logic (Deterministic Rules)**
**Confidence Evaluation**:
```python
if confidence >= 0.85:  # 0.92 > 0.85
    proceed_to_validation()
else:
    request_clarification()
```

**Business Rule Validation**:
```python
# Rule 1: Amount validation
if amount > 10000:  # $500 < $10,000 ✓
    require_additional_auth()

# Rule 2: Recipient validation  
if recipient not in known_recipients:
    resolve_recipient("my mom")  # → "Sarah Johnson"

# Rule 3: Account validation
if from_account is None:
    default_to_primary_account()  # → "checking"

# Rule 4: Balance check
if checking_balance < amount:  # $2,150 > $500 ✓
    reject_insufficient_funds()
```

#### **Layer 3: Execution (Deterministic)**
**Banking Operation**:
```python
transfer_result = banking_service.send_payment(
    recipient="Sarah Johnson",
    amount=500.00,
    from_account="checking"
)
# Result: {"success": True, "transaction_id": "TXN-123456"}
```

**Audit Logging**:
```python
audit_log = {
    "user_input": "Transfer $500 to my mom",
    "intent_confidence": 0.92,
    "business_rules_applied": ["amount_check", "recipient_resolution", "balance_validation"],
    "transaction_id": "TXN-123456",
    "timestamp": "2025-01-15T10:30:00Z"
}
```

### **Probabilistic vs Deterministic Components**

**Probabilistic (AI-Powered)**:
- Intent classification from natural language
- Entity extraction from unstructured text
- Context understanding and reference resolution
- Conversation flow management

**Deterministic (Rule-Based)**:
- Confidence threshold enforcement
- Business rule validation
- Authentication and authorization
- Banking operation execution
- Audit trail generation
- Risk assessment enforcement

### **Why This Hybrid Approach?**

#### **Alternative Architecture Comparison**

**❌ Fully Deterministic Approach (Traditional Banking)**
```
User Input → Rule Parsing → Fixed Logic → Execution
```
**Problems**:
- "Send $500 to mom" → ERROR: "mom" not recognized
- "Transfer five hundred dollars" → ERROR: amount format invalid
- "Pay my rent" → ERROR: payee "rent" not found
- **Result**: Frustrated users, high support costs

**❌ Fully Probabilistic Approach (Pure AI)**
```
User Input → AI Decision → AI Execution → AI Logging
```
**Problems**:
- AI might interpret "$500" as "$5000" (hallucination)
- No consistent business rules enforcement
- Unpredictable behavior: same query, different results
- **Result**: Regulatory nightmare, potential fraud

**✅ Hybrid Approach (Our Architecture)**
```
User Input → AI Understanding → Rule Validation → Deterministic Execution
```
**Benefits**:
- "Send $500 to mom" → AI resolves "mom" → Rules validate → Execute
- Consistent business logic across all transactions
- Explainable decisions for regulators
- **Result**: Natural UX + Banking reliability

#### **Real-World Failure Scenarios**

**What Happens When Layers Get It Wrong?**

**Scenario 1: AI Misunderstands Intent**
```
User: "Show me my balance"
AI: Interprets as "transfer.internal" (wrong!)
Confidence: 0.95 (high but wrong)
```
**Our Protection**: Business rules catch this because no amount/recipient entities were extracted for a transfer.

**Scenario 2: AI Extracts Wrong Amount**
```
User: "Transfer $50 to John"  
AI: Extracts amount as $500 (10x error)
```
**Our Protection**: Confirmation step shows "$500 to John - Confirm?" allowing user to catch the error.

**Scenario 3: Business Rules Fail**
```
User: "Transfer $50,000 to unknown recipient"
AI: Correctly classifies intent and extracts entities
Business Rules: Somehow miss the risk level
```
**Our Protection**: Multiple validation layers + audit trail allows investigation and system improvement.

**For Banks**:
- **Regulatory Compliance**: Deterministic components ensure auditability
- **Risk Management**: Clear rules for high-risk operations
- **Explainability**: Every decision can be traced and explained
- **Gradual Rollout**: Can adjust AI confidence thresholds based on performance

**For Customers**:
- **Natural Interaction**: AI handles language understanding
- **Predictable Behavior**: Clear rules for when actions execute
- **Trust**: Transparent decision-making process
- **Error Recovery**: Clear feedback when system needs clarification

---

## 🛡️ **SECURITY & RISK MANAGEMENT**

### **Risk-Adaptive Authentication**
```
Operation Risk → Authentication Level → User Action Required
     LOW      →      BASIC           →     View only
    MEDIUM    →      FULL            →     Password  
     HIGH     →    CHALLENGE         →     MFA + Confirm
   CRITICAL   →    MULTI-STEP        →     MFA + Wait + Confirm
```

### **Audit Trail Components**
- **User Input**: Original natural language query
- **AI Decision**: Intent classification with confidence scores
- **System Decision**: Business rules applied and results
- **Action Taken**: Executed operation with reference ID
- **Compliance Record**: Complete audit chain for regulators

**The Audit Triangle**:
```
User Input → System Decision → Action Taken
     ↓             ↓                ↓
  Recorded    Confidence Log    Transaction ID
```

**Compliance Rules**:
- Minimum confidence for financial operations: 0.85
- Maximum automation for amounts > $10,000: NONE
- Required human confirmation for: Account closure, Large transfers, New payees

---

## 🤖 **AI INTEGRATION STRATEGIES**

### **Model Context Protocol (MCP) Server**
**Purpose**: Enables AI assistants (like Claude Desktop) to interact with banking systems.

**Architecture**:
```
Claude Desktop ←→ MCP Server ←→ Banking Pipeline ←→ Mock Banking Service
```

**Tools Provided**:
1. `check_account_balance` - Account information retrieval
2. `transfer_money` - Internal and external transfers  
3. `pay_bill` - Bill payment processing
4. `get_transaction_history` - Transaction queries
5. `block_card` - Card management
6. `dispute_transaction` - Dispute handling
7. `schedule_payment` - Recurring payments
8. `navigate_to_section` - UI guidance

### **Benefits for Banks Using AI**

**Controlled AI Deployment**:
- AI handles language understanding only
- Banks control all business logic and execution
- Clear boundaries between AI and deterministic systems

**Regulatory Compliance**:
- Complete audit trails for all AI decisions
- Explainable AI with confidence scores
- Human oversight at appropriate confidence thresholds

**Scalability & Maintenance**:
- Modular architecture allows AI model updates
- Business rules remain stable and testable
- Clear separation of concerns

---

## 🏛️ **BANKING-SPECIFIC CONSIDERATIONS**

### **Multi-Turn Conversation Handling**
Banks need to handle complex, multi-step processes:
```
User: "I want to pay my rent"
System: "How much is your rent?"
User: "$1500" 
System: "Which account should I use?"
User: "Checking"
System: "I'll pay $1500 rent from checking. Confirm?"
```

**The 5 Conversation Patterns**:
1. **Single-turn completion** - "What's my balance?" → Answer
2. **Clarification request** - "Transfer money" → "How much?"
3. **Disambiguation choice** - "Pay John" → "Which John?"
4. **Progressive collection** - Gather missing entities step by step
5. **Confirmation & execute** - "Transfer $500 to John from checking. Confirm?"

### **Context Preservation**
Banking conversations often reference previous actions:
- "Transfer the same amount to Sarah"
- "Block that card I mentioned earlier"
- "Add him as a payee too"

### **Error Recovery & Fallback**
Financial services require robust error handling:
- Network failures during transactions
- LLM timeouts or unavailability  
- Invalid entity combinations
- Business rule violations

---

## 🔧 **TECHNICAL IMPLEMENTATION**

### **Technology Stack**
- **Backend**: Python FastAPI with async/await
- **AI/ML**: LLM integration with fallback to pattern matching
- **Frontend**: React + TypeScript + Mantine UI
- **Testing**: Pytest + Playwright for E2E scenarios
- **Integration**: MCP server for AI assistant connectivity

### **Key Design Patterns**

**Catalog Pattern**: 
- Intent Catalog, Operations Catalog, UI Catalog
- Enables data-driven configuration
- Supports A/B testing and gradual rollouts

**Pipeline Pattern**:
- Clear separation of processing stages
- Easy to test and debug individual components
- Enables monitoring and observability

**State Machine Pattern**:
- Conversation state management
- Multi-turn flow handling
- Context preservation

---

## 📊 **SYSTEM METRICS & MONITORING**

### **AI Performance Metrics**
- Intent classification accuracy
- Entity extraction precision/recall
- Confidence score calibration
- Conversation completion rates

### **Business Metrics**
- Customer satisfaction scores
- Task completion rates
- Error and escalation rates
- Time to resolution

### **Technical Metrics**
- API response times
- System availability
- Cache hit rates
- Database performance

---

## 🚀 **DEPLOYMENT & SCALING**

### **Current State: MVP Prototype**
- Single-tenant deployment
- Mock banking services
- File-based configuration
- In-memory caching

### **Production Readiness Requirements**
- Multi-tenant architecture
- Real banking API integration
- Distributed caching (Redis)
- Database persistence (PostgreSQL)
- Security hardening
- Performance optimization

### **Enterprise Scaling**
- Microservices architecture
- Container orchestration (Kubernetes)
- Event-driven messaging
- Real-time monitoring and alerting
- Disaster recovery planning

---

## 🎯 **BUSINESS VALUE PROPOSITION**

### **For Banks**
- **Reduced Operational Costs**: Automate routine customer inquiries
- **Improved Customer Experience**: Natural language interface
- **Risk Management**: Controlled AI deployment with deterministic safeguards
- **Regulatory Compliance**: Complete audit trails and explainable decisions
- **Competitive Advantage**: Modern AI capabilities within existing infrastructure

### **For Customers**  
- **Natural Interaction**: Speak naturally instead of navigating complex menus
- **24/7 Availability**: AI-powered assistance outside business hours
- **Contextual Help**: Smart guidance through banking processes
- **Consistent Experience**: Same interface across channels (web, mobile, voice)

### **For Regulators**
- **Complete Auditability**: Every AI decision is logged and explainable
- **Risk Transparency**: Clear risk levels and authentication requirements
- **Compliance Monitoring**: Built-in reporting and oversight capabilities

---

---

## 🔮 **KEY ARCHITECTURAL PRINCIPLES**

### **The Essential Formula**
```
Conversational Banking = 
    (Intent + Entities + Context) × Confidence
    ÷ Risk
    + Human Confirmation
    = Deterministic Action
```

### **The Banking Intent Formula**
```
Intent = Category + Action + Risk Level + Auth Requirement
```

### **The Simplicity Paradox**
**Complex Inside, Simple Outside**
- **User sees**: Natural conversation
- **System does**: 50+ validation checks  
- **Regulator sees**: Complete audit trail
- **Developer sees**: Modular components

### **Business Rule Validation in Practice**

**Entity Validation Cascade**:
1. **Format Check**: Is it valid?
2. **Business Rule**: Is it allowed?
3. **Risk Assessment**: Is it safe?

**Real Examples**:

**Format Check**:
```python
# Is "$500" a valid amount?
if not re.match(r'^\$?\d+(\.\d{2})?$', amount_str):
    return "Invalid amount format"

# Is "mom" a valid recipient reference?
if recipient in personal_references:  # ["mom", "dad", "wife", etc.]
    proceed_to_resolution()
```

**Business Rule Check**:
```python
# Daily transfer limits
if daily_transfers + amount > daily_limit:
    return "Daily transfer limit exceeded"

# Account ownership validation
if from_account not in user.owned_accounts:
    return "You don't own this account"

# Recipient verification for large amounts
if amount > 1000 and recipient not in verified_recipients:
    return "Recipient requires verification for amounts > $1000"
```

**Risk Assessment**:
```python
# Velocity checking
if transfer_count_last_hour > 5:
    risk_level = "HIGH"
    
# Pattern detection
if amount == previous_fraud_amount and recipient == previous_fraud_recipient:
    risk_level = "CRITICAL"
    
# Geographic validation
if user_location != usual_location and amount > 5000:
    risk_level = "HIGH"
```

**Why Each Layer Matters**:
- **Format Check**: Prevents system crashes from malformed data
- **Business Rule**: Enforces bank policies and legal requirements
- **Risk Assessment**: Protects against fraud and suspicious activity

---

*This architecture enables banks to leverage AI capabilities while maintaining the control, security, and compliance standards required in financial services.* 