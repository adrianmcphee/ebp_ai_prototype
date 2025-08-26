"""Banking Intents Catalog - Generated from inspiration data
This module defines all banking intents with their metadata, requirements, and example utterances.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional


class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class AuthLevel(Enum):
    NONE = "none"
    BASIC = "basic"
    FULL = "full"
    CHALLENGE = "challenge"


@dataclass
class BankingIntent:
    """Represents a banking intent with all its metadata"""

    intent_id: str
    name: str
    category: str
    subcategory: str
    description: str
    confidence_threshold: float
    risk_level: RiskLevel
    requires_auth: AuthLevel
    required_entities: list[str]
    optional_entities: list[str]
    example_utterances: list[str]
    keywords: list[str]
    preconditions: list[str] = field(default_factory=list)
    daily_limit: Optional[int] = None
    timeout_ms: int = 5000

    def matches_utterance(self, utterance: str) -> float:
        """Calculate confidence score for an utterance matching this intent"""
        utterance_lower = utterance.lower()

        # Check for keyword matches
        keyword_matches = sum(1 for kw in self.keywords if kw in utterance_lower)
        keyword_score = min(keyword_matches / max(len(self.keywords), 1), 1.0)

        return keyword_score * self.confidence_threshold


# Categories of intents
class IntentCategory(Enum):
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
    TAX = "Tax"


# Define comprehensive intent catalog based on CSV data
BANKING_INTENTS = {
    # Account Management
    "accounts.balance.check": BankingIntent(
        intent_id="accounts.balance.check",
        name="Check Account Balance",
        category=IntentCategory.ACCOUNT_MANAGEMENT.value,
        subcategory="Balance Inquiry",
        description="View current account balance",
        confidence_threshold=0.95,
        risk_level=RiskLevel.LOW,
        requires_auth=AuthLevel.BASIC,
        required_entities=["account_id"],
        optional_entities=[],
        example_utterances=[
            "What's my balance?",
            "How much money do I have?",
            "Check my account",
            "Show me my balance",
            "What's in my checking account?",
        ],
        keywords=["balance", "how much", "funds", "available", "money", "account"],
        preconditions=["account_exists"],
        daily_limit=1000,
        timeout_ms=1000,
    ),
    "accounts.statement.download": BankingIntent(
        intent_id="accounts.statement.download",
        name="Download Statement",
        category=IntentCategory.ACCOUNT_MANAGEMENT.value,
        subcategory="Statements",
        description="Download account statements",
        confidence_threshold=0.9,
        risk_level=RiskLevel.LOW,
        requires_auth=AuthLevel.FULL,
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
        preconditions=["account_exists", "period_available"],
        daily_limit=50,
        timeout_ms=5000,
    ),
    # Payments
    "payments.transfer.internal": BankingIntent(
        intent_id="payments.transfer.internal",
        name="Internal Transfer",
        category=IntentCategory.PAYMENTS.value,
        subcategory="Internal",
        description="Transfer between own accounts",
        confidence_threshold=0.95,
        risk_level=RiskLevel.MEDIUM,
        requires_auth=AuthLevel.FULL,
        required_entities=["amount", "from_account", "to_account"],
        optional_entities=["memo", "schedule_date"],
        example_utterances=[
            "Transfer money between my accounts",
            "Move funds to savings",
            "Transfer $500 from checking to savings",
            "Move money to my other account",
        ],
        keywords=["transfer", "move", "between accounts", "to savings", "to checking"],
        preconditions=["balance_check", "both_accounts_active", "same_customer"],
        daily_limit=200,
        timeout_ms=4000,
    ),
    "payments.transfer.external": BankingIntent(
        intent_id="payments.transfer.external",
        name="External Transfer",
        category=IntentCategory.PAYMENTS.value,
        subcategory="External",
        description="Transfer to external account",
        confidence_threshold=0.9,
        risk_level=RiskLevel.HIGH,
        requires_auth=AuthLevel.FULL,
        required_entities=[
            "amount",
            "from_account",
            "routing_number",
            "account_number",
            "recipient_name",
        ],
        optional_entities=["memo", "wire_type"],
        example_utterances=[
            "Send money to another bank",
            "Wire transfer to external account",
            "Send $1000 to John at Chase",
            "Transfer to different bank",
        ],
        keywords=["external", "wire", "send", "another bank", "different bank"],
        preconditions=["balance_check", "limit_check", "fraud_check"],
        daily_limit=20,
        timeout_ms=15000,
    ),
    "payments.p2p.send": BankingIntent(
        intent_id="payments.p2p.send",
        name="Send P2P Payment",
        category=IntentCategory.PAYMENTS.value,
        subcategory="P2P",
        description="Send person-to-person payment",
        confidence_threshold=0.9,
        risk_level=RiskLevel.MEDIUM,
        requires_auth=AuthLevel.FULL,
        required_entities=["amount", "recipient_identifier"],
        optional_entities=["memo", "from_account"],
        example_utterances=[
            "Send money to a friend",
            "Pay John $50",
            "Zelle $100 to Sarah",
            "Venmo Mike for dinner",
            "Send cash to mom",
        ],
        keywords=["send", "pay", "zelle", "venmo", "p2p", "friend", "person"],
        preconditions=["balance_check", "recipient_enrolled"],
        daily_limit=100,
        timeout_ms=6000,
    ),
    # Cards
    "cards.block.temporary": BankingIntent(
        intent_id="cards.block.temporary",
        name="Temporary Card Block",
        category=IntentCategory.CARDS.value,
        subcategory="Security",
        description="Temporarily block card",
        confidence_threshold=0.9,
        risk_level=RiskLevel.HIGH,
        requires_auth=AuthLevel.FULL,
        required_entities=["card_id"],
        optional_entities=["reason", "estimated_duration"],
        example_utterances=[
            "Block my card temporarily",
            "Freeze my debit card",
            "Temporarily disable my card",
            "Pause my credit card",
            "Lock my card for now",
        ],
        keywords=["block", "freeze", "lock", "disable", "temporary", "pause"],
        preconditions=["card_active", "account_active"],
        daily_limit=50,
        timeout_ms=2000,
    ),
    "cards.replace.lost": BankingIntent(
        intent_id="cards.replace.lost",
        name="Replace Lost Card",
        category=IntentCategory.CARDS.value,
        subcategory="Replacement",
        description="Order replacement for lost card",
        confidence_threshold=0.9,
        risk_level=RiskLevel.HIGH,
        requires_auth=AuthLevel.FULL,
        required_entities=["card_id"],
        optional_entities=["expedited", "delivery_address"],
        example_utterances=[
            "I lost my card",
            "Can't find my debit card",
            "My credit card is missing",
            "Need a replacement card",
            "Report lost card",
        ],
        keywords=["lost", "missing", "can't find", "replacement", "new card"],
        preconditions=["card_exists", "eligible_for_replacement"],
        daily_limit=5,
        timeout_ms=6000,
    ),
    # Disputes
    "disputes.transaction.initiate": BankingIntent(
        intent_id="disputes.transaction.initiate",
        name="Dispute Transaction",
        category=IntentCategory.DISPUTES.value,
        subcategory="Transaction Disputes",
        description="Initiate transaction dispute",
        confidence_threshold=0.85,
        risk_level=RiskLevel.HIGH,
        requires_auth=AuthLevel.FULL,
        required_entities=["transaction_id", "dispute_reason"],
        optional_entities=["amount", "supporting_docs"],
        example_utterances=[
            "I want to dispute a charge",
            "This transaction is wrong",
            "Fraudulent charge on my account",
            "I didn't make this purchase",
            "Report unauthorized transaction",
        ],
        keywords=[
            "dispute",
            "wrong",
            "fraudulent",
            "unauthorized",
            "didn't make",
            "error",
        ],
        preconditions=["within_dispute_window", "transaction_posted"],
        daily_limit=10,
        timeout_ms=10000,
    ),
    # Lending
    "lending.apply.personal": BankingIntent(
        intent_id="lending.apply.personal",
        name="Apply Personal Loan",
        category=IntentCategory.LENDING.value,
        subcategory="Personal",
        description="Apply for personal loan",
        confidence_threshold=0.85,
        risk_level=RiskLevel.MEDIUM,
        requires_auth=AuthLevel.FULL,
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
        preconditions=["credit_check", "income_verification"],
        daily_limit=2,
        timeout_ms=60000,
    ),
    # Support
    "support.agent.request": BankingIntent(
        intent_id="support.agent.request",
        name="Request Agent",
        category=IntentCategory.SUPPORT.value,
        subcategory="Agent Assistance",
        description="Request human agent assistance",
        confidence_threshold=0.9,
        risk_level=RiskLevel.LOW,
        requires_auth=AuthLevel.BASIC,
        required_entities=["reason"],
        optional_entities=["priority", "preferred_channel"],
        example_utterances=[
            "Talk to an agent",
            "I need human help",
            "Connect me to customer service",
            "Speak with representative",
            "Get me a real person",
        ],
        keywords=[
            "agent",
            "human",
            "representative",
            "customer service",
            "talk",
            "speak",
        ],
        preconditions=["valid_reason", "hours_check"],
        daily_limit=100,
        timeout_ms=2000,
    ),
    # Investments
    "investments.portfolio.view": BankingIntent(
        intent_id="investments.portfolio.view",
        name="View Portfolio",
        category=IntentCategory.INVESTMENTS.value,
        subcategory="Portfolio",
        description="View investment portfolio",
        confidence_threshold=0.9,
        risk_level=RiskLevel.LOW,
        requires_auth=AuthLevel.FULL,
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
        preconditions=["has_investment_account"],
        daily_limit=500,
        timeout_ms=3000,
    ),
}


class IntentMatcher:
    """Enhanced intent matching using the comprehensive catalog"""

    def __init__(self, intents: dict[str, BankingIntent] | None = None):
        self.intents = intents or BANKING_INTENTS

    def match_intent(self, utterance: str) -> dict[str, Any]:
        """Match an utterance to the best intent"""
        scores = []

        for intent_id, intent in self.intents.items():
            score = intent.matches_utterance(utterance)
            if score > 0:
                scores.append(
                    {"intent_id": intent_id, "intent": intent, "score": score}
                )

        # Sort by score
        scores.sort(key=lambda x: x["score"], reverse=True)

        if not scores:
            return {
                "intent_id": "unknown",
                "confidence": 0.0,
                "required_entities": [],
                "risk_level": RiskLevel.LOW.value,
            }

        best_match = scores[0]
        return {
            "intent_id": best_match["intent_id"],
            "name": best_match["intent"].name,
            "confidence": best_match["score"],
            "required_entities": best_match["intent"].required_entities,
            "optional_entities": best_match["intent"].optional_entities,
            "risk_level": best_match["intent"].risk_level.value,
            "requires_auth": best_match["intent"].requires_auth.value,
            "category": best_match["intent"].category,
            "alternatives": [s["intent_id"] for s in scores[1:3]]
            if len(scores) > 1
            else [],
        }

    def get_intent_by_id(self, intent_id: str) -> Optional[BankingIntent]:
        """Get intent by its ID"""
        return self.intents.get(intent_id)

    def get_intents_by_category(self, category: str) -> list[BankingIntent]:
        """Get all intents in a category"""
        return [
            intent for intent in self.intents.values() if intent.category == category
        ]

    def get_high_risk_intents(self) -> list[BankingIntent]:
        """Get all high-risk intents requiring extra validation"""
        return [
            intent
            for intent in self.intents.values()
            if intent.risk_level == RiskLevel.HIGH
        ]
