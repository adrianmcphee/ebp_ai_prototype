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
