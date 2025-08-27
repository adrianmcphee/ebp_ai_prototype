"""Comprehensive test coverage for all banking intents in the catalog"""

import pytest
import pytest_asyncio

from src.cache import MockCache
from src.intent_catalog import (
    BANKING_INTENTS,
    AuthLevel,
    IntentCatalog,
    IntentCategory,
    RiskLevel,
)
from src.intent_classifier import IntentClassifier
from src.llm_client import MockLLMClient


@pytest_asyncio.fixture
async def mock_cache():
    """Create a mock cache instance"""
    cache = MockCache()
    await cache.connect()
    return cache


@pytest_asyncio.fixture
async def mock_llm():
    """Create a mock LLM client"""
    return MockLLMClient(delay=0.01)


@pytest_asyncio.fixture
async def classifier(mock_llm, mock_cache):
    """Create an intent classifier instance"""
    return IntentClassifier(mock_llm, mock_cache)


@pytest_asyncio.fixture
def catalog():
    """Create an intent catalog instance"""
    return IntentCatalog()


class TestIntentCatalogCompleteness:
    """Test that all intents are properly defined and categorized"""

    def test_all_intents_have_required_fields(self, catalog):
        """Ensure all intents have required fields populated"""
        for intent_id, intent in BANKING_INTENTS.items():
            assert intent.intent_id == intent_id, f"Intent ID mismatch for {intent_id}"
            assert intent.name, f"Missing name for {intent_id}"
            assert intent.category, f"Missing category for {intent_id}"
            assert intent.subcategory, f"Missing subcategory for {intent_id}"
            assert intent.description, f"Missing description for {intent_id}"
            assert intent.confidence_threshold > 0, f"Invalid confidence threshold for {intent_id}"
            assert intent.risk_level in RiskLevel, f"Invalid risk level for {intent_id}"
            assert intent.auth_required in AuthLevel, f"Invalid auth level for {intent_id}"
            assert isinstance(intent.required_entities, list), f"Invalid required_entities for {intent_id}"
            assert isinstance(intent.optional_entities, list), f"Invalid optional_entities for {intent_id}"
            assert len(intent.example_utterances) > 0, f"No example utterances for {intent_id}"
            assert len(intent.keywords) > 0, f"No keywords for {intent_id}"

    def test_intent_count(self, catalog):
        """Verify we have the expected number of intents"""
        assert catalog.get_intent_count() == 36, "Expected 36 intents in catalog"

    def test_all_categories_have_intents(self, catalog):
        """Ensure all categories have at least one intent"""
        categories_with_intents = set()
        for intent in BANKING_INTENTS.values():
            categories_with_intents.add(intent.category)

        # These are the categories we expect to have intents
        expected_categories = {
            IntentCategory.ACCOUNT_MANAGEMENT,
            IntentCategory.PAYMENTS,
            IntentCategory.TRANSFERS,
            IntentCategory.CARDS,
            IntentCategory.LENDING,
            IntentCategory.INVESTMENTS,
            IntentCategory.SECURITY,
            IntentCategory.SUPPORT,
            IntentCategory.INQUIRIES,
            IntentCategory.DISPUTES,
            IntentCategory.AUTHENTICATION,
            IntentCategory.PROFILE,
            IntentCategory.BUSINESS_BANKING,
            IntentCategory.CASH_MANAGEMENT,
            IntentCategory.INTERNATIONAL,
        }

        assert expected_categories.issubset(categories_with_intents), "Not all expected categories have intents"


class TestAccountManagementIntents:
    """Test all account management related intents"""

    @pytest.mark.asyncio()
    async def test_balance_check_intent(self, classifier):
        """Test balance check intent classification"""
        queries = [
            "What's my balance?",
            "How much money do I have?",
            "Check my account",
            "Show me my balance",
            "What's in my checking account?",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "accounts.balance.check", f"Failed for query: {query}"
            assert result["confidence"] > 0.05, f"Low confidence for query: {query}"

    @pytest.mark.asyncio()
    async def test_balance_history_intent(self, classifier):
        """Test balance history intent classification"""
        queries = [
            "Show balance history",
            "Balance trends",
            "How has my balance changed?",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "accounts.balance.history", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_statement_download_intent(self, classifier):
        """Test statement download intent classification"""
        queries = [
            "Download my statement",
            "Get statement PDF",
            "I need my bank statement",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "accounts.statement.download", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_statement_view_intent(self, classifier):
        """Test statement view intent classification"""
        queries = [
            "Show my statement",
            "View transactions",
            "Online statement",
        ]

        for query in queries:
            result = await classifier.classify(query)
            # Could be either statement view or transaction search
            assert result["intent_id"] in ["accounts.statement.view", "inquiries.transaction.search"], f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_alerts_setup_intent(self, classifier):
        """Test alerts setup intent classification"""
        queries = [
            "Setup alerts",
            "Configure notifications",
            "Balance alerts",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "accounts.alerts.setup", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_account_close_intent(self, classifier):
        """Test account close intent classification"""
        queries = [
            "Close my account",
            "Cancel account",
            "I want to close this account",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "accounts.close.request", f"Failed for query: {query}"
            assert result["risk_level"] == "high", f"Wrong risk level for query: {query}"


class TestPaymentAndTransferIntents:
    """Test all payment and transfer related intents"""

    @pytest.mark.asyncio()
    async def test_internal_transfer_intent(self, classifier):
        """Test internal transfer intent classification"""
        queries = [
            "Transfer money between my accounts",
            "Move funds to savings",
            "Transfer $500 from checking to savings",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "payments.transfer.internal", f"Failed for query: {query}"
            assert result["risk_level"] == "medium", f"Wrong risk level for query: {query}"

    @pytest.mark.asyncio()
    async def test_external_transfer_intent(self, classifier):
        """Test external transfer intent classification"""
        queries = [
            "Send money to another bank",
            "Wire transfer to external account",
            "Transfer to different bank",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "payments.transfer.external", f"Failed for query: {query}"
            assert result["risk_level"] == "high", f"Wrong risk level for query: {query}"

    @pytest.mark.asyncio()
    async def test_p2p_payment_intent(self, classifier):
        """Test P2P payment intent classification"""
        queries = [
            "Send money to a friend",
            "Pay John $50",
            "Zelle $100 to Sarah",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "payments.p2p.send", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_bill_pay_intent(self, classifier):
        """Test bill pay intent classification"""
        queries = [
            "Pay my bill",
            "Make payment",
            "Pay electric bill",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "payments.bill.pay", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_scheduled_payment_intent(self, classifier):
        """Test scheduled payment intent classification"""
        queries = [
            "Schedule bill payment",
            "Pay later",
            "Schedule payment for next week",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "payments.bill.schedule", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_recurring_payment_intent(self, classifier):
        """Test recurring payment intent classification"""
        queries = [
            "Setup autopay",
            "Recurring payment",
            "Monthly payment",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "payments.recurring.setup", f"Failed for query: {query}"


class TestCardIntents:
    """Test all card related intents"""

    @pytest.mark.asyncio()
    async def test_block_card_intent(self, classifier):
        """Test block card intent classification"""
        queries = [
            "Block my card temporarily",
            "Freeze my debit card",
            "Lock my card for now",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "cards.block.temporary", f"Failed for query: {query}"
            assert result["risk_level"] == "high", f"Wrong risk level for query: {query}"

    @pytest.mark.asyncio()
    async def test_replace_card_intent(self, classifier):
        """Test replace card intent classification"""
        queries = [
            "I lost my card",
            "Can't find my debit card",
            "Need a replacement card",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "cards.replace.lost", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_activate_card_intent(self, classifier):
        """Test activate card intent classification"""
        queries = [
            "Activate my card",
            "Turn on new card",
            "Enable my debit card",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "cards.activate", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_change_pin_intent(self, classifier):
        """Test change PIN intent classification"""
        queries = [
            "Change my PIN",
            "Update card PIN",
            "Reset my PIN number",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "cards.pin.change", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_increase_limit_intent(self, classifier):
        """Test increase limit intent classification"""
        queries = [
            "Increase my credit limit",
            "Raise card limit",
            "Higher credit limit",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "cards.limit.increase", f"Failed for query: {query}"


class TestDisputeAndSupportIntents:
    """Test dispute and support related intents"""

    @pytest.mark.asyncio()
    async def test_dispute_transaction_intent(self, classifier):
        """Test dispute transaction intent classification"""
        queries = [
            "I want to dispute a charge",
            "This transaction is wrong",
            "I didn't make this purchase",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "disputes.transaction.initiate", f"Failed for query: {query}"
            assert result["risk_level"] == "high", f"Wrong risk level for query: {query}"

    @pytest.mark.asyncio()
    async def test_agent_request_intent(self, classifier):
        """Test agent request intent classification"""
        queries = [
            "Talk to an agent",
            "I need human help",
            "Connect me to customer service",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "support.agent.request", f"Failed for query: {query}"


class TestInquiryIntents:
    """Test inquiry related intents"""

    @pytest.mark.asyncio()
    async def test_transaction_search_intent(self, classifier):
        """Test transaction search intent classification"""
        queries = [
            "Show my transactions",
            "Recent purchases",
            "Transaction history",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "inquiries.transaction.search", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_payment_status_intent(self, classifier):
        """Test payment status intent classification"""
        queries = [
            "Payment status",
            "Is payment sent",
            "Did my payment go through",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "payments.status.check", f"Failed for query: {query}"


class TestLendingIntents:
    """Test lending related intents"""

    @pytest.mark.asyncio()
    async def test_personal_loan_intent(self, classifier):
        """Test personal loan application intent"""
        queries = [
            "Apply for a personal loan",
            "I need to borrow money",
            "Get a loan for $10000",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "lending.apply.personal", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_mortgage_intent(self, classifier):
        """Test mortgage application intent"""
        queries = [
            "Apply for mortgage",
            "Home loan application",
            "Buy a house loan",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "lending.apply.mortgage", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_loan_payment_intent(self, classifier):
        """Test loan payment intent"""
        queries = [
            "Pay my loan",
            "Make loan payment",
            "Pay mortgage",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "lending.payment.make", f"Failed for query: {query}"


class TestInvestmentIntents:
    """Test investment related intents"""

    @pytest.mark.asyncio()
    async def test_portfolio_view_intent(self, classifier):
        """Test portfolio view intent"""
        queries = [
            "Show my portfolio",
            "How are my investments doing?",
            "Check my stocks",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "investments.portfolio.view", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_buy_stock_intent(self, classifier):
        """Test buy stock intent"""
        queries = [
            "Buy stock",
            "Purchase shares",
            "Buy 10 shares of Tesla",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "investments.buy.stock", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_sell_stock_intent(self, classifier):
        """Test sell stock intent"""
        queries = [
            "Sell stock",
            "Sell shares",
            "Sell my AAPL",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "investments.sell.stock", f"Failed for query: {query}"


class TestAuthenticationIntents:
    """Test authentication related intents"""

    @pytest.mark.asyncio()
    async def test_login_intent(self, classifier):
        """Test login intent"""
        queries = [
            "Log me in",
            "I want to login",
            "Sign in",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "authentication.login", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_logout_intent(self, classifier):
        """Test logout intent"""
        queries = [
            "Log me out",
            "Sign out",
            "End session",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "authentication.logout", f"Failed for query: {query}"


class TestSecurityIntents:
    """Test security related intents"""

    @pytest.mark.asyncio()
    async def test_password_reset_intent(self, classifier):
        """Test password reset intent"""
        queries = [
            "Reset my password",
            "Forgot my password",
            "Change password",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "security.password.reset", f"Failed for query: {query}"

    @pytest.mark.asyncio()
    async def test_2fa_setup_intent(self, classifier):
        """Test 2FA setup intent"""
        queries = [
            "Setup 2FA",
            "Two-factor authentication",
            "Enable 2FA",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "security.2fa.setup", f"Failed for query: {query}"


class TestProfileIntents:
    """Test profile management intents"""

    @pytest.mark.asyncio()
    async def test_update_contact_intent(self, classifier):
        """Test update contact information intent"""
        queries = [
            "Update my email",
            "Change my phone number",
            "Update address",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "profile.update.contact", f"Failed for query: {query}"


class TestOnboardingIntents:
    """Test onboarding related intents"""

    @pytest.mark.asyncio()
    async def test_open_account_intent(self, classifier):
        """Test open account intent"""
        queries = [
            "Open new account",
            "Start a checking account",
            "New savings account",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "onboarding.account.open", f"Failed for query: {query}"


class TestBusinessBankingIntents:
    """Test business banking intents"""

    @pytest.mark.asyncio()
    async def test_business_account_intent(self, classifier):
        """Test business account opening intent"""
        queries = [
            "Open business account",
            "Business banking account",
            "Corporate account",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "business.account.open", f"Failed for query: {query}"


class TestCashManagementIntents:
    """Test cash management intents"""

    @pytest.mark.asyncio()
    async def test_cash_deposit_intent(self, classifier):
        """Test cash deposit scheduling intent"""
        queries = [
            "Schedule cash deposit",
            "Deposit cash",
            "Bring cash to bank",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "cash.deposit.schedule", f"Failed for query: {query}"


class TestInternationalIntents:
    """Test international banking intents"""

    @pytest.mark.asyncio()
    async def test_international_wire_intent(self, classifier):
        """Test international wire transfer intent"""
        queries = [
            "International wire transfer",
            "Send money abroad",
            "SWIFT transfer",
        ]

        for query in queries:
            result = await classifier.classify(query)
            assert result["intent_id"] == "international.wire.send", f"Failed for query: {query}"
            assert result["risk_level"] == "high", f"Wrong risk level for query: {query}"


class TestIntentCatalogMethods:
    """Test IntentCatalog helper methods"""

    def test_get_intent_by_id(self, catalog):
        """Test retrieving intent by ID"""
        intent = catalog.get_intent("accounts.balance.check")
        assert intent is not None
        assert intent.name == "Check Account Balance"
        assert intent.category == IntentCategory.ACCOUNT_MANAGEMENT

    def test_get_intents_by_category(self, catalog):
        """Test retrieving intents by category"""
        card_intents = catalog.get_intents_by_category(IntentCategory.CARDS)
        assert len(card_intents) >= 5, "Expected at least 5 card intents"

        for intent in card_intents:
            assert intent.category == IntentCategory.CARDS

    def test_get_high_risk_intents(self, catalog):
        """Test retrieving high-risk intents"""
        high_risk = catalog.get_high_risk_intents()
        assert len(high_risk) > 0, "Expected at least one high-risk intent"

        for intent in high_risk:
            assert intent.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]

    def test_search_intents(self, catalog):
        """Test intent search functionality"""
        results = catalog.search_intents("transfer money", top_k=3)
        assert len(results) <= 3
        assert len(results) > 0, "Expected at least one match for 'transfer money'"

        # Check that results are sorted by confidence
        for i in range(1, len(results)):
            assert results[i-1][1] >= results[i][1], "Results not sorted by confidence"

    def test_match_intent(self, catalog):
        """Test intent matching with confidence scores"""
        result = catalog.match_intent("I want to check my balance")
        assert result["intent_id"] == "accounts.balance.check"
        assert result["confidence"] > 0.0
        assert "alternatives" in result
        assert "reasoning" in result

    def test_validate_intent_id(self, catalog):
        """Test intent ID validation"""
        assert catalog.validate_intent_id("accounts.balance.check") is True
        assert catalog.validate_intent_id("invalid.intent.id") is False

    def test_get_all_intent_ids(self, catalog):
        """Test retrieving all intent IDs"""
        all_ids = catalog.get_all_intent_ids()
        assert len(all_ids) == 36, "Expected 36 intent IDs"
        assert "accounts.balance.check" in all_ids
        assert "payments.transfer.internal" in all_ids


class TestIntentPatternMatching:
    """Test pattern matching for intents"""

    def test_intent_pattern_compilation(self, catalog):
        """Test that all intent patterns compile successfully"""
        for intent_id, intent in BANKING_INTENTS.items():
            assert hasattr(intent, "compiled_patterns"), f"Missing compiled patterns for {intent_id}"
            for pattern in intent.compiled_patterns:
                assert pattern is not None, f"Failed to compile pattern for {intent_id}"

    def test_intent_keyword_matching(self, catalog):
        """Test keyword matching logic"""
        balance_intent = catalog.get_intent("accounts.balance.check")

        # Test with query containing keywords
        score = balance_intent.matches_utterance("What is my account balance?")
        assert score > 0.0, "Should match on keywords"

        # Test with query not containing keywords
        score = balance_intent.matches_utterance("Hello world")
        assert score == 0.0, "Should not match without keywords"

    def test_intent_pattern_matching_cases(self, catalog):
        """Test specific pattern matching cases"""
        transfer_intent = catalog.get_intent("payments.transfer.internal")

        test_cases = [
            ("transfer $100 to my savings", True),
            ("move money between accounts", True),
            ("internal transfer please", True),
            ("hello world", False),
        ]

        for query, should_match in test_cases:
            score = transfer_intent.matches_utterance(query)
            if should_match:
                assert score > 0.0, f"Should match: {query}"
            else:
                assert score == 0.0, f"Should not match: {query}"


class TestRiskAndAuthLevels:
    """Test risk and authentication level assignments"""

    def test_high_risk_operations_have_proper_auth(self, catalog):
        """Ensure high-risk operations require appropriate authentication"""
        for intent in catalog.get_high_risk_intents():
            assert intent.auth_required in [AuthLevel.FULL, AuthLevel.CHALLENGE], \
                f"High-risk intent {intent.intent_id} should require FULL or CHALLENGE auth"

    def test_low_risk_operations_auth(self, catalog):
        """Ensure low-risk operations have appropriate authentication"""
        # Some low-risk operations may still require FULL auth for security
        exceptions = [
            "accounts.statement.download",  # Statements contain sensitive data
            "investments.portfolio.view",  # Investment info is sensitive
        ]
        
        for intent_id, intent in BANKING_INTENTS.items():
            if intent.risk_level == RiskLevel.LOW and intent_id not in exceptions:
                assert intent.auth_required in [AuthLevel.NONE, AuthLevel.BASIC], \
                    f"Low-risk intent {intent_id} should require NONE or BASIC auth"

    def test_critical_operations_have_challenge_auth(self, catalog):
        """Ensure critical operations require challenge authentication"""
        for intent_id, intent in BANKING_INTENTS.items():
            if intent.risk_level == RiskLevel.CRITICAL:
                assert intent.auth_required == AuthLevel.CHALLENGE, \
                    f"Critical intent {intent_id} should require CHALLENGE auth"


class TestIntentPreconditions:
    """Test intent preconditions"""

    def test_transfer_intents_have_balance_check(self, catalog):
        """Ensure transfer intents check balance"""
        transfer_intents = [
            "payments.transfer.internal",
            "payments.transfer.external",
            "payments.p2p.send",
        ]

        for intent_id in transfer_intents:
            intent = catalog.get_intent(intent_id)
            assert "balance_check" in intent.preconditions, \
                f"Transfer intent {intent_id} should check balance"

    def test_account_close_preconditions(self, catalog):
        """Test account closing preconditions"""
        intent = catalog.get_intent("accounts.close.request")
        assert "zero_balance" in intent.preconditions
        assert "no_pending_transactions" in intent.preconditions

    def test_card_activation_preconditions(self, catalog):
        """Test card activation preconditions"""
        intent = catalog.get_intent("cards.activate")
        assert "card_issued" in intent.preconditions
        assert "not_activated" in intent.preconditions
        assert "identity_verified" in intent.preconditions
