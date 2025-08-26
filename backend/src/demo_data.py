DEMO_SCENARIOS = [
    {
        "id": "simple_balance",
        "name": "Simple Balance Check",
        "description": "Check account balance with various phrasings",
        "queries": [
            "What's my balance?",
            "How much money do I have?",
            "Check my checking account",
            "Show me my savings balance",
        ],
        "expected_intent": "balance",
        "expected_confidence_min": 0.85,
    },
    {
        "id": "transfer_basic",
        "name": "Basic Transfer",
        "description": "Simple money transfer scenarios",
        "queries": [
            "Send $500 to John Smith",
            "Transfer 1000 dollars to Sarah Johnson",
            "Pay Alice Brown $250",
            "Wire $2000 to Bob Wilson from savings",
        ],
        "expected_intent": "transfer",
        "expected_entities": ["amount", "recipient"],
        "expected_confidence_min": 0.90,
    },
    {
        "id": "transfer_disambiguation",
        "name": "Transfer with Disambiguation",
        "description": "Transfers requiring disambiguation",
        "queries": [
            "Send $500 to John",  # Multiple Johns
            "Transfer money to Sarah",  # Missing amount
            "Send $1000",  # Missing recipient
            "Pay someone $500",  # Vague recipient
        ],
        "expected_intent": "transfer",
        "requires_disambiguation": True,
    },
    {
        "id": "context_resolution",
        "name": "Context Resolution",
        "description": "Queries using contextual references",
        "sequence": [
            {"query": "Send $500 to John Smith", "expected_intent": "transfer"},
            {
                "query": "Send another $200 to him",
                "expected_resolution": "Send another $200 to John Smith",
                "expected_intent": "transfer",
            },
            {
                "query": "Send the same amount to Sarah",
                "expected_resolution": "Send $200 to Sarah",
                "expected_intent": "transfer",
            },
        ],
    },
    {
        "id": "transaction_history",
        "name": "Transaction History",
        "description": "Viewing transaction history with filters",
        "queries": [
            "Show my recent transactions",
            "What did I spend last week?",
            "Show transactions from last month",
            "Find payments to Grocery Store",
        ],
        "expected_intent": "history",
    },
    {
        "id": "navigation",
        "name": "Navigation Assistance",
        "description": "Navigate to different sections",
        "queries": [
            "Take me to transfers",
            "Go to my account settings",
            "Show me the transaction history",
            "Navigate to help section",
        ],
        "expected_intent": "navigation",
    },
    {
        "id": "complex_queries",
        "name": "Complex Multi-Part Queries",
        "description": "Queries with multiple components",
        "queries": [
            "Check my balance and then send $500 to John",
            "Transfer $1000 from savings to checking",
            "Show me how much I sent to Sarah last month",
            "Pay my rent of $1500 to Property Management from checking",
        ],
    },
    {
        "id": "error_scenarios",
        "name": "Error Handling",
        "description": "Scenarios that should trigger errors",
        "queries": [
            "Send $50000 to John",  # Exceeds balance
            "Transfer -100 dollars",  # Negative amount
            "Send money to Unknown Person",  # Non-existent recipient
            "Check my bitcoin balance",  # Unsupported account
        ],
        "expected_errors": True,
    },
    {
        "id": "confidence_levels",
        "name": "Confidence Level Testing",
        "description": "Test different confidence thresholds",
        "queries": [
            {
                "query": "balance",  # Very simple
                "expected_confidence_range": [0.95, 1.0],
            },
            {
                "query": "maybe check my balance",  # Uncertain
                "expected_confidence_range": [0.70, 0.85],
            },
            {
                "query": "i think i want to possibly transfer some money",  # Very uncertain
                "expected_confidence_range": [0.50, 0.70],
            },
        ],
    },
    {
        "id": "date_handling",
        "name": "Date and Time Handling",
        "description": "Queries with date references",
        "queries": [
            "Show transactions from yesterday",
            "What did I spend today?",
            "Show last week's transfers",
            "Get transactions from 01/15/2024 to 01/31/2024",
        ],
        "expected_intent": "history",
        "expected_entities": ["date_from", "date_to"],
    },
    {
        "id": "amount_formats",
        "name": "Various Amount Formats",
        "description": "Different ways to express amounts",
        "queries": [
            "Send five hundred dollars to John",
            "Transfer $1,500.50 to Sarah",
            "Pay 2k to Bob",
            "Send 100.99 to Alice",
        ],
        "expected_intent": "transfer",
        "validate_amount_parsing": True,
    },
    {
        "id": "progressive_disclosure",
        "name": "Progressive Information Disclosure",
        "description": "Completing actions step by step",
        "sequence": [
            {
                "query": "I want to send money",
                "expected_intent": "transfer",
                "expected_missing": ["amount", "recipient"],
            },
            {
                "query": "$500",
                "completes_pending": True,
                "expected_missing": ["recipient"],
            },
            {"query": "John Smith", "completes_pending": True, "expected_missing": []},
        ],
    },
]


PERFORMANCE_BENCHMARKS = {
    "intent_classification": {
        "target_latency_p50_ms": 500,
        "target_latency_p95_ms": 1500,
        "target_accuracy": 0.85,
    },
    "entity_extraction": {
        "target_latency_p50_ms": 300,
        "target_latency_p95_ms": 1000,
        "target_accuracy": 0.90,
    },
    "end_to_end_pipeline": {
        "target_latency_p50_ms": 1000,
        "target_latency_p95_ms": 2000,
        "target_success_rate": 0.95,
    },
    "websocket": {"target_connection_time_ms": 100, "target_message_latency_ms": 50},
}


TEST_USERS = [
    {
        "id": "test_user_1",
        "name": "Test User 1",
        "accounts": [
            {"type": "checking", "balance": 5000.00},
            {"type": "savings", "balance": 15000.00},
        ],
    },
    {
        "id": "test_user_2",
        "name": "Test User 2",
        "accounts": [
            {"type": "checking", "balance": 2500.00},
            {"type": "savings", "balance": 10000.00},
            {"type": "business", "balance": 25000.00},
        ],
    },
]
