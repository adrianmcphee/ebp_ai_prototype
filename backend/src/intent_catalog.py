"""Comprehensive Banking Intent Catalog
Unified intent system combining the best of both IntentConfig and BankingIntent approaches,
inspired by comprehensive banking domain knowledge.
"""

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class RiskLevel(Enum):
    """Risk levels for banking operations"""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AuthLevel(Enum):
    """Authentication requirements"""

    NONE = "none"
    BASIC = "basic"
    FULL = "full"
    CHALLENGE = "challenge"


class IntentCategory(Enum):
    """High-level intent categories"""

    ACCOUNT_MANAGEMENT = "Account Management"
    PAYMENTS = "Payments"
    TRANSFERS = "Transfers"
    CARDS = "Cards"
    LENDING = "Lending"
    INVESTMENTS = "Investments"
    SECURITY = "Security"
    SUPPORT = "Support"
    INQUIRIES = "Inquiries"
    DISPUTES = "Disputes"
    AUTHENTICATION = "Authentication"
    ONBOARDING = "Onboarding"
    PROFILE = "Profile"
    BUSINESS_BANKING = "Business Banking"
    FINANCIAL_PLANNING = "Financial Planning"
    TAX_COMPLIANCE = "Tax & Compliance"
    INTERNATIONAL = "International"
    CASH_MANAGEMENT = "Cash Management"
    UNKNOWN = "Unknown"


@dataclass
class BankingIntent:
    """Unified banking intent with comprehensive metadata"""

    intent_id: str
    name: str
    category: IntentCategory
    subcategory: str
    description: str
    confidence_threshold: float
    risk_level: RiskLevel
    auth_required: AuthLevel
    required_entities: list[str]
    optional_entities: list[str]
    example_utterances: list[str]
    keywords: list[str]
    patterns: list[str] = field(default_factory=list)
    preconditions: list[str] = field(default_factory=list)
    enrichment_requirements: list[str] = field(default_factory=list)
    daily_limit: Optional[int] = None
    timeout_ms: int = 5000
    max_retries: int = 3

    def __post_init__(self):
        """Compile regex patterns after initialization"""
        self.compiled_patterns = [
            re.compile(pattern, re.IGNORECASE) for pattern in self.patterns
        ]

    def matches_utterance(self, utterance: str) -> float:
        """Calculate confidence score for utterance matching this intent
        
        Uses additive scoring to combine pattern and keyword matches:
        - Exact example matches: Returns near-perfect score (0.99)
        - Pattern matches: Contribute 0-40% based on match ratio
        - Keyword matches: Contribute 0-60% based on specificity and coverage
        - Final score is multiplied by confidence threshold
        """
        utterance_lower = utterance.lower()
        
        # Check exact example matches first (highest priority)
        if self.example_utterances:
            for example in self.example_utterances:
                if example.lower() == utterance_lower:
                    return 0.99 * self.confidence_threshold  # Near perfect match
        
        # Initialize component scores
        pattern_contribution = 0.0
        keyword_contribution = 0.0
        
        # Check for pattern matches (40% weight)
        if self.compiled_patterns:
            pattern_matches = sum(1 for pattern in self.compiled_patterns if pattern.search(utterance_lower))
            pattern_ratio = pattern_matches / len(self.compiled_patterns)
            pattern_contribution = 0.4 * min(pattern_ratio, 1.0)
        
        # Check for keyword matches (60% weight)
        if self.keywords:
            keyword_scores = []
            for kw in self.keywords:
                kw_lower = kw.lower()
                if kw_lower in utterance_lower:
                    # Higher score for longer, more specific keywords
                    specificity_bonus = len(kw_lower.split()) * 0.2
                    # Higher score if keyword is a larger portion of the utterance
                    coverage = len(kw_lower) / len(utterance_lower)
                    keyword_scores.append(min(1.0, 0.5 + specificity_bonus + coverage))
            
            if keyword_scores:
                # Use best keyword match
                keyword_contribution = 0.6 * max(keyword_scores)
        
        # Combine contributions additively (patterns + keywords)
        # This ensures intents with both pattern AND keyword matches score higher
        combined_score = min(pattern_contribution + keyword_contribution, 1.0)
        
        return combined_score * self.confidence_threshold


# Comprehensive Banking Intent Catalog
BANKING_INTENTS = {
    # ============ ACCOUNT MANAGEMENT ============

    "accounts.balance.check": BankingIntent(
        intent_id="accounts.balance.check",
        name="Check Account Balance",
        category=IntentCategory.ACCOUNT_MANAGEMENT,
        subcategory="Balance Inquiry",
        description="View current account balance or navigate to accounts overview",
        confidence_threshold=0.92,
        risk_level=RiskLevel.LOW,
        auth_required=AuthLevel.NONE, # @FIXME: tmp fix for navigation while auth is not 100% implemented
        required_entities=["account_id"],
        optional_entities=["account_type", "account_name", "currency"],
        example_utterances=[
            "What's my balance?",
            "How much money do I have?",
            "Check my account",
            "Show me my balance",
            "What's in my checking account?",
            "Show me my accounts",
            "Take me to accounts",
            "Go to accounts page",
            "Account overview",
            "Show me account overview",
            "Navigate to accounts",
            "Take me to my savings account",
            "Show me my checking account",
            "Go to my savings account",
            "Navigate to my checking account",
            "Take me to my primary account",
        ],
        keywords=["balance", "how much money", "available funds", "account balance", "checking balance", "savings balance", "what's my balance", "show accounts", "my accounts", "accounts page", "account overview", "account dashboard", "take me to", "show me my", "go to my", "navigate to my", "my savings account", "my checking account", "my primary account"],
        patterns=[
            r"\b(what('s| is) my|check|show) .* balance\b",
            r"\bhow much .* (have|available|left)\b",
            r"\b(available|current) (funds|balance)\b",
            r"\b(show|go to|take me to|navigate to) .* accounts?\b",
            r"\b(show|go to|take me to|navigate to) my .* account\b",
            r"\baccount overview\b",
            r"\bshow me .* accounts?\b",
            r"\bshow me my .* account\b",
        ],
        preconditions=["account_exists"],
        enrichment_requirements=["account_resolution"],
        daily_limit=1000,
        timeout_ms=1000,
    ),

    "accounts.balance.history": BankingIntent(
        intent_id="accounts.balance.history",
        name="View Balance History",
        category=IntentCategory.ACCOUNT_MANAGEMENT,
        subcategory="Balance Inquiry",
        description="View historical balance trends",
        confidence_threshold=0.85,
        risk_level=RiskLevel.LOW,
        auth_required=AuthLevel.BASIC,
        required_entities=["account_id"],
        optional_entities=["date_range", "format"],
        example_utterances=[
            "Show balance history",
            "Balance trends",
            "Historical balances",
            "How has my balance changed?",
            "Balance over time",
        ],
        keywords=["balance", "history", "past", "historical", "trends", "over time"],
        patterns=[
            r"\bbalance .* (history|trends|over time)\b",
            r"\b(historical|past) .* balance\b",
            r"\bhow .* balance .* changed\b",
        ],
        preconditions=["account_exists"],
        daily_limit=100,
        timeout_ms=2000,
    ),

    "accounts.statement.download": BankingIntent(
        intent_id="accounts.statement.download",
        name="Download Statement",
        category=IntentCategory.ACCOUNT_MANAGEMENT,
        subcategory="Statements",
        description="Download account statements",
        confidence_threshold=0.9,
        risk_level=RiskLevel.LOW,
        auth_required=AuthLevel.FULL,
        required_entities=["account_id", "statement_period"],
        optional_entities=["format", "delivery_method"],
        example_utterances=[
            "Download my statement",
            "Get statement PDF",
            "Export statement",
            "I need my bank statement",
            "Send me last month's statement",
        ],
        keywords=["download", "statement", "pdf", "export", "document"],
        patterns=[
            r"\b(download|get|send|export) .* statement\b",
            r"\bstatement .* (pdf|download|email)\b",
            r"\b(monthly|quarterly|annual) statement\b",
        ],
        preconditions=["account_exists", "period_available"],
        daily_limit=50,
        timeout_ms=5000,
    ),

    "accounts.statement.view": BankingIntent(
        intent_id="accounts.statement.view",
        name="View Statement",
        category=IntentCategory.ACCOUNT_MANAGEMENT,
        subcategory="Statements",
        description="View online statements",
        confidence_threshold=0.9,
        risk_level=RiskLevel.LOW,
        auth_required=AuthLevel.BASIC,
        required_entities=["account_id"],
        optional_entities=["statement_period"],
        example_utterances=[
            "Show my statement",
            "View transactions",
            "Online statement",
            "See my account statement",
            "Display statement",
        ],
        keywords=["view", "show", "statement", "online", "transactions", "display"],
        patterns=[
            r"\b(view|show|display) .* statement\b",
            r"\bonline statement\b",
            r"\bsee .* (statement|transactions)\b",
        ],
        preconditions=["account_exists"],
        daily_limit=200,
        timeout_ms=3000,
    ),

    "accounts.alerts.setup": BankingIntent(
        intent_id="accounts.alerts.setup",
        name="Setup Account Alerts",
        category=IntentCategory.ACCOUNT_MANAGEMENT,
        subcategory="Notifications",
        description="Configure balance/transaction alerts",
        confidence_threshold=0.85,
        risk_level=RiskLevel.LOW,
        auth_required=AuthLevel.BASIC,
        required_entities=["alert_type"],
        optional_entities=["threshold", "delivery_method"],
        example_utterances=[
            "Setup alerts",
            "Configure notifications",
            "Balance alerts",
            "Set up account alerts",
            "Create transaction alerts",
        ],
        keywords=["setup", "alerts", "notifications", "configure", "balance", "transaction"],
        patterns=[
            r"\b(setup|set up|configure) .* (alerts|notifications)\b",
            r"\b(balance|transaction) alerts\b",
            r"\bcreate .* alerts\b",
        ],
        preconditions=["account_exists"],
        daily_limit=20,
        timeout_ms=3000,
    ),

    "accounts.close.request": BankingIntent(
        intent_id="accounts.close.request",
        name="Close Account Request",
        category=IntentCategory.ACCOUNT_MANAGEMENT,
        subcategory="Lifecycle",
        description="Request to close account",
        confidence_threshold=0.9,
        risk_level=RiskLevel.HIGH,
        auth_required=AuthLevel.FULL,
        required_entities=["account_id", "reason"],
        optional_entities=["transfer_destination"],
        example_utterances=[
            "Close my account",
            "Shut down account",
            "Cancel account",
            "I want to close this account",
            "Terminate my account",
        ],
        keywords=["close", "shut down", "cancel", "terminate", "account"],
        patterns=[
            r"\b(close|shut down|cancel|terminate) .* account\b",
            r"\bclose my account\b",
            r"\bdelete .* account\b",
        ],
        preconditions=["account_exists", "zero_balance", "no_pending_transactions"],
        daily_limit=5,
        timeout_ms=10000,
    ),

    # ============ PAYMENTS & TRANSFERS ============

    "payments.transfer.internal": BankingIntent(
        intent_id="payments.transfer.internal",
        name="Internal Transfer",
        category=IntentCategory.TRANSFERS,
        subcategory="Internal",
        description="Transfer between own accounts",
        confidence_threshold=0.95,
        risk_level=RiskLevel.MEDIUM,
        auth_required=AuthLevel.FULL,
        required_entities=["amount","from_account", "to_account"],
        optional_entities=["memo", "schedule_date"],
        example_utterances=[
            "Transfer money between my accounts",
            "Move funds to savings",
            "Transfer $500 from checking to savings",
            "Move money to my other account",
            "Internal transfer",
            "Take me to transfers",
            "Go to transfers page",
            "Show transfers",
            "Transfer hub",
            "Money transfers",
        ],
        keywords=["transfer", "move money", "between accounts", "move to savings", "move to checking", "internal transfer", "transfers", "transfer hub", "money transfers", "transfers page"],
        patterns=[
            r"\btransfer .* (to|from|between) .* account\b",
            r"\bmove .* (to|from) (savings|checking)\b",
            r"\b(internal|between) .* transfer\b",
            r"\b(take me to|go to|show) .* transfers?\b",
            r"\btransfer hub\b",
            r"\bmoney transfers?\b",
        ],
        preconditions=["balance_check", "accounts_active", "same_customer"],
        daily_limit=200,
        timeout_ms=4000,
    ),

    "payments.transfer.external": BankingIntent(
        intent_id="payments.transfer.external",
        name="External Transfer",
        category=IntentCategory.TRANSFERS,
        subcategory="External",
        description="Transfer to external account",
        confidence_threshold=0.9,
        risk_level=RiskLevel.HIGH,
        auth_required=AuthLevel.CHALLENGE,
        required_entities=["amount", "recipient_account", "recipient_name"],
        optional_entities=["routing_number", "bank_name", "memo", "wire_type"],
        example_utterances=[
            "Send money to another bank",
            "Wire transfer to external account",
            "Send $1000 to John at Chase",
            "Transfer to different bank",
            "External transfer",
        ],
        keywords=["external", "wire", "send", "another bank", "different bank", "transfer"],
        patterns=[
            r"\b(wire|send) .* to .* (bank|account)\b",
            r"\bexternal .* transfer\b",
            r"\btransfer .* (different|another) bank\b",
        ],
        preconditions=["balance_check", "limit_check", "fraud_check"],
        daily_limit=20,
        timeout_ms=15000,
        max_retries=1,
    ),

    "payments.p2p.send": BankingIntent(
        intent_id="payments.p2p.send",
        name="Send P2P Payment",
        category=IntentCategory.PAYMENTS,
        subcategory="P2P",
        description="Send person-to-person payment",
        confidence_threshold=0.9,
        risk_level=RiskLevel.MEDIUM,
        auth_required=AuthLevel.FULL,
        required_entities=["amount", "recipient"],
        optional_entities=["memo", "payment_method"],
        example_utterances=[
            "Send money to a friend",
            "Pay John $50",
            "Zelle $100 to Sarah",
            "Venmo Mike for dinner",
            "Send cash to mom",
        ],
        keywords=["send", "pay", "zelle", "venmo", "p2p", "friend", "person"],
        patterns=[
            r"\b(send|pay) .* to .* (friend|person|someone)\b",
            r"\b(zelle|venmo|paypal) .* to\b",
            r"\bp2p .* payment\b",
        ],
        preconditions=["balance_check", "recipient_enrolled"],
        daily_limit=100,
        timeout_ms=6000,
    ),

    "payments.bill.pay": BankingIntent(
        intent_id="payments.bill.pay",
        name="Pay Bill",
        category=IntentCategory.PAYMENTS,
        subcategory="Bill Pay",
        description="Make bill payment or navigate to bill pay hub",
        confidence_threshold=0.9,
        risk_level=RiskLevel.MEDIUM,
        auth_required=AuthLevel.FULL,
        required_entities=[],
        optional_entities=["payee", "amount", "account_id", "due_date", "memo"],
        example_utterances=[
            "Pay my bill",
            "Make payment",
            "Bill pay",
            "Pay electric bill",
            "Send payment to utility company",
            "Take me to bill pay",
            "Go to bill payments",
            "Show bill pay page",
            "Pay bills",
            "Bill payment hub",
        ],
        keywords=["pay", "bill", "payment", "payee", "utility", "electric", "water", "bill pay", "bill payments", "pay bills", "bill payment hub"],
        patterns=[
            r"\bpay .* bill\b",
            r"\bbill pay\b",
            r"\bmake .* payment\b",
            r"\bpay .* (electric|water|gas|utility)\b",
            r"\b(take me to|go to|show) .* bill pay\b",
            r"\bpay bills\b",
            r"\bbill payment\b",
        ],
        preconditions=["balance_check", "payee_exists"],
        daily_limit=100,
        timeout_ms=5000,
    ),

    # ============ CARDS ============
    "cards.block.temporary": BankingIntent(
        intent_id="cards.block.temporary",
        name="Block Card",
        category=IntentCategory.CARDS,
        subcategory="Security",
        description="Temporarily block card",
        confidence_threshold=0.9,
        risk_level=RiskLevel.HIGH,
        auth_required=AuthLevel.FULL,
        required_entities=["card_identifier"],
        optional_entities=["reason", "duration"],
        example_utterances=[
            "Block my card temporarily",
            "Freeze my debit card",
            "Temporarily disable my card",
            "Pause my credit card",
            "Lock my card for now",
        ],
        keywords=["block", "freeze", "lock", "disable", "temporary", "pause", "card"],
        patterns=[
            r"\b(block|freeze|lock|disable) .* card\b",
            r"\bcard .* (lost|stolen|missing)\b",
            r"\btemporarily .* (block|freeze) .* card\b",
        ],
        preconditions=["card_active"],
        daily_limit=50,
        timeout_ms=2000,
    ),

    "cards.replace.lost": BankingIntent(
        intent_id="cards.replace.lost",
        name="Replace Lost Card",
        category=IntentCategory.CARDS,
        subcategory="Replacement",
        description="Order replacement for lost card",
        confidence_threshold=0.9,
        risk_level=RiskLevel.HIGH,
        auth_required=AuthLevel.FULL,
        required_entities=["card_id"],
        optional_entities=["expedited", "delivery_address"],
        example_utterances=[
            "I lost my card",
            "Can't find my debit card",
            "My credit card is missing",
            "Need a replacement card",
            "Report lost card",
        ],
        keywords=["lost", "missing", "can't find", "replacement", "new card", "report"],
        patterns=[
            r"\b(lost|missing|can't find) .* card\b",
            r"\bneed .* (replacement|new) card\b",
            r"\breport .* lost card\b",
        ],
        preconditions=["card_exists", "eligible_for_replacement"],
        daily_limit=5,
        timeout_ms=6000,
    ),

    "cards.activate": BankingIntent(
        intent_id="cards.activate",
        name="Activate Card",
        category=IntentCategory.CARDS,
        subcategory="Activation",
        description="Activate new card",
        confidence_threshold=0.95,
        risk_level=RiskLevel.MEDIUM,
        auth_required=AuthLevel.FULL,
        required_entities=["card_number", "cvv"],
        optional_entities=["pin"],
        example_utterances=[
            "Activate my card",
            "Turn on new card",
            "Enable my debit card",
            "Activate new credit card",
            "Start using my card",
        ],
        keywords=["activate", "turn on", "enable", "start using", "new card"],
        patterns=[
            r"\bactivate .* card\b",
            r"\bturn on .* card\b",
            r"\benable .* (debit|credit) card\b",
        ],
        preconditions=["card_issued", "not_activated", "identity_verified"],
        daily_limit=10,
        timeout_ms=4000,
    ),

    # ============ DISPUTES ============
    "disputes.transaction.initiate": BankingIntent(
        intent_id="disputes.transaction.initiate",
        name="Dispute Transaction",
        category=IntentCategory.DISPUTES,
        subcategory="Transaction Disputes",
        description="Initiate transaction dispute",
        confidence_threshold=0.85,
        risk_level=RiskLevel.HIGH,
        auth_required=AuthLevel.FULL,
        required_entities=["transaction_id"],
        optional_entities=["reason", "amount", "merchant"],
        example_utterances=[
            "I want to dispute a charge",
            "Dispute this transaction",
            "This transaction is wrong",
            "Fraudulent charge on my account",
            "I didn't make this purchase",
            "Report unauthorized transaction",
        ],
        keywords=["dispute", "dispute transaction", "dispute charge", "wrong", "fraud", "unauthorized", "didn't make", "charge"],
        patterns=[
            r"\b(dispute|report) .* (transaction|charge|payment)\b",
            r"\b(fraudulent|unauthorized|wrong) .* charge\b",
            r"\bdidn't .* (make|authorize) .* (purchase|transaction)\b",
        ],
        preconditions=["within_dispute_window", "transaction_posted"],
        daily_limit=10,
        timeout_ms=10000,
    ),

    # ============ SUPPORT ============
    "support.agent.request": BankingIntent(
        intent_id="support.agent.request",
        name="Request Agent",
        category=IntentCategory.SUPPORT,
        subcategory="Agent Assistance",
        description="Request human agent assistance",
        confidence_threshold=0.9,
        risk_level=RiskLevel.LOW,
        auth_required=AuthLevel.BASIC,
        required_entities=[],
        optional_entities=["reason", "priority"],
        example_utterances=[
            "Talk to an agent",
            "I need human help",
            "Connect me to customer service",
            "Speak with representative",
            "Get me a real person",
        ],
        keywords=["agent", "human", "representative", "customer service", "talk", "speak"],
        patterns=[
            r"\b(talk|speak|connect) .* (agent|representative|human)\b",
            r"\b(need|want) .* (help|support|assistance)\b",
            r"\bcustomer .* service\b",
        ],
        preconditions=["hours_check"],
        daily_limit=100,
        timeout_ms=2000,
    ),

    # ============ INQUIRIES ============
    "inquiries.transaction.search": BankingIntent(
        intent_id="inquiries.transaction.search",
        name="Search Transactions",
        category=IntentCategory.INQUIRIES,
        subcategory="Transactions",
        description="Search transaction history",
        confidence_threshold=0.8,
        risk_level=RiskLevel.LOW,
        auth_required=AuthLevel.BASIC,
        required_entities=[],
        optional_entities=["date_range", "merchant", "amount_range", "category"],
        example_utterances=[
            "Show my transactions",
            "Recent purchases",
            "Transaction history",
            "What did I spend at Target?",
            "Find payments to John",
        ],
        keywords=["transaction", "history", "recent", "purchase", "spent", "activity", "payments"],
        patterns=[
            r"\b(show|view|see) .* transaction\b",
            r"\b(recent|last) .* (transactions|purchases|activity)\b",
            r"\bwhat .* (spent|purchased|bought)\b",
        ],
        preconditions=["account_exists"],
        daily_limit=500,
        timeout_ms=3000,
    ),

    # ============ LENDING ============
    "lending.apply.personal": BankingIntent(
        intent_id="lending.apply.personal",
        name="Apply Personal Loan",
        category=IntentCategory.LENDING,
        subcategory="Personal",
        description="Apply for personal loan",
        confidence_threshold=0.85,
        risk_level=RiskLevel.MEDIUM,
        auth_required=AuthLevel.FULL,
        required_entities=["loan_type", "amount", "term"],
        optional_entities=["purpose", "collateral"],
        example_utterances=[
            "Apply for a personal loan",
            "I need to borrow money",
            "Get a loan for $10000",
            "Personal loan application",
            "Want to take out a loan",
        ],
        keywords=["loan", "borrow", "personal loan", "apply", "application"],
        patterns=[
            r"\bapply .* (personal )?loan\b",
            r"\bneed .* (borrow|loan)\b",
            r"\b(get|take out) .* loan\b",
        ],
        preconditions=["credit_check", "income_verification"],
        daily_limit=2,
        timeout_ms=60000,
    ),

    # ============ INVESTMENTS ============
    "investments.portfolio.view": BankingIntent(
        intent_id="investments.portfolio.view",
        name="View Portfolio",
        category=IntentCategory.INVESTMENTS,
        subcategory="Portfolio",
        description="View investment portfolio",
        confidence_threshold=0.9,
        risk_level=RiskLevel.LOW,
        auth_required=AuthLevel.FULL,
        required_entities=[],
        optional_entities=["account_type", "time_period"],
        example_utterances=[
            "Show my portfolio",
            "How are my investments doing?",
            "Check my stocks",
            "Investment performance",
            "Portfolio balance",
        ],
        keywords=["portfolio", "investments", "stocks", "performance", "holdings"],
        patterns=[
            r"\b(show|view) .* portfolio\b",
            r"\bhow .* investments .* doing\b",
            r"\bcheck .* stocks\b",
        ],
        preconditions=["has_investment_account"],
        daily_limit=500,
        timeout_ms=3000,
    ),

    # ============ AUTHENTICATION ============
    "authentication.login": BankingIntent(
        intent_id="authentication.login",
        name="Login",
        category=IntentCategory.AUTHENTICATION,
        subcategory="Access",
        description="User login authentication",
        confidence_threshold=0.95,
        risk_level=RiskLevel.MEDIUM,
        auth_required=AuthLevel.NONE,
        required_entities=["username"],
        optional_entities=["password"],
        example_utterances=[
            "Log me in",
            "I want to login",
            "Sign in",
            "Access my account",
            "Authenticate me",
        ],
        keywords=["login", "log in", "sign in", "access", "authenticate"],
        patterns=[
            r"\b(log|sign) .* in\b",
            r"\blogin\b",
            r"\baccess .* account\b",
        ],
        preconditions=["valid_credentials"],
        daily_limit=50,
        timeout_ms=5000,
    ),

    "authentication.logout": BankingIntent(
        intent_id="authentication.logout",
        name="Logout",
        category=IntentCategory.AUTHENTICATION,
        subcategory="Access",
        description="User logout",
        confidence_threshold=0.95,
        risk_level=RiskLevel.LOW,
        auth_required=AuthLevel.BASIC,
        required_entities=[],
        optional_entities=[],
        example_utterances=[
            "Log me out",
            "Sign out",
            "Logout",
            "End session",
            "Exit",
        ],
        keywords=["logout", "log out", "sign out", "exit", "end session"],
        patterns=[
            r"\b(log|sign) .* out\b",
            r"\blogout\b",
            r"\bexit\b",
            r"\bend .* session\b",
        ],
        preconditions=["authenticated"],
        daily_limit=100,
        timeout_ms=1000,
    ),

    # ============ PROFILE MANAGEMENT ============
    "profile.update.contact": BankingIntent(
        intent_id="profile.update.contact",
        name="Update Contact Information",
        category=IntentCategory.PROFILE,
        subcategory="Contact",
        description="Update email, phone, or address",
        confidence_threshold=0.85,
        risk_level=RiskLevel.MEDIUM,
        auth_required=AuthLevel.FULL,
        required_entities=["contact_type"],
        optional_entities=["new_value"],
        example_utterances=[
            "Update my email",
            "Change my phone number",
            "Update address",
            "Change contact information",
            "Modify my profile",
        ],
        keywords=["update", "change", "modify", "email", "phone", "address", "contact"],
        patterns=[
            r"\b(update|change|modify) .* (email|phone|address|contact)\b",
            r"\bnew .* (email|phone|address)\b",
        ],
        preconditions=["identity_verified"],
        daily_limit=10,
        timeout_ms=5000,
    ),

    # ============ CARDS - EXPANDED ============
    "cards.pin.change": BankingIntent(
        intent_id="cards.pin.change",
        name="Change Card PIN",
        category=IntentCategory.CARDS,
        subcategory="PIN Management",
        description="Change card PIN number",
        confidence_threshold=0.9,
        risk_level=RiskLevel.HIGH,
        auth_required=AuthLevel.FULL,
        required_entities=["card_id", "new_pin"],
        optional_entities=["old_pin"],
        example_utterances=[
            "Change my PIN",
            "Update card PIN",
            "New PIN for my debit card",
            "Reset my PIN number",
            "Modify card PIN",
        ],
        keywords=["change", "update", "new", "reset", "modify", "PIN", "pin"],
        patterns=[
            r"\b(change|update|new|reset|modify) .* PIN\b",
            r"\bPIN .* (change|update|reset)\b",
        ],
        preconditions=["card_active", "pin_format_valid"],
        daily_limit=5,
        timeout_ms=3000,
    ),

    "cards.limit.increase": BankingIntent(
        intent_id="cards.limit.increase",
        name="Increase Card Limit",
        category=IntentCategory.CARDS,
        subcategory="Limits",
        description="Request credit limit increase",
        confidence_threshold=0.85,
        risk_level=RiskLevel.MEDIUM,
        auth_required=AuthLevel.FULL,
        required_entities=["card_id", "new_limit"],
        optional_entities=["reason"],
        example_utterances=[
            "Increase my credit limit",
            "Raise card limit",
            "Higher credit limit",
            "Increase spending limit",
            "Request limit increase",
        ],
        keywords=["increase", "raise", "higher", "credit limit", "spending limit", "limit"],
        patterns=[
            r"\b(increase|raise|higher) .* (credit |spending )?limit\b",
            r"\blimit .* (increase|raise)\b",
        ],
        preconditions=["within_allowed_range", "credit_check_pass"],
        daily_limit=10,
        timeout_ms=5000,
    ),

    # ============ PAYMENTS - EXPANDED ============
    "payments.bill.schedule": BankingIntent(
        intent_id="payments.bill.schedule",
        name="Schedule Bill Payment",
        category=IntentCategory.PAYMENTS,
        subcategory="Bill Pay",
        description="Schedule future bill payment",
        confidence_threshold=0.85,
        risk_level=RiskLevel.MEDIUM,
        auth_required=AuthLevel.FULL,
        required_entities=["payee", "amount", "due_date"],
        optional_entities=["account_id", "memo"],
        example_utterances=[
            "Schedule bill payment",
            "Pay later",
            "Future payment",
            "Schedule payment for next week",
            "Set up payment for the 15th",
        ],
        keywords=["schedule", "pay later", "future payment", "payment for", "set up payment"],
        patterns=[
            r"\bschedule .* payment\b",
            r"\bpay .* later\b",
            r"\bfuture payment\b",
            r"\bpayment for .* (date|week|month)\b",
        ],
        preconditions=["balance_check", "payee_exists"],
        daily_limit=50,
        timeout_ms=5000,
    ),

    "payments.recurring.setup": BankingIntent(
        intent_id="payments.recurring.setup",
        name="Setup Recurring Payment",
        category=IntentCategory.PAYMENTS,
        subcategory="Recurring",
        description="Setup recurring bill payment",
        confidence_threshold=0.85,
        risk_level=RiskLevel.MEDIUM,
        auth_required=AuthLevel.FULL,
        required_entities=["payee", "amount", "frequency"],
        optional_entities=["start_date", "end_date"],
        example_utterances=[
            "Setup autopay",
            "Recurring payment",
            "Monthly payment",
            "Automatic bill pay",
            "Set up recurring transfer",
        ],
        keywords=["autopay", "recurring", "monthly", "automatic", "recurring transfer"],
        patterns=[
            r"\b(setup|set up) .* (autopay|recurring|automatic)\b",
            r"\b(monthly|weekly|recurring) .* payment\b",
            r"\bautopay\b",
        ],
        preconditions=["balance_check", "payee_exists"],
        daily_limit=20,
        timeout_ms=5000,
    ),

    "payments.status.check": BankingIntent(
        intent_id="payments.status.check",
        name="Check Payment Status",
        category=IntentCategory.PAYMENTS,
        subcategory="Status",
        description="Check status of payment",
        confidence_threshold=0.9,
        risk_level=RiskLevel.LOW,
        auth_required=AuthLevel.BASIC,
        required_entities=["payment_id"],
        optional_entities=["date_range"],
        example_utterances=[
            "Payment status",
            "Is payment sent",
            "Check if paid",
            "Did my payment go through",
            "Status of transfer",
        ],
        keywords=["payment status", "is payment", "check if paid", "payment go through", "status"],
        patterns=[
            r"\bpayment status\b",
            r"\bis .* payment .* sent\b",
            r"\bcheck if .* paid\b",
            r"\bpayment .* go through\b",
        ],
        preconditions=["payment_exists"],
        daily_limit=200,
        timeout_ms=2000,
    ),

    # ============ LENDING - EXPANDED ============
    "lending.apply.mortgage": BankingIntent(
        intent_id="lending.apply.mortgage",
        name="Apply for Mortgage",
        category=IntentCategory.LENDING,
        subcategory="Mortgage",
        description="Apply for home mortgage loan",
        confidence_threshold=0.85,
        risk_level=RiskLevel.HIGH,
        auth_required=AuthLevel.FULL,
        required_entities=["loan_amount", "property_value", "down_payment"],
        optional_entities=["property_type", "employment_info"],
        example_utterances=[
            "Apply for mortgage",
            "Home loan application",
            "Mortgage loan",
            "Buy a house loan",
            "Mortgage application",
        ],
        keywords=["mortgage", "home loan", "house loan", "property loan", "mortgage application"],
        patterns=[
            r"\b(apply|application) .* mortgage\b",
            r"\bhome loan\b",
            r"\bmortgage .* (loan|application)\b",
            r"\bbuy .* house .* loan\b",
        ],
        preconditions=["credit_check", "income_verification", "property_appraisal"],
        daily_limit=2,
        timeout_ms=120000,
    ),

    "lending.payment.make": BankingIntent(
        intent_id="lending.payment.make",
        name="Make Loan Payment",
        category=IntentCategory.LENDING,
        subcategory="Payments",
        description="Make payment on existing loan",
        confidence_threshold=0.9,
        risk_level=RiskLevel.MEDIUM,
        auth_required=AuthLevel.FULL,
        required_entities=["loan_id", "amount"],
        optional_entities=["payment_type", "source_account"],
        example_utterances=[
            "Pay my loan",
            "Make loan payment",
            "Pay mortgage",
            "Loan payment",
            "Pay off loan",
        ],
        keywords=["pay loan", "loan payment", "pay mortgage", "pay off", "loan"],
        patterns=[
            r"\bpay .* (loan|mortgage)\b",
            r"\bloan payment\b",
            r"\bpay off .* loan\b",
            r"\bmake .* payment .* loan\b",
        ],
        preconditions=["loan_active", "payment_due"],
        daily_limit=50,
        timeout_ms=5000,
    ),

    # ============ INVESTMENTS - EXPANDED ============
    "investments.buy.stock": BankingIntent(
        intent_id="investments.buy.stock",
        name="Buy Stock",
        category=IntentCategory.INVESTMENTS,
        subcategory="Trading",
        description="Purchase stock shares",
        confidence_threshold=0.85,
        risk_level=RiskLevel.HIGH,
        auth_required=AuthLevel.FULL,
        required_entities=["symbol", "quantity", "order_type"],
        optional_entities=["limit_price", "source_account"],
        example_utterances=[
            "Buy stock",
            "Purchase shares",
            "Invest in AAPL",
            "Buy 10 shares of Tesla",
            "Stock purchase",
        ],
        keywords=["buy stock", "purchase shares", "invest in", "buy shares", "stock purchase"],
        patterns=[
            r"\bbuy .* stock\b",
            r"\bpurchase .* shares\b",
            r"\binvest in .* [A-Z]{1,5}\b",
            r"\bbuy .* shares .* of\b",
        ],
        preconditions=["market_open", "balance_check", "symbol_valid"],
        daily_limit=100,
        timeout_ms=8000,
    ),

    "investments.sell.stock": BankingIntent(
        intent_id="investments.sell.stock",
        name="Sell Stock",
        category=IntentCategory.INVESTMENTS,
        subcategory="Trading",
        description="Sell stock shares",
        confidence_threshold=0.85,
        risk_level=RiskLevel.HIGH,
        auth_required=AuthLevel.FULL,
        required_entities=["symbol", "quantity", "order_type"],
        optional_entities=["limit_price"],
        example_utterances=[
            "Sell stock",
            "Sell shares",
            "Sell my AAPL",
            "Sell 10 shares of Tesla",
            "Stock sale",
        ],
        keywords=["sell stock", "sell shares", "sell my", "stock sale", "liquidate"],
        patterns=[
            r"\bsell .* stock\b",
            r"\bsell .* shares\b",
            r"\bsell my .* [A-Z]{1,5}\b",
            r"\bsell .* shares .* of\b",
        ],
        preconditions=["position_check", "market_open", "symbol_valid"],
        daily_limit=100,
        timeout_ms=8000,
    ),

    # ============ SECURITY - EXPANDED ============
    "security.password.reset": BankingIntent(
        intent_id="security.password.reset",
        name="Reset Password",
        category=IntentCategory.SECURITY,
        subcategory="Password",
        description="Reset account password",
        confidence_threshold=0.9,
        risk_level=RiskLevel.HIGH,
        auth_required=AuthLevel.CHALLENGE,
        required_entities=["username", "new_password"],
        optional_entities=["security_questions", "otp"],
        example_utterances=[
            "Reset my password",
            "Change password",
            "Forgot my password",
            "New password",
            "Password reset",
        ],
        keywords=["reset password", "change password", "forgot password", "new password", "password"],
        patterns=[
            r"\b(reset|change|forgot) .* password\b",
            r"\bnew password\b",
            r"\bpassword .* (reset|change)\b",
        ],
        preconditions=["identity_verified", "password_complexity_met"],
        daily_limit=10,
        timeout_ms=5000,
    ),

    "security.2fa.setup": BankingIntent(
        intent_id="security.2fa.setup",
        name="Setup Two-Factor Authentication",
        category=IntentCategory.SECURITY,
        subcategory="2FA",
        description="Setup two-factor authentication",
        confidence_threshold=0.85,
        risk_level=RiskLevel.MEDIUM,
        auth_required=AuthLevel.FULL,
        required_entities=["2fa_method"],
        optional_entities=["phone_number", "email"],
        example_utterances=[
            "Setup 2FA",
            "Two-factor authentication",
            "Enable 2FA",
            "Setup two-factor",
            "Security verification",
        ],
        keywords=["2FA", "two-factor", "authentication", "security verification", "setup"],
        patterns=[
            r"\bsetup .* (2FA|two.?factor)\b",
            r"\b(enable|turn on) .* 2FA\b",
            r"\btwo.?factor .* authentication\b",
        ],
        preconditions=["authenticated", "valid_2fa_method"],
        daily_limit=5,
        timeout_ms=4000,
    ),

    # ============ ONBOARDING ============
    "onboarding.account.open": BankingIntent(
        intent_id="onboarding.account.open",
        name="Open New Account",
        category=IntentCategory.ONBOARDING,
        subcategory="Account Opening",
        description="Open a new bank account",
        confidence_threshold=0.85,
        risk_level=RiskLevel.MEDIUM,
        auth_required=AuthLevel.FULL,
        required_entities=["account_type", "funding_amount"],
        optional_entities=["promo_code", "branch_code"],
        example_utterances=[
            "Open new account",
            "Start a checking account",
            "New savings account",
            "Open account",
            "Create bank account",
        ],
        keywords=["open account", "new account", "start account", "create account", "open", "checking", "savings"],
        patterns=[
            r"\b(open|start|create) .* (new )?account\b",
            r"\bnew .* (checking|savings) account\b",
            r"\baccount .* opening\b",
        ],
        preconditions=["eligibility_check", "identity_verified", "min_deposit_check"],
        daily_limit=5,
        timeout_ms=30000,
    ),

    # ============ BUSINESS BANKING ============
    "business.account.open": BankingIntent(
        intent_id="business.account.open",
        name="Open Business Account",
        category=IntentCategory.BUSINESS_BANKING,
        subcategory="Account Opening",
        description="Open business banking account",
        confidence_threshold=0.85,
        risk_level=RiskLevel.MEDIUM,
        auth_required=AuthLevel.FULL,
        required_entities=["business_type", "account_type"],
        optional_entities=["ein", "business_name"],
        example_utterances=[
            "Open business account",
            "Business banking account",
            "Corporate account",
            "Company banking",
            "Business checking account",
        ],
        keywords=["business account", "business banking", "corporate account", "company banking", "business checking"],
        patterns=[
            r"\bbusiness .* account\b",
            r"\bcorporate .* account\b",
            r"\bcompany .* banking\b",
            r"\bbusiness .* (checking|savings)\b",
        ],
        preconditions=["business_verification", "ein_valid", "authorized_signatory"],
        daily_limit=3,
        timeout_ms=45000,
    ),

    # ============ CASH MANAGEMENT ============
    "cash.deposit.schedule": BankingIntent(
        intent_id="cash.deposit.schedule",
        name="Schedule Cash Deposit",
        category=IntentCategory.CASH_MANAGEMENT,
        subcategory="Deposits",
        description="Schedule cash deposit appointment",
        confidence_threshold=0.85,
        risk_level=RiskLevel.LOW,
        auth_required=AuthLevel.BASIC,
        required_entities=["amount", "deposit_date"],
        optional_entities=["branch_location", "denomination"],
        example_utterances=[
            "Schedule cash deposit",
            "Deposit cash",
            "Cash deposit appointment",
            "Bring cash to bank",
            "Schedule deposit",
        ],
        keywords=["cash deposit", "deposit cash", "schedule deposit", "bring cash", "deposit appointment"],
        patterns=[
            r"\b(schedule|make) .* (cash )?deposit\b",
            r"\bdeposit .* cash\b",
            r"\bbring cash .* bank\b",
            r"\bcash .* deposit\b",
        ],
        preconditions=["account_exists", "branch_available"],
        daily_limit=20,
        timeout_ms=3000,
    ),

    # ============ INTERNATIONAL ============
    "international.wire.send": BankingIntent(
        intent_id="international.wire.send",
        name="International Wire Transfer",
        category=IntentCategory.INTERNATIONAL,
        subcategory="Wire Transfers",
        description="Send international wire transfer or navigate to wire transfer form",
        confidence_threshold=0.85,
        risk_level=RiskLevel.HIGH,
        auth_required=AuthLevel.CHALLENGE,
        required_entities=["amount", "currency", "recipient_account", "recipient", "swift_code"],
        optional_entities=["purpose", "memo", "recipient_country", "correspondent_bank"],
        example_utterances=[
            "International wire transfer",
            "Send money abroad",
            "SWIFT transfer",
            "Wire to another country",
            "International money transfer",
            "Take me to wire transfers",
            "Go to wire transfer page",
            "Show wire transfers",
            "International transfers",
        ],
        keywords=["international wire", "send money abroad", "SWIFT", "wire abroad", "international transfer", "wire transfers", "international transfers", "wire transfer page"],
        patterns=[
            r"\binternational .* (wire|transfer)\b",
            r"\bsend money .* abroad\b",
            r"\bSWIFT .* transfer\b",
            r"\bwire .* (country|abroad|international)\b",
            r"\b(take me to|go to|show) .* wire transfers?\b",
            r"\binternational transfers?\b",
        ],
        preconditions=["balance_check", "kyc_check", "sanctions_check", "limit_check"],
        daily_limit=10,
        timeout_ms=20000,
        max_retries=1,
    ),
}


class IntentCatalog:
    """Unified intent catalog with comprehensive banking domain knowledge"""

    def __init__(self, intents: dict[str, BankingIntent] | None = None):
        self.intents = intents or BANKING_INTENTS

    def get_intent(self, intent_id: str) -> Optional[BankingIntent]:
        """Get intent by ID"""
        return self.intents.get(intent_id)

    def get_intents_by_category(self, category: IntentCategory) -> list[BankingIntent]:
        """Get all intents in a category"""
        return [
            intent for intent in self.intents.values()
            if intent.category == category
        ]

    def get_high_risk_intents(self) -> list[BankingIntent]:
        """Get all high-risk intents requiring extra validation"""
        return [
            intent for intent in self.intents.values()
            if intent.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]
        ]

    def search_intents(self, query: str, top_k: int = 5) -> list[tuple[str, float]]:
        """Search intents by query and return top matches with confidence scores"""
        scores = []

        for intent_id, intent in self.intents.items():
            score = intent.matches_utterance(query)
            if score > 0:
                scores.append((intent_id, score))

        # Sort by score descending and return top k
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores[:top_k]

    def match_intent(self, utterance: str) -> dict[str, Any]:
        """Match an utterance to the best intent"""
        matches = self.search_intents(utterance, top_k=3)

        if not matches:
            return {
                "intent_id": "unknown",
                "confidence": 0.0,
                "category": IntentCategory.UNKNOWN.value,
                "alternatives": [],
                "reasoning": "No matching intent found",
            }

        best_match = matches[0]
        intent = self.intents[best_match[0]]

        alternatives = [
            {"intent_id": match[0], "confidence": match[1]}
            for match in matches[1:]
        ]

        return {
            "intent_id": intent.intent_id,
            "name": intent.name,
            "category": intent.category.value,
            "subcategory": intent.subcategory,
            "confidence": best_match[1],
            "risk_level": intent.risk_level.value,
            "auth_required": intent.auth_required.value,
            "required_entities": intent.required_entities,
            "optional_entities": intent.optional_entities,
            "preconditions": intent.preconditions,
            "timeout_ms": intent.timeout_ms,
            "confidence_threshold": intent.confidence_threshold,
            "alternatives": alternatives,
            "reasoning": f"Matched based on keywords and patterns with {best_match[1]:.2f} confidence",
        }

    def get_all_intent_ids(self) -> list[str]:
        """Get all available intent IDs"""
        return list(self.intents.keys())

    def get_intent_count(self) -> int:
        """Get total number of intents"""
        return len(self.intents)

    def validate_intent_id(self, intent_id: str) -> bool:
        """Check if intent ID exists"""
        return intent_id in self.intents


# Global intent catalog instance
intent_catalog = IntentCatalog()
