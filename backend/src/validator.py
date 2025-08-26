from datetime import datetime, timedelta
from typing import Any, Optional

from .mock_banking import MockBankingService


class EntityValidator:
    def __init__(self, banking_service: MockBankingService):
        self.banking = banking_service
        self.required_fields = {
            "transfer": ["amount", "recipient"],
            "balance": [],
            "history": [],
            "payment": ["amount", "payee"],
            "navigation": ["destination"],
        }

        self.validation_rules = {
            "amount": self._validate_amount,
            "recipient": self._validate_recipient,
            "from_account": self._validate_account,
            "to_account": self._validate_account,
            "account": self._validate_account,
            "date_from": self._validate_date,
            "date_to": self._validate_date,
            "due_date": self._validate_date,
        }

    async def validate(
        self,
        entities: dict[str, Any],
        intent_type: str,
        context: Optional[dict[str, Any]] = None,
    ) -> dict[str, Any]:
        validation_result = {
            "valid": True,
            "missing_fields": [],
            "invalid_fields": {},
            "warnings": [],
            "suggestions": {},
            "disambiguations": {},
        }

        required = self.required_fields.get(intent_type, [])
        for field in required:
            if field not in entities or entities[field] is None:
                validation_result["missing_fields"].append(field)
                validation_result["valid"] = False

        for field, value in entities.items():
            if field in self.validation_rules:
                field_result = await self.validation_rules[field](value)

                if not field_result["valid"]:
                    validation_result["invalid_fields"][field] = field_result["error"]
                    validation_result["valid"] = False

                if field_result.get("warning"):
                    validation_result["warnings"].append(field_result["warning"])

                if field_result.get("suggestion"):
                    validation_result["suggestions"][field] = field_result["suggestion"]

        if intent_type == "transfer":
            await self._validate_transfer_specific(entities, validation_result, context)
        elif intent_type == "history":
            self._validate_history_specific(entities, validation_result)

        return validation_result

    async def _validate_amount(self, amount: Any) -> dict[str, Any]:
        try:
            amount_float = float(amount)

            if amount_float <= 0:
                return {"valid": False, "error": "Amount must be positive"}

            if amount_float > 1000000:
                return {"valid": False, "error": "Amount exceeds maximum limit"}

            if amount_float > 10000:
                return {
                    "valid": True,
                    "warning": "Large transfer amount - additional verification may be required",
                }

            return {"valid": True}

        except (ValueError, TypeError):
            return {"valid": False, "error": f"Invalid amount format: {amount}"}

    async def _validate_recipient(self, recipient: str) -> dict[str, Any]:
        if not recipient or len(recipient.strip()) < 2:
            return {"valid": False, "error": "Recipient name too short"}

        recipients = await self.banking.search_recipients(recipient)

        if len(recipients) == 0:
            return {
                "valid": False,
                "error": f"Recipient '{recipient}' not found",
                "suggestion": "Please add recipient first or check spelling",
            }

        if len(recipients) > 1:
            return {
                "valid": True,
                "warning": f"Multiple recipients found matching '{recipient}'",
                "disambiguations": recipients,
            }

        return {"valid": True, "matched_recipient": recipients[0]}

    async def _validate_account(self, account: str) -> dict[str, Any]:
        if not account:
            return {"valid": False, "error": "Account not specified"}

        account_lower = account.lower()

        standard_accounts = ["checking", "savings", "credit", "business"]
        if account_lower in standard_accounts:
            account_data = await self.banking.get_account_by_type(account_lower)
            if account_data:
                return {"valid": True, "account_id": account_data["id"]}
            else:
                return {"valid": False, "error": f"No {account} account found"}

        account_data = await self.banking.get_account(account)
        if account_data:
            return {"valid": True}

        return {
            "valid": False,
            "error": f"Account '{account}' not found",
            "suggestion": f"Available accounts: {', '.join(standard_accounts)}",
        }

    def _validate_date(self, date_str: str) -> dict[str, Any]:
        try:
            date = datetime.strptime(date_str, "%Y-%m-%d")

            if date > datetime.now() + timedelta(days=365):
                return {"valid": False, "error": "Date too far in the future"}

            if date < datetime.now() - timedelta(days=365 * 5):
                return {"valid": False, "error": "Date too far in the past"}

            return {"valid": True}

        except ValueError:
            return {
                "valid": False,
                "error": f"Invalid date format: {date_str}. Use YYYY-MM-DD",
            }

    async def _validate_transfer_specific(
        self,
        entities: dict[str, Any],
        validation_result: dict[str, Any],
        context: Optional[dict[str, Any]],
    ):
        if "amount" in entities and "from_account" in entities:
            from_account = entities.get("from_account", "checking")

            if from_account in ["checking", "savings"]:
                account = await self.banking.get_account_by_type(from_account)
                if account:
                    from_account_id = account["id"]
                else:
                    from_account_id = "CHK001"
            else:
                from_account_id = entities["from_account"]

            balance = await self.banking.get_balance(from_account_id)

            if balance is not None:
                amount = entities["amount"]
                if amount > balance:
                    validation_result["invalid_fields"][
                        "amount"
                    ] = f"Insufficient funds. Available: ${balance:.2f}"
                    validation_result["valid"] = False
                elif amount > balance * 0.9:
                    validation_result["warnings"].append(
                        f"This transfer will use {(amount/balance)*100:.1f}% of available balance"
                    )

        if "recipient" in entities:
            recipients = await self.banking.search_recipients(entities["recipient"])
            if len(recipients) > 1:
                validation_result["disambiguations"]["recipient"] = recipients
                validation_result["warnings"].append(
                    f"Multiple recipients match '{entities['recipient']}'"
                )

    def _validate_history_specific(
        self, entities: dict[str, Any], validation_result: dict[str, Any]
    ):
        if "date_from" in entities and "date_to" in entities:
            try:
                date_from = datetime.strptime(entities["date_from"], "%Y-%m-%d")
                date_to = datetime.strptime(entities["date_to"], "%Y-%m-%d")

                if date_from > date_to:
                    validation_result["invalid_fields"][
                        "date_range"
                    ] = "Start date must be before end date"
                    validation_result["valid"] = False

                    validation_result["suggestions"]["swap_dates"] = {
                        "date_from": entities["date_to"],
                        "date_to": entities["date_from"],
                    }

                if (date_to - date_from).days > 365:
                    validation_result["warnings"].append(
                        "Date range spans more than 1 year - results may be limited"
                    )

            except ValueError:
                pass

    async def validate_batch(
        self,
        entity_list: list[dict[str, Any]],
        intent_types: list[str],
        context: Optional[dict[str, Any]] = None,
    ) -> list[dict[str, Any]]:
        results = []

        for entities, intent_type in zip(entity_list, intent_types, strict=False):
            result = await self.validate(entities, intent_type, context)
            results.append(result)

        return results

    def get_missing_field_prompts(
        self, intent_type: str, missing_fields: list[str]
    ) -> list[str]:
        prompts = {
            "amount": "How much would you like to transfer?",
            "recipient": "Who would you like to send money to?",
            "from_account": "Which account would you like to transfer from?",
            "payee": "Who or what would you like to pay?",
            "destination": "Where would you like to go?",
            "account": "Which account would you like to check?",
        }

        return [
            prompts.get(field, f"Please provide {field}") for field in missing_fields
        ]
