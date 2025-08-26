"""Comprehensive test data fixtures for E2E testing"""
import uuid
from datetime import datetime, timedelta
from typing import Any


class TestDataFixtures:
    """Central repository of test data for E2E testing"""

    # Test Users
    TEST_USERS = [
        {
            "id": "user_001",
            "name": "Alice Johnson",
            "email": "alice@test.com",
            "accounts": [
                {
                    "id": "CHK001",
                    "type": "checking",
                    "name": "Primary Checking",
                    "balance": 5234.56,
                    "currency": "USD"
                },
                {
                    "id": "SAV001",
                    "type": "savings",
                    "name": "Emergency Fund",
                    "balance": 15678.90,
                    "currency": "USD"
                }
            ],
            "recipients": [
                {"id": "RCP001", "name": "Bob Smith", "account": "9876543210"},
                {"id": "RCP002", "name": "Carol White", "account": "1234567890"},
                {"id": "RCP003", "name": "David Brown", "account": "5555555555"}
            ]
        },
        {
            "id": "user_002",
            "name": "Bob Martinez",
            "email": "bob@test.com",
            "accounts": [
                {
                    "id": "CHK002",
                    "type": "checking",
                    "name": "Business Checking",
                    "balance": 25000.00,
                    "currency": "USD"
                },
                {
                    "id": "SAV002",
                    "type": "savings",
                    "name": "Business Savings",
                    "balance": 50000.00,
                    "currency": "USD"
                },
                {
                    "id": "CRD001",
                    "type": "credit",
                    "name": "Business Credit",
                    "balance": -2500.00,
                    "currency": "USD",
                    "credit_limit": 10000.00
                }
            ],
            "recipients": [
                {"id": "RCP004", "name": "Supplier Co", "account": "1111111111"},
                {"id": "RCP005", "name": "Alice Johnson", "account": "2222222222"},
                {"id": "RCP006", "name": "Tax Authority", "account": "3333333333"}
            ]
        }
    ]

    # Test Scenarios with Expected Outcomes
    TEST_SCENARIOS = [
        {
            "id": "scenario_001",
            "name": "Simple Balance Check",
            "description": "User checks their checking account balance",
            "user": "user_001",
            "steps": [
                {
                    "action": "query",
                    "input": "What's my checking account balance?",
                    "expected": {
                        "intent": "balance",
                        "confidence_min": 0.9,
                        "entities": {"account_type": "checking"},
                        "response_contains": ["5234.56", "checking"]
                    }
                }
            ]
        },
        {
            "id": "scenario_002",
            "name": "Complete Transfer Flow",
            "description": "User transfers money with all details",
            "user": "user_001",
            "steps": [
                {
                    "action": "query",
                    "input": "Transfer $500 from checking to Bob Smith for rent",
                    "expected": {
                        "intent": "transfer",
                        "confidence_min": 0.85,
                        "entities": {
                            "amount": 500.00,
                            "recipient": "Bob Smith",
                            "from_account": "checking",
                            "reference": "rent"
                        },
                        "can_execute": True
                    }
                },
                {
                    "action": "confirm",
                    "expected": {
                        "success": True,
                        "new_balance": 4734.56
                    }
                }
            ]
        },
        {
            "id": "scenario_003",
            "name": "Progressive Disclosure",
            "description": "User provides information step by step",
            "user": "user_001",
            "steps": [
                {
                    "action": "query",
                    "input": "I want to send money",
                    "expected": {
                        "intent": "transfer",
                        "missing_fields": ["amount", "recipient"],
                        "prompt_for_missing": True
                    }
                },
                {
                    "action": "query",
                    "input": "$750",
                    "expected": {
                        "completed_pending": True,
                        "entities": {"amount": 750.00},
                        "missing_fields": ["recipient"]
                    }
                },
                {
                    "action": "query",
                    "input": "Carol White",
                    "expected": {
                        "completed_pending": True,
                        "entities": {
                            "amount": 750.00,
                            "recipient": "Carol White"
                        },
                        "can_execute": True
                    }
                }
            ]
        },
        {
            "id": "scenario_004",
            "name": "Context Resolution",
            "description": "Using pronouns and references",
            "user": "user_001",
            "steps": [
                {
                    "action": "query",
                    "input": "Send $200 to David Brown",
                    "expected": {
                        "intent": "transfer",
                        "entities": {
                            "amount": 200.00,
                            "recipient": "David Brown"
                        }
                    }
                },
                {
                    "action": "query",
                    "input": "Send another $100 to him",
                    "expected": {
                        "intent": "transfer",
                        "entities": {
                            "amount": 100.00,
                            "recipient": "David Brown"
                        },
                        "resolved_query_contains": "David Brown"
                    }
                },
                {
                    "action": "query",
                    "input": "Send the same amount to Carol",
                    "expected": {
                        "intent": "transfer",
                        "entities": {
                            "amount": 100.00,
                            "recipient": "Carol"
                        }
                    }
                }
            ]
        },
        {
            "id": "scenario_005",
            "name": "Disambiguation Flow",
            "description": "Multiple matches requiring user selection",
            "user": "user_002",
            "steps": [
                {
                    "action": "query",
                    "input": "Pay $1000 to Alice",
                    "expected": {
                        "intent": "transfer",
                        "entities": {"amount": 1000.00},
                        "disambiguations": {
                            "recipient": ["Alice Johnson", "Alice Cooper"]
                        },
                        "requires_confirmation": True
                    }
                },
                {
                    "action": "select_disambiguation",
                    "selection": "Alice Johnson",
                    "expected": {
                        "entities": {
                            "amount": 1000.00,
                            "recipient": "Alice Johnson"
                        },
                        "can_execute": True
                    }
                }
            ]
        },
        {
            "id": "scenario_006",
            "name": "Transaction History",
            "description": "Viewing past transactions with filters",
            "user": "user_001",
            "steps": [
                {
                    "action": "query",
                    "input": "Show my transactions from last week",
                    "expected": {
                        "intent": "history",
                        "entities": {
                            "date_from": "dynamic:last_week",
                            "date_to": "dynamic:today"
                        },
                        "response_contains": ["transactions", "date"]
                    }
                },
                {
                    "action": "query",
                    "input": "Filter by amounts over $100",
                    "expected": {
                        "filters_applied": True,
                        "min_amount": 100.00
                    }
                }
            ]
        },
        {
            "id": "scenario_007",
            "name": "Error Handling - Insufficient Funds",
            "description": "Attempting transfer with insufficient balance",
            "user": "user_001",
            "steps": [
                {
                    "action": "query",
                    "input": "Transfer $10000 from checking to Bob Smith",
                    "expected": {
                        "intent": "transfer",
                        "validation": {
                            "valid": False,
                            "error": "Insufficient funds",
                            "available_balance": 5234.56
                        },
                        "can_execute": False
                    }
                }
            ]
        },
        {
            "id": "scenario_008",
            "name": "Navigation Assistance",
            "description": "User navigates through the app",
            "user": "user_001",
            "steps": [
                {
                    "action": "query",
                    "input": "Take me to transfers",
                    "expected": {
                        "intent": "navigation",
                        "entities": {"destination": "transfers"},
                        "navigation": "/transfer"
                    }
                },
                {
                    "action": "query",
                    "input": "Go to account settings",
                    "expected": {
                        "intent": "navigation",
                        "entities": {"destination": "settings"},
                        "navigation": "/settings"
                    }
                }
            ]
        },
        {
            "id": "scenario_009",
            "name": "Multi-Account Operations",
            "description": "Operations across multiple accounts",
            "user": "user_002",
            "steps": [
                {
                    "action": "query",
                    "input": "Transfer $5000 from business savings to business checking",
                    "expected": {
                        "intent": "transfer",
                        "entities": {
                            "amount": 5000.00,
                            "from_account": "savings",
                            "to_account": "checking"
                        },
                        "internal_transfer": True
                    }
                },
                {
                    "action": "query",
                    "input": "Pay off my credit card from checking",
                    "expected": {
                        "intent": "transfer",
                        "entities": {
                            "to_account": "credit",
                            "from_account": "checking"
                        },
                        "suggested_amount": 2500.00
                    }
                }
            ]
        },
        {
            "id": "scenario_010",
            "name": "Complex Query Processing",
            "description": "Multi-part queries with complex requirements",
            "user": "user_001",
            "steps": [
                {
                    "action": "query",
                    "input": "Check my balance and then transfer $300 to Bob if I have enough",
                    "expected": {
                        "multi_intent": True,
                        "intents": ["balance", "transfer"],
                        "conditional_execution": True
                    }
                }
            ]
        }
    ]

    # Transaction History Test Data
    @staticmethod
    def generate_transaction_history(account_id: str, days: int = 30) -> list[dict[str, Any]]:
        """Generate realistic transaction history"""
        transactions = []
        merchants = [
            ("Starbucks", -4.50, "coffee"),
            ("Walmart", -125.67, "groceries"),
            ("Shell Gas Station", -45.00, "fuel"),
            ("Amazon", -89.99, "online shopping"),
            ("Netflix", -15.99, "subscription"),
            ("Electric Company", -150.00, "utilities"),
            ("Direct Deposit", 2500.00, "salary"),
            ("ATM Withdrawal", -200.00, "cash"),
            ("Restaurant", -65.00, "dining"),
            ("Uber", -18.50, "transportation")
        ]

        for i in range(days * 3):  # ~3 transactions per day
            merchant, amount, category = merchants[i % len(merchants)]
            date = datetime.now() - timedelta(days=days - (i // 3))

            transactions.append({
                "id": f"TRX{uuid.uuid4().hex[:8]}",
                "date": date.isoformat(),
                "merchant": merchant,
                "amount": amount * (1 + (i % 5) * 0.1),  # Vary amounts
                "category": category,
                "account_id": account_id,
                "status": "completed"
            })

        return sorted(transactions, key=lambda x: x["date"], reverse=True)

    # WebSocket Test Messages
    WEBSOCKET_MESSAGES = [
        {
            "type": "query",
            "query": "What's my balance?",
            "expected_response": {
                "type": "result",
                "data": {
                    "intent": "balance",
                    "confidence_min": 0.8
                }
            }
        },
        {
            "type": "ping",
            "expected_response": {"type": "pong"}
        },
        {
            "type": "disambiguation",
            "field": "recipient",
            "selection": {"id": "RCP001", "name": "Bob Smith"},
            "expected_response": {
                "type": "disambiguation_resolved",
                "field": "recipient"
            }
        }
    ]

    # Performance Benchmarks
    PERFORMANCE_TARGETS = {
        "page_load": 2000,  # ms
        "api_response_p50": 500,  # ms
        "api_response_p95": 1500,  # ms
        "websocket_latency": 100,  # ms
        "ui_interaction": 200,  # ms
        "search_results": 300  # ms
    }

    @classmethod
    def get_test_user(cls, user_id: str) -> dict[str, Any]:
        """Get test user by ID"""
        for user in cls.TEST_USERS:
            if user["id"] == user_id:
                return user
        return None

    @classmethod
    def get_scenario(cls, scenario_id: str) -> dict[str, Any]:
        """Get test scenario by ID"""
        for scenario in cls.TEST_SCENARIOS:
            if scenario["id"] == scenario_id:
                return scenario
        return None
