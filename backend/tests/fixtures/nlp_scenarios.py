"""NLP Banking Scenarios - Demonstrating Intent Classification and Entity Extraction"""

# Navigation Assistance Scenarios
NAVIGATION_SCENARIOS = [
    {
        "id": "nav_001",
        "description": "User wants to check balance",
        "query": "Show me my balance",
        "expected_intent": "navigation",
        "expected_action": "navigate_to_balance",
        "expected_screen": "account_balance",
        "confidence_required": 0.7,
        "ui_hint": "auto_navigate"
    },
    {
        "id": "nav_002",
        "description": "Ambiguous navigation request",
        "query": "Take me to transfers",
        "expected_intent": "navigation",
        "expected_action": "navigate_to_transfer",
        "expected_screen": "transfer_form",
        "alternatives": ["transfer_history", "scheduled_transfers"],
        "confidence_required": 0.6,
        "ui_hint": "show_alternatives"
    },
    {
        "id": "nav_003",
        "description": "Settings navigation",
        "query": "I want to change my password",
        "expected_intent": "navigation",
        "expected_action": "navigate_to_security",
        "expected_screen": "security_settings",
        "confidence_required": 0.8,
        "ui_hint": "confirm_navigation"
    },
    {
        "id": "nav_004",
        "description": "Card management navigation",
        "query": "Where do I freeze my card?",
        "expected_intent": "navigation",
        "expected_action": "navigate_to_cards",
        "expected_screen": "card_management",
        "confidence_required": 0.75,
        "ui_hint": "auto_navigate"
    }
]

# Transaction Assistance Scenarios
TRANSACTION_SCENARIOS = [
    {
        "id": "trans_001",
        "description": "Complete transfer with all details",
        "query": "Send $500 to John Smith from my checking",
        "expected_intent": "transfer",
        "expected_entities": {
            "amount": 500.00,
            "recipient": "John Smith",
            "from_account": "checking"
        },
        "validation_status": "ready",
        "confidence_required": 0.9,
        "ui_hint": "show_confirmation"
    },
    {
        "id": "trans_002",
        "description": "Transfer with missing recipient",
        "query": "Transfer $200",
        "expected_intent": "transfer",
        "expected_entities": {
            "amount": 200.00
        },
        "missing_fields": ["recipient", "from_account"],
        "validation_status": "incomplete",
        "confidence_required": 0.7,
        "ui_hint": "progressive_disclosure",
        "follow_up": "Who would you like to send it to?"
    },
    {
        "id": "trans_003",
        "description": "Ambiguous recipient requiring disambiguation",
        "query": "Pay John $100",
        "expected_intent": "transfer",
        "expected_entities": {
            "amount": 100.00,
            "recipient": "John"
        },
        "disambiguation_required": True,
        "disambiguation_options": [
            {"id": "john_smith", "name": "John Smith", "account": "***4567"},
            {"id": "john_doe", "name": "John Doe", "account": "***8901"}
        ],
        "confidence_required": 0.6,
        "ui_hint": "show_disambiguation"
    },
    {
        "id": "trans_004",
        "description": "Bill payment",
        "query": "Pay my electricity bill",
        "expected_intent": "payment",
        "expected_entities": {
            "bill_type": "electricity"
        },
        "validation_status": "needs_amount",
        "confidence_required": 0.75,
        "ui_hint": "fetch_bill_details"
    },
    {
        "id": "trans_005",
        "description": "Recurring payment setup",
        "query": "Set up monthly rent payment of $1500",
        "expected_intent": "recurring",
        "expected_entities": {
            "amount": 1500.00,
            "frequency": "monthly",
            "type": "rent"
        },
        "validation_status": "needs_recipient",
        "confidence_required": 0.8,
        "ui_hint": "multi_step_form"
    }
]

# Context-Aware Scenarios (demonstrating conversation state)
CONTEXT_SCENARIOS = [
    {
        "id": "context_001",
        "description": "Reference resolution with pronouns",
        "conversation": [
            {
                "query": "Send $100 to Sarah Johnson",
                "intent": "transfer",
                "entities": {"amount": 100.00, "recipient": "Sarah Johnson"}
            },
            {
                "query": "Actually, make it $150",
                "expected_resolution": "Send $150 to Sarah Johnson",
                "intent": "transfer",
                "entities": {"amount": 150.00, "recipient": "Sarah Johnson"}
            }
        ]
    },
    {
        "id": "context_002",
        "description": "Context preservation across intents",
        "conversation": [
            {
                "query": "Show me transactions with John",
                "intent": "history",
                "entities": {"recipient": "John"}
            },
            {
                "query": "Send him $50",
                "expected_resolution": "Send $50 to John",
                "intent": "transfer",
                "entities": {"amount": 50.00, "recipient": "John"}
            }
        ]
    },
    {
        "id": "context_003",
        "description": "Multi-turn transaction building",
        "conversation": [
            {
                "query": "I want to transfer money",
                "intent": "transfer",
                "entities": {},
                "ui_response": "How much would you like to transfer?"
            },
            {
                "query": "$250",
                "intent": "transfer",
                "entities": {"amount": 250.00},
                "ui_response": "Who would you like to send it to?"
            },
            {
                "query": "Michael Brown",
                "intent": "transfer",
                "entities": {"amount": 250.00, "recipient": "Michael Brown"},
                "ui_response": "Which account would you like to send from?"
            },
            {
                "query": "My savings",
                "intent": "transfer",
                "entities": {
                    "amount": 250.00,
                    "recipient": "Michael Brown",
                    "from_account": "savings"
                },
                "validation_status": "ready"
            }
        ]
    }
]

# Edge Cases and Error Scenarios
EDGE_CASE_SCENARIOS = [
    {
        "id": "edge_001",
        "description": "Ambiguous amount formats",
        "query": "Send five hundred dollars to Bob",
        "expected_intent": "transfer",
        "expected_entities": {
            "amount": 500.00,
            "recipient": "Bob"
        },
        "confidence_required": 0.7
    },
    {
        "id": "edge_002",
        "description": "Multiple actions in one query",
        "query": "Check my balance and then transfer $100 to Alice",
        "primary_intent": "balance",
        "secondary_intent": "transfer",
        "ui_hint": "sequential_actions"
    },
    {
        "id": "edge_003",
        "description": "Typos and misspellings",
        "query": "Transfr $200 to Jonh",
        "expected_intent": "transfer",
        "expected_entities": {
            "amount": 200.00,
            "recipient": "John"  # Should correct common typos
        },
        "confidence_required": 0.6,
        "ui_hint": "confirm_correction"
    },
    {
        "id": "edge_004",
        "description": "Relative dates and times",
        "query": "Show me transactions from last week",
        "expected_intent": "history",
        "expected_entities": {
            "date_from": "relative:last_week"
        },
        "confidence_required": 0.8
    },
    {
        "id": "edge_005",
        "description": "Negative or invalid amounts",
        "query": "Send -$100 to Mary",
        "expected_intent": "transfer",
        "validation_error": "Invalid amount",
        "ui_hint": "show_error"
    }
]

# Security and Fraud Detection Scenarios
SECURITY_SCENARIOS = [
    {
        "id": "sec_001",
        "description": "High-value transfer requiring extra confirmation",
        "query": "Transfer $10,000 to new recipient",
        "expected_intent": "transfer",
        "security_check": "high_value",
        "requires_2fa": True,
        "ui_hint": "security_verification"
    },
    {
        "id": "sec_002",
        "description": "Suspicious pattern detection",
        "query": "Send all my money to offshore account",
        "expected_intent": "transfer",
        "security_check": "suspicious_pattern",
        "blocked": True,
        "ui_hint": "security_alert"
    },
    {
        "id": "sec_003",
        "description": "Card fraud report",
        "query": "I didn't make this transaction",
        "expected_intent": "dispute",
        "security_check": "fraud_report",
        "ui_hint": "fraud_workflow"
    }
]

# Performance Test Scenarios
PERFORMANCE_SCENARIOS = [
    {
        "id": "perf_001",
        "description": "Simple cached query",
        "query": "Check balance",
        "expected_response_time_ms": 50,
        "should_cache": True
    },
    {
        "id": "perf_002",
        "description": "Complex entity extraction",
        "query": "Transfer $542.37 to William Johnson III at account ending in 4567 with reference 'Rent January 2024'",
        "expected_response_time_ms": 200,
        "should_cache": False
    },
    {
        "id": "perf_003",
        "description": "Batch classification",
        "queries": [
            "Check balance",
            "Send money",
            "Pay bill",
            "Find ATM",
            "Block card"
        ],
        "expected_total_time_ms": 500
    }
]

def get_scenario_by_id(scenario_id: str):
    """Get a specific scenario by ID"""
    all_scenarios = (
        NAVIGATION_SCENARIOS +
        TRANSACTION_SCENARIOS +
        [s for group in CONTEXT_SCENARIOS for s in [group]] +
        EDGE_CASE_SCENARIOS +
        SECURITY_SCENARIOS +
        PERFORMANCE_SCENARIOS
    )

    for scenario in all_scenarios:
        if scenario.get("id") == scenario_id:
            return scenario
    return None

def get_scenarios_by_intent(intent: str):
    """Get all scenarios for a specific intent"""
    scenarios = []

    all_scenarios = (
        NAVIGATION_SCENARIOS +
        TRANSACTION_SCENARIOS +
        EDGE_CASE_SCENARIOS
    )

    for scenario in all_scenarios:
        if scenario.get("expected_intent") == intent or scenario.get("primary_intent") == intent:
            scenarios.append(scenario)

    return scenarios
