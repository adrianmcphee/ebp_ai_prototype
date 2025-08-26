import asyncio
from datetime import datetime, timedelta

import pytest

from src.mock_banking import MockBankingService


@pytest.fixture()
def banking_service():
    """Create a mock banking service instance"""
    return MockBankingService()


class TestMockBankingService:

    @pytest.mark.asyncio()
    async def test_initialization(self, banking_service):
        """Test service initialization with default data"""
        assert len(banking_service.accounts) == 3
        assert len(banking_service.recipients) == 5
        assert len(banking_service.transactions) > 0

        # Check default accounts exist
        assert "CHK001" in banking_service.accounts
        assert "SAV001" in banking_service.accounts
        assert "CHK002" in banking_service.accounts

    @pytest.mark.asyncio()
    async def test_get_balance(self, banking_service):
        """Test getting account balance"""
        balance = await banking_service.get_balance("CHK001")
        assert balance == 5000.00

        balance = await banking_service.get_balance("SAV001")
        assert balance == 15000.00

        # Test non-existent account
        balance = await banking_service.get_balance("INVALID")
        assert balance is None

    @pytest.mark.asyncio()
    async def test_get_account(self, banking_service):
        """Test getting account details"""
        account = await banking_service.get_account("CHK001")
        assert account is not None
        assert account["id"] == "CHK001"
        assert account["type"] == "checking"
        assert account["balance"] == 5000.00

        # Test non-existent account
        account = await banking_service.get_account("INVALID")
        assert account is None

    @pytest.mark.asyncio()
    async def test_get_all_accounts(self, banking_service):
        """Test getting all accounts"""
        accounts = await banking_service.get_all_accounts()
        assert len(accounts) == 3
        assert all(isinstance(acc, dict) for acc in accounts)
        assert all("id" in acc for acc in accounts)
        assert all("balance" in acc for acc in accounts)

    @pytest.mark.asyncio()
    async def test_search_recipients(self, banking_service):
        """Test recipient search functionality"""
        # Search for "John"
        recipients = await banking_service.search_recipients("John")
        assert len(recipients) >= 2  # At least John Smith and John Doe
        assert all("John" in r["name"] for r in recipients)

        # Search for specific recipient
        recipients = await banking_service.search_recipients("Sarah Johnson")
        assert len(recipients) == 1
        assert recipients[0]["name"] == "Sarah Johnson"

        # Case-insensitive search
        recipients = await banking_service.search_recipients("alice")
        assert len(recipients) == 1
        assert recipients[0]["name"] == "Alice Brown"

        # No matches
        recipients = await banking_service.search_recipients("Nobody")
        assert len(recipients) == 0

    @pytest.mark.asyncio()
    async def test_get_recipient_by_id(self, banking_service):
        """Test getting recipient by ID"""
        recipient = await banking_service.get_recipient_by_id("RCP001")
        assert recipient is not None
        assert recipient["name"] == "John Smith"
        assert recipient["account_number"] == "1234567890"

        # Non-existent recipient
        recipient = await banking_service.get_recipient_by_id("INVALID")
        assert recipient is None

    @pytest.mark.asyncio()
    async def test_validate_transfer(self, banking_service):
        """Test transfer validation"""
        # Valid transfer
        validation = await banking_service.validate_transfer(
            "CHK001", "RCP001", 1000.00
        )
        assert validation["valid"] is True
        assert validation["total_amount"] == 1000.00

        # Insufficient funds
        validation = await banking_service.validate_transfer(
            "CHK001", "RCP001", 10000.00
        )
        assert validation["valid"] is False
        assert "Insufficient funds" in validation["error"]
        assert validation["available_balance"] == 5000.00

        # Invalid account
        validation = await banking_service.validate_transfer(
            "INVALID", "RCP001", 100.00
        )
        assert validation["valid"] is False
        assert "Account not found" in validation["error"]

        # Invalid recipient
        validation = await banking_service.validate_transfer(
            "CHK001", "INVALID", 100.00
        )
        assert validation["valid"] is False
        assert "Recipient not found" in validation["error"]

        # Negative amount
        validation = await banking_service.validate_transfer(
            "CHK001", "RCP001", -100.00
        )
        assert validation["valid"] is False
        assert "Amount must be positive" in validation["error"]

    @pytest.mark.asyncio()
    async def test_execute_transfer(self, banking_service):
        """Test transfer execution"""
        initial_balance = banking_service.accounts["CHK001"].balance

        # Execute valid transfer
        result = await banking_service.execute_transfer(
            "CHK001", "RCP001", 500.00, "Test transfer"
        )

        assert result["success"] is True
        assert "transaction_id" in result
        assert result["new_balance"] == initial_balance - 500.00
        assert banking_service.accounts["CHK001"].balance == initial_balance - 500.00

        # Verify transaction was recorded
        assert len(banking_service.transactions) > 0
        latest_transaction = banking_service.transactions[0]
        assert latest_transaction.amount == -500.00
        assert "Test transfer" in latest_transaction.description

        # Execute invalid transfer (insufficient funds)
        result = await banking_service.execute_transfer(
            "CHK001", "RCP001", 10000.00
        )
        assert result["success"] is False
        assert "error" in result

    @pytest.mark.asyncio()
    async def test_get_transaction_history(self, banking_service):
        """Test retrieving transaction history"""
        # Get transactions for checking account
        transactions = await banking_service.get_transaction_history("CHK001")
        assert isinstance(transactions, list)
        assert len(transactions) <= 10  # Default limit

        # Test with custom limit
        transactions = await banking_service.get_transaction_history(
            "CHK001", limit=5
        )
        assert len(transactions) <= 5

        # Test with offset
        all_transactions = await banking_service.get_transaction_history(
            "CHK001", limit=100
        )
        offset_transactions = await banking_service.get_transaction_history(
            "CHK001", limit=5, offset=2
        )

        if len(all_transactions) > 2:
            assert offset_transactions[0]["id"] == all_transactions[2]["id"]

        # Test date filtering
        today = datetime.now()
        last_week = today - timedelta(days=7)

        transactions = await banking_service.get_transaction_history(
            "CHK001",
            date_from=last_week,
            date_to=today
        )

        for trans in transactions:
            trans_date = datetime.fromisoformat(trans["date"])
            assert trans_date >= last_week
            assert trans_date <= today

    @pytest.mark.asyncio()
    async def test_get_account_by_type(self, banking_service):
        """Test getting account by type"""
        # Get checking account
        account = await banking_service.get_account_by_type("checking")
        assert account is not None
        assert account["type"] == "checking"

        # Get savings account
        account = await banking_service.get_account_by_type("savings")
        assert account is not None
        assert account["type"] == "savings"

        # Non-existent type
        account = await banking_service.get_account_by_type("bitcoin")
        assert account is None

    @pytest.mark.asyncio()
    async def test_search_transactions(self, banking_service):
        """Test transaction search functionality"""
        # Search for specific merchant
        transactions = await banking_service.search_transactions(
            "CHK001", "Grocery"
        )
        assert all("Grocery" in t["description"] for t in transactions)

        # Search for payment type
        transactions = await banking_service.search_transactions(
            "CHK001", "Rent"
        )
        assert all("Rent" in t["description"] for t in transactions)

        # Case-insensitive search
        transactions = await banking_service.search_transactions(
            "CHK001", "rent"
        )
        assert all("Rent" in t["description"] for t in transactions)

    @pytest.mark.asyncio()
    async def test_transaction_generation(self, banking_service):
        """Test that transaction history is properly generated"""
        # Check that transactions exist for all accounts
        for account_id in ["CHK001", "SAV001", "CHK002"]:
            transactions = await banking_service.get_transaction_history(
                account_id, limit=100
            )
            assert len(transactions) > 0

            # Verify transaction structure
            for trans in transactions:
                assert "id" in trans
                assert "date" in trans
                assert "amount" in trans
                assert "description" in trans
                assert "type" in trans
                assert trans["type"] in ["credit", "debit"]
                assert "balance_after" in trans

    @pytest.mark.asyncio()
    async def test_concurrent_operations(self, banking_service):
        """Test concurrent operations don't cause issues"""
        # Run multiple operations concurrently
        tasks = [
            banking_service.get_balance("CHK001"),
            banking_service.get_balance("SAV001"),
            banking_service.search_recipients("John"),
            banking_service.get_transaction_history("CHK001"),
            banking_service.validate_transfer("CHK001", "RCP001", 100.00)
        ]

        results = await asyncio.gather(*tasks)

        assert results[0] == 5000.00  # CHK001 balance
        assert results[1] == 15000.00  # SAV001 balance
        assert len(results[2]) >= 2  # At least two Johns
        assert isinstance(results[3], list)  # Transaction history
        assert results[4]["valid"] is True  # Valid transfer
