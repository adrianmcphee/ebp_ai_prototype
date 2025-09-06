import asyncio
import random
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from typing import Any, Optional


@dataclass
class Account:
    id: str
    name: str
    type: str
    balance: float
    currency: str = "USD"

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Recipient:
    id: str
    name: str
    account_number: str
    bank_name: str = "Mock Bank"
    alias: Optional[str] = None
    bank_country: str = "US"
    routing_number: Optional[str] = None
    swift_code: Optional[str] = None
    bank_address: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)
    
    def is_international(self) -> bool:
        """Check if recipient is in a different country from US (assumed home country)."""
        return self.bank_country != "US"
    
    def transfer_type(self, home_bank: str = "Mock Bank") -> str:
        """Determine transfer type based on banking metadata.
        
        Args:
            home_bank: Name of the user's home bank for internal transfer detection
            
        Returns:
            "internal" if same bank, "domestic" if same country different bank,
            "international" if different country
        """
        if self.bank_name == home_bank:
            return "internal"
        elif self.bank_country == "US":
            return "domestic"
        else:
            return "international"


@dataclass
class Transaction:
    id: str
    date: datetime
    amount: float
    description: str
    type: str
    account_id: str
    balance_after: float

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        data["date"] = self.date.isoformat()
        return data


class MockBankingService:
    def __init__(self):
        self.accounts = {
            "CHK001": Account(
                id="CHK001", name="Primary Checking", type="checking", balance=5000.00
            ),
            "SAV001": Account(
                id="SAV001", name="Savings Account", type="savings", balance=15000.00
            ),
            "CHK002": Account(
                id="CHK002", name="Business Checking", type="checking", balance=25000.00
            ),
        }

        self.recipients = [
            # US Internal recipients (same bank - Mock Bank)
            Recipient(
                id="RCP001", 
                name="John Smith", 
                account_number="4532891067834521",
                bank_name="Mock Bank",
                bank_country="US",
                routing_number="123456789",
                alias="Johnny"
            ),
            Recipient(
                id="RCP002", 
                name="John Doe", 
                account_number="4532891067834522",
                bank_name="Mock Bank",
                bank_country="US", 
                routing_number="123456789",
                alias="John"
            ),
            Recipient(
                id="RCP003",
                name="Amy Winehouse", 
                account_number="4532891067834523",
                bank_name="Mock Bank",
                bank_country="US",
                routing_number="123456789",
                alias="my mum"
            ),
            
            # US Domestic recipients (different US banks)
            Recipient(
                id="RCP004",
                name="Sarah Johnson", 
                account_number="1234567890123",
                bank_name="Wells Fargo Bank",
                bank_country="US",
                routing_number="121000248",
                alias="Sarah"
            ),
            Recipient(
                id="RCP005",
                name="Michael Davis",
                account_number="9876543210987", 
                bank_name="Chase Bank",
                bank_country="US",
                routing_number="021000021",
                alias="Mike"
            ),
            Recipient(
                id="RCP006",
                name="Alice Brown",
                account_number="5555666677778888",
                bank_name="Bank of America", 
                bank_country="US",
                routing_number="026009593",
                alias="Alice"
            ),
            
            # International recipients
            
            # Canada
            Recipient(
                id="RCP007", 
                name="Jack White", 
                account_number="123456789",
                bank_name="Royal Bank of Canada",
                bank_country="CA", 
                swift_code="ROYCCAT2",
                bank_address="200 Bay Street, Toronto, ON M5J 2J5, Canada",
                alias="Jack"
            ),
            
            # EU - Germany
            Recipient(
                id="RCP008",
                name="Hans Mueller",
                account_number="DE89370400440532013000",
                bank_name="Deutsche Bank AG",
                bank_country="DE",
                swift_code="DEUTDEFF",
                bank_address="Taunusanlage 12, 60325 Frankfurt am Main, Germany",
                alias="Hans"
            ),
            
            # EU - France
            Recipient(
                id="RCP009",
                name="Marie Dubois",
                account_number="FR1420041010050500013M02606",
                bank_name="BNP Paribas",
                bank_country="FR", 
                swift_code="BNPAFRPP",
                bank_address="16 Boulevard des Italiens, 75009 Paris, France",
                alias="Marie"
            ),
            
            # EU - Netherlands  
            Recipient(
                id="RCP010",
                name="Erik van der Berg",
                account_number="NL91ABNA0417164300",
                bank_name="ABN AMRO Bank",
                bank_country="NL",
                swift_code="ABNANL2A", 
                bank_address="Gustav Mahlerlaan 10, 1082 PP Amsterdam, Netherlands"
            ),
        ]

        self._generate_transaction_history()

    def _generate_transaction_history(self):
        self.transactions = []

        transaction_templates = [
            ("Grocery Store", "debit", -150.00),
            ("Paycheck Deposit", "credit", 3500.00),
            ("Rent Payment", "debit", -1500.00),
            ("Utilities", "debit", -200.00),
            ("Restaurant", "debit", -85.00),
            ("ATM Withdrawal", "debit", -200.00),
            ("Online Transfer", "credit", 500.00),
            ("Insurance Payment", "debit", -300.00),
            ("Gas Station", "debit", -65.00),
            ("Coffee Shop", "debit", -12.50),
        ]

        for account_id in ["CHK001", "SAV001", "CHK002"]:
            balance = self.accounts[account_id].balance

            for _i in range(20):
                days_ago = random.randint(0, 30)
                trans_date = datetime.now() - timedelta(days=days_ago)

                template = random.choice(transaction_templates)
                description, trans_type, amount = template

                amount_variation = amount * (1 + random.uniform(-0.2, 0.2))

                self.transactions.append(
                    Transaction(
                        id=f"TRX{len(self.transactions):05d}",
                        date=trans_date,
                        amount=amount_variation,
                        description=description,
                        type=trans_type,
                        account_id=account_id,
                        balance_after=balance,
                    )
                )

                balance += amount_variation

        self.transactions.sort(key=lambda x: x.date, reverse=True)

    async def get_balance(self, account_id: str) -> Optional[float]:
        await asyncio.sleep(0.3)
        account = self.accounts.get(account_id)
        return account.balance if account else None

    async def get_account(self, account_id: str) -> Optional[dict[str, Any]]:
        await asyncio.sleep(0.2)
        account = self.accounts.get(account_id)
        return account.to_dict() if account else None

    async def get_all_accounts(self) -> list[dict[str, Any]]:
        await asyncio.sleep(0.3)
        return [acc.to_dict() for acc in self.accounts.values()]

    async def get_all_recipients(self) -> list[dict[str, Any]]:
        """Get all recipients"""
        await asyncio.sleep(0.1)
        return [r.to_dict() for r in self.recipients]

    async def search_recipients(self, query: str) -> list[dict[str, Any]]:
        await asyncio.sleep(0.2)
        query_lower = query.lower()
        matching = [
            r.to_dict() for r in self.recipients 
            if query_lower in r.name.lower() or (r.alias and query_lower in r.alias.lower())
        ]
        return matching

    async def get_recipient_by_id(self, recipient_id: str) -> Optional[dict[str, Any]]:
        await asyncio.sleep(0.1)
        for recipient in self.recipients:
            if recipient.id == recipient_id:
                return recipient.to_dict()
        return None

    async def get_transaction_history(
        self,
        account_id: str,
        limit: int = 10,
        offset: int = 0,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> list[dict[str, Any]]:
        await asyncio.sleep(0.4)

        filtered = [t for t in self.transactions if t.account_id == account_id]

        if date_from:
            filtered = [t for t in filtered if t.date >= date_from]

        if date_to:
            filtered = [t for t in filtered if t.date <= date_to]

        return [t.to_dict() for t in filtered[offset : offset + limit]]

    async def validate_transfer(
        self, from_account: str, to_recipient: str, amount: float
    ) -> dict[str, Any]:
        await asyncio.sleep(0.2)

        account = self.accounts.get(from_account)
        if not account:
            return {"valid": False, "error": "Account not found"}

        if amount <= 0:
            return {"valid": False, "error": "Amount must be positive"}

        if amount > account.balance:
            return {
                "valid": False,
                "error": "Insufficient funds",
                "available_balance": account.balance,
            }

        recipient_exists = any(r.id == to_recipient for r in self.recipients)

        if not recipient_exists:
            return {"valid": False, "error": "Recipient not found"}

        return {"valid": True, "estimated_fee": 0.00, "total_amount": amount}

    async def request_transaction_approval(
        self, transaction_type: str, amount: float, details: dict[str, Any]
    ) -> dict[str, Any]:
        """Generate approval requirement for high-value transactions.
        In production, this would trigger actual security mechanisms.
        """
        import random

        # Simulate processing time
        await asyncio.sleep(0.2)

        # Different thresholds for different transaction types
        thresholds = {
            "transfer": 10000,
            "payment": 5000,
            "wire": 5000,
            "investment": 25000,
        }

        threshold = thresholds.get(transaction_type, 10000)

        if amount > threshold:
            # Generate approval token
            approval_token = f"APV-{random.randint(100000, 999999)}"

            # Determine approval method based on amount
            if amount > 50000:
                approval_method = "biometric_and_pin"
            elif amount > 25000:
                approval_method = "biometric"
            else:
                approval_method = "pin"

            return {
                "requires_approval": True,
                "approval_method": approval_method,
                "token": approval_token,
                "expires_in": 300,  # 5 minutes
                "threshold_exceeded": threshold,
                "security_level": "high" if amount > 25000 else "medium",
            }

        return {"requires_approval": False}

    async def verify_transaction_approval(
        self, token: str, verification_data: dict[str, Any]
    ) -> dict[str, bool]:
        """Verify transaction approval.
        In prototype, simplified verification logic.
        """
        await asyncio.sleep(0.3)  # Simulate verification time

        # In prototype, accept specific test values
        if token.startswith("APV-"):
            if verification_data.get("biometric_success"):
                return {"approved": True, "method": "biometric"}
            elif verification_data.get("pin") == "1234":
                return {"approved": True, "method": "pin"}
            elif verification_data.get("security_answer") == "mockAnswer123":
                return {"approved": True, "method": "security_question"}

        return {"approved": False, "reason": "Invalid verification"}

    async def execute_transfer(
        self,
        from_account: str,
        to_recipient: str,
        amount: float,
        reference: str = "",
        approval_token: str | None = None,
    ) -> dict[str, Any]:
        await asyncio.sleep(1.0)

        # Check if high-value transfer needs approval
        if amount > 10000 and not approval_token:
            return {
                "success": False,
                "error": "High-value transfer requires approval",
                "requires_approval": True,
                "approval_method": "biometric" if amount > 25000 else "pin",
            }

        validation = await self.validate_transfer(from_account, to_recipient, amount)

        if not validation["valid"]:
            return {"success": False, "error": validation["error"]}

        account = self.accounts[from_account]
        account.balance -= amount

        transaction_id = f"TRX{len(self.transactions):05d}"

        new_transaction = Transaction(
            id=transaction_id,
            date=datetime.now(),
            amount=-amount,
            description=f"Transfer to {to_recipient}: {reference}",
            type="debit",
            account_id=from_account,
            balance_after=account.balance,
        )

        self.transactions.insert(0, new_transaction)

        return {
            "success": True,
            "transaction_id": transaction_id,
            "new_balance": account.balance,
            "timestamp": datetime.now().isoformat(),
        }

    async def transfer_funds(
        self, from_account: str, to_account: str, amount: float
    ) -> dict[str, Any]:
        """Transfer funds between internal accounts"""
        await asyncio.sleep(0.5)

        # Simple validation for internal transfers
        if amount <= 0:
            return {
                "success": False,
                "error": "Invalid transfer amount",
                "transaction_id": None,
            }

        if amount > 50000:
            return {
                "success": False,
                "error": "Transfer amount exceeds daily limit",
                "transaction_id": None,
            }

        # Mock successful transfer
        transaction_id = f"TXN-{datetime.now().strftime('%Y%m%d')}-{hash(f'{from_account}{to_account}{amount}') % 10000:04d}"

        return {
            "success": True,
            "transaction_id": transaction_id,
            "from_account": from_account,
            "to_account": to_account,
            "amount": amount,
            "status": "completed",
            "timestamp": datetime.now().isoformat(),
        }

    async def get_account_by_type(self, account_type: str) -> Optional[dict[str, Any]]:
        await asyncio.sleep(0.2)
        for account in self.accounts.values():
            if account.type.lower() == account_type.lower():
                return account.to_dict()
        return None

    async def search_transactions(
        self, account_id: str, search_term: str
    ) -> list[dict[str, Any]]:
        await asyncio.sleep(0.3)

        search_lower = search_term.lower()
        matching = [
            t.to_dict()
            for t in self.transactions
            if t.account_id == account_id and search_lower in t.description.lower()
        ]

        return matching[:20]
