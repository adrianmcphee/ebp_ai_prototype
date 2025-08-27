"""Comprehensive Banking Intent Catalog
Unified intent system combining the best of both IntentConfig and BankingIntent approaches,
inspired by comprehensive banking domain knowledge.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional
import re


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
    daily_limit: Optional[int] = None
    timeout_ms: int = 5000
    max_retries: int = 3

    def __post_init__(self):
        """Compile regex patterns after initialization"""
        self.compiled_patterns = [
            re.compile(pattern, re.IGNORECASE) for pattern in self.patterns
        ]

    def matches_utterance(self, utterance: str) -> float:
        """Calculate confidence score for utterance matching this intent"""
        utterance_lower = utterance.lower()
        score = 0.0

        # Check for keyword matches (60% weight)
        if self.keywords:
            keyword_matches = sum(1 for kw in self.keywords if kw.lower() in utterance_lower)
            keyword_score = min(keyword_matches / len(self.keywords), 1.0)
            score += 0.6 * keyword_score

        # Check for pattern matches (40% weight)
        if self.compiled_patterns:
            pattern_matches = sum(1 for pattern in self.compiled_patterns if pattern.search(utterance_lower))
            pattern_score = min(pattern_matches / len(self.compiled_patterns), 1.0)
            score += 0.4 * pattern_score

        return score * self.confidence_threshold


# Comprehensive Banking Intent Catalog
BANKING_INTENTS = {
    # ============ ACCOUNT MANAGEMENT ============
    "accounts.balance.check": BankingIntent(
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
        example_utterances=[
            "What's my balance?",
            "How much money do I have?",
            "Check my account",
            "Show me my balance",
            "What's in my checking account?",
        ],
        keywords=["balance", "how much", "available", "funds", "money", "account"],
        patterns=[
            r"\b(what('s| is) my|check|show) .* balance\b",
            r"\bhow much .* (have|available|left)\b",
            r"\b(available|current) (funds|balance)\b",
        ],
        preconditions=["account_exists"],
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
        required_entities=["amount", "from_account", "to_account"],
        optional_entities=["memo", "schedule_date"],
        example_utterances=[
            "Transfer money between my accounts",
            "Move funds to savings",
            "Transfer $500 from checking to savings",
            "Move money to my other account",
            "Internal transfer",
        ],
        keywords=["transfer", "move", "between", "accounts", "savings", "checking", "internal"],
        patterns=[
            r"\btransfer .* (to|from|between) .* account\b",
            r"\bmove .* (to|from) (savings|checking)\b",
            r"\b(internal|between) .* transfer\b",
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
        description="Make bill payment",
        confidence_threshold=0.9,
        risk_level=RiskLevel.MEDIUM,
        auth_required=AuthLevel.FULL,
        required_entities=["payee", "amount"],
        optional_entities=["account_id", "due_date", "memo"],
        example_utterances=[
            "Pay my bill",
            "Make payment",
            "Bill pay",
            "Pay electric bill",
            "Send payment to utility company",
        ],
        keywords=["pay", "bill", "payment", "payee", "utility", "electric", "water"],
        patterns=[
            r"\bpay .* bill\b",
            r"\bbill pay\b",
            r"\bmake .* payment\b",
            r"\bpay .* (electric|water|gas|utility)\b",
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
            "This transaction is wrong",
            "Fraudulent charge on my account",
            "I didn't make this purchase",
            "Report unauthorized transaction",
        ],
        keywords=["dispute", "wrong", "fraud", "unauthorized", "didn't make", "charge"],
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