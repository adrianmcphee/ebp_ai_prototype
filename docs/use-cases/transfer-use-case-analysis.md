# Transfer Use Case Analysis

## Context: Supported Transfer Types

The system supports four types of money transfers and payments:

1. **Internal Transfer** (`payments.transfer.internal`) - Between accounts within the same bank (instant, low cost)
2. **External Transfer** (`payments.transfer.external`) - To external accounts at different banks within the same country (ACH/wire, 1-2 business days)
3. **P2P Payment** (`payments.p2p.send`) - Person-to-person payments using services like Zelle, Venmo (instant, medium cost)
4. **International Wire** (`international.wire.send`) - Between banks in different countries (SWIFT wire, 3-5 business days, high cost)

Each of the operation is defined by an intent in the backend/src/intent_catalog.py

### Key Differences

| Type | Speed | Daily Limit | Required Info | User Thinks |
|------|-------|-------------|---------------|-------------|
| **Internal** | Instant | 200 | Account name | "Move to my savings" |
| **P2P** | Instant | 100 | Phone/email | "Pay my friend" |
| **External** | 1-3 days | 20 | Account + routing | "Send to another bank" |
| **International** | 3-5 days | 10 | SWIFT + details | "Send money abroad" |

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
- **Status**: `clarification_needed` - missing required `from_account` entity

**User query**: "Move $500 from checking to business account"
**Expected result**:
- **Initial intents**: `payments.transfer.internal` (identified explicitly by specific account names)
- **Extracted entities**: 
  - `amount`: $500
  - `from_account`: "checking" (account name reference)
  - `to_account`: "business account" (account name reference)
- **Enriched entities**:
  - `from_account`: CHK001 (Primary Checking) - resolved from account name "checking" (Resolved from name first to two checking accounts, but as from_ and to_ accs can not be the same and one of them is chosen as `to_account` can be resolved to the unique account, hence - no assumptions)
  - `to_account`: CHK002 (Business Checking) - resolved from account name "business" (resolved from account name with high level of confidence)
- **Confirmed intent**: `payments.transfer.internal` (no change)
- **Status**: `success` - all required entities present

### External Transfer use cases
**User query**: "Send $2000 to Sarah at Wells Fargo"  
**Expected result**:
- **Initial intents**: [`payments.transfer.internal`, `payments.transfer.external`, `payments.p2p.send`] (multiple possible until recipient resolved)
- **Extracted entities**: 
  - `amount`: $2000
  - `recipient_name`: "Sarah"
- **Enriched entities**:
  - `recipient_name`: RCP004 (Sarah Johnson) - resolved from "Sarah" (match to recipient alias, which is also unique across the list)
  - `recipient_account`: 1234567890123 - obtained from resolved recipient
- **Confirmed intent**: `payments.transfer.external` ($2000 exceeds P2P daily limit of $100, external bank confirmed)
- **Status**: `success` - all required entities present after enrichment

**User query**: "Transfer $3000 to my mum"
**Expected result**:
- **Initial intents**: [`payments.transfer.internal`, `payments.p2p.send`] ("my" suggests internal, but could be P2P)
- **Extracted entities**: 
  - `amount`: $3000
  - `recipient`: "my mum" (recipient alias)
- **Enriched entities**:
  - `recipient`: RCP003 (Amy Winehouse) - resolved from alias "my mum" (alias of the recipient)
  - `recipient_account`: 4532891067834523 - obtained from resolved recipient
- **Confirmed intent**: `payments.transfer.external` ($3000 exceeds P2P limit of $100, different customer confirmed)
- **Status**: `success` - all required entities present after enrichment

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
- **Status**: `success` - all required entities present

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
- **Status**: `success` - all required entities present

### International Wire use cases
**User query**: "Send $1500 to Jack"
**Expected result**:
- **Initial intents**: [`payments.transfer.internal`, `payments.transfer.external`, `payments.p2p.send`] (generic "send" - multiple possibilities)
- **Extracted entities**: 
  - `amount`: $1500
  - `recipient`: "Jack"
- **Enriched entities**:
  - `recipient`: RCP007 (Jack White) - resolved from "Jack"
  - `recipient_account`: 123456789 - obtained from resolved recipient
  - `swift_code`: ROYCCAT2 - obtained from resolved recipient bank
- **Confirmed intent**: `international.wire.send` (after finding Jack at international bank, amount exceeds P2P limit)
- **Status**: `clarification_needed` - missing required `currency` entity

**User query**: "Send $800 to Hans"
**Expected result**:
- **Initial intents**: [`payments.transfer.internal`, `payments.transfer.external`, `payments.p2p.send`] (generic "send" - multiple possibilities)
- **Extracted entities**: 
  - `amount`: $800
  - `recipient`: "Hans"
- **Enriched entities**:
  - `recipient`: RCP008 (Hans Mueller) - resolved from "Hans"
  - `recipient_account`: DE89370400440532013000 - obtained from resolved recipient (IBAN format)
  - `swift_code`: DEUTDEFF - obtained from resolved recipient bank
- **Confirmed intent**: `international.wire.send` (after finding Hans at international bank, amount exceeds P2P limit)
- **Status**: `clarification_needed` - missing required `currency` entity


# How it should work?

1. **Intent Classification**: Initial classification, then refined after recipient resolution
   - "Transfer $100 to my savings account" → `payments.transfer.internal` (clear keywords, no recipient)
   - "Send $2000 to Sarah at Wells Fargo" → [`payments.transfer.external`, `payments.p2p.send`, `international.wire.send`] → `payments.transfer.external` (after resolving Sarah and p2p limits)  
   - "Zelle to my friend Mike" → `payments.p2p.send` (P2P service name + social context)
   - "Send $800 to Hans" → [`payments.transfer.external`, `payments.p2p.send`, `international.wire.send`] → `international.wire.send` (after resolving Hans)

2. **Entity Extraction**: Extract entities directly from user query
   - "Transfer $100 to my savings" → amount: 100.0, currency: "$", to_account: "my savings"
   - "Move $500 from checking to business account" → amount: 500.0, currency: "$", from_account: "checking", to_account: "business account"
   - "Send $2000 to Sarah" → amount: 2000.0, currency: "$", recipient: "Sarah"
   - "Pay Sarah $25 for coffee" → amount: 25.0, currency: "$", recipient: "Sarah", memo: "for coffee"
   - "Send $800 to Hans" → amount: 800.0, currency: "$", recipient: "Hans"
   - "Transfer $3000 to my mum" → amount: 3000.0, currency: "$", recipient: "my mum"

3. **Entity Enrichment**: Resolve extracted entities to actual data
   - "my savings" → SAV001 (Savings Account, $15,000 balance) + missing from_account triggers clarification
   - "checking" → CHK001 (Primary Checking), "business account" → CHK002 (Business Checking)  
   - "Sarah" → RCP004 (Sarah Johnson at Wells Fargo, routing: 121000248)
   - "Hans" → RCP008 (Hans Mueller at Deutsche Bank AG, SWIFT: DEUTDEFF)
   - "my mum" → RCP003 (Amy Winehouse at Mock Bank - external transfer due to different customer)

4. **Intent Refinement**: Update classification based on resolved recipient data
   - Sarah at Wells Fargo → Upgrade to `payments.transfer.external` 
   - Hans at Deutsche Bank → Upgrade to `international.wire.send`
   - Generic "send to [name]" becomes specific transfer type after resolution
