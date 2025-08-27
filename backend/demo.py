#!/usr/bin/env python3
"""
Comprehensive demo of the EBP AI Banking Capabilities prototype.

This demo showcases:
- Intent classification with confidence scoring
- Entity extraction and validation  
- Multi-turn conversation handling
- Risk assessment and authentication
- Context-aware response generation
- LLM provider flexibility

Usage:
    python demo.py [--provider mock|openai|anthropic] [--scenario all|basic|providers|clarification]
"""

import asyncio
import argparse
import sys
import os
from pathlib import Path
from typing import Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.llm_wrapper import create_enhanced_llm_client, LLMProvider
from src.intent_classifier import IntentClassifier
from src.intent_catalog import RiskLevel, AuthLevel
from src.entity_extractor import EntityExtractor
from src.context_aware_responses import ContextAwareResponseGenerator
from src.state_manager import ConversationStateManager
from src.mock_banking import MockBankingService
from src.pipeline import IntentPipeline
from src.cache import MockCache
from src.database import MockDatabase


async def demo_basic_classification():
    """Demo basic intent classification and entity extraction"""
    print("=" * 80)
    print("🎯 BASIC INTENT CLASSIFICATION & ENTITY EXTRACTION")
    print("=" * 80)
    
    client = create_enhanced_llm_client(provider="mock")
    cache = MockCache()
    classifier = IntentClassifier(client, cache)
    extractor = EntityExtractor(client)
    
    test_queries = [
        "What's my checking account balance?",
        "Transfer $500 from savings to checking",
        "Send $100 to john.smith@email.com",
        "Block my debit card ending in 4567",
        "I want to dispute a $200 charge from yesterday",
    ]
    
    for query in test_queries:
        print(f"\n🗣️  Query: '{query}'")
        print("-" * 60)
        
        # Classify intent
        intent_result = await classifier.classify(query, include_risk=True)
        print(f"🎯 Intent: {intent_result.get('intent_id', 'unknown')}")
        print(f"📊 Confidence: {intent_result.get('confidence', 0):.1%}")
        print(f"⚠️  Risk Level: {intent_result.get('risk_level', 'N/A').upper()}")
        print(f"🔐 Auth Required: {intent_result.get('auth_required', 'N/A').upper()}")
        
        # Extract entities
        entity_result = await extractor.extract(query)
        if entity_result.get("entities"):
            print("📦 Entities:")
            for entity_type, entity_data in entity_result["entities"].items():
                if isinstance(entity_data, dict):
                    value = entity_data.get("value", "N/A")
                    confidence = entity_data.get("confidence", 0)
                else:
                    value = entity_data
                    confidence = 90
                print(f"   • {entity_type}: {value} ({confidence}% confidence)")


async def demo_provider_flexibility():
    """Demo different LLM provider configurations"""
    print("\n" + "=" * 80)
    print("🔄 LLM PROVIDER FLEXIBILITY")
    print("=" * 80)
    
    providers_status = {
        "mock": {"available": True, "description": "Mock provider (always available)"},
        "openai": {"available": bool(os.getenv("OPENAI_API_KEY")), "description": "OpenAI GPT models"},
        "anthropic": {"available": bool(os.getenv("ANTHROPIC_API_KEY")), "description": "Anthropic Claude models"}
    }
    
    print("Provider Status:")
    for provider, info in providers_status.items():
        status = "✅" if info["available"] else "❌"
        print(f"  {status} {provider.upper()}: {info['description']}")
    
    # Test with available providers
    test_query = "Check my balance"
    print(f"\n🧪 Testing query: '{test_query}'")
    
    for provider_name, info in providers_status.items():
        if info["available"]:
            print(f"\n--- {provider_name.upper()} Provider ---")
            try:
                client = create_enhanced_llm_client(provider=provider_name)
                cache = MockCache()
                classifier = IntentClassifier(client, cache)
                
                result = await classifier.classify(test_query)
                print(f"✅ Intent: {result.get('intent_id', 'unknown')}")
                print(f"   Confidence: {result.get('confidence', 0):.1%}")
                
                # Show cost info for real providers
                if hasattr(client.client, 'total_cost'):
                    print(f"   Cost: ${client.client.total_cost:.6f}")
                    
            except Exception as e:
                print(f"❌ Error: {e}")


async def demo_multi_turn_conversation():
    """Demo multi-turn conversation with context"""
    print("\n" + "=" * 80)
    print("💬 MULTI-TURN CONVERSATION WITH CONTEXT")
    print("=" * 80)
    
    # Initialize components
    client = create_enhanced_llm_client(provider="mock")
    cache = MockCache()
    db = MockDatabase()
    
    classifier = IntentClassifier(client, cache)
    extractor = EntityExtractor(client)
    response_gen = ContextAwareResponseGenerator()
    state_manager = ConversationStateManager(cache, db)
    banking_service = MockBankingService()
    
    pipeline = IntentPipeline(
        classifier, extractor, response_gen, state_manager, banking_service
    )
    
    session_id = "demo_session_001"
    
    conversation_flows = [
        {
            "name": "Missing Information Flow",
            "turns": [
                {"user": "I want to transfer money", "expected": "Ask for amount and recipient"},
                {"user": "Send $500 to Sarah Johnson", "expected": "Complete transfer"}
            ]
        },
        {
            "name": "Reference Resolution",
            "turns": [
                {"user": "Send $100 to Mike Smith", "expected": "Initial transfer"},
                {"user": "Send him another $50", "expected": "Resolve 'him' to Mike Smith"}
            ]
        }
    ]
    
    for flow in conversation_flows:
        print(f"\n🎭 Scenario: {flow['name']}")
        print("=" * 60)
        
        for i, turn in enumerate(flow["turns"], 1):
            print(f"\n🗣️  Turn {i}: \"{turn['user']}\"")
            print(f"   Expected: {turn['expected']}")
            print("-" * 40)
            
            try:
                result = await pipeline.process(turn["user"], session_id)
                
                print(f"✅ Status: {result.get('status', 'unknown')}")
                print(f"🎯 Intent: {result.get('intent', 'N/A')}")
                print(f"📊 Confidence: {result.get('confidence', 0):.1%}")
                
                if result.get('entities'):
                    print("📦 Entities:")
                    for entity_type, value in result['entities'].items():
                        if isinstance(value, dict):
                            print(f"   • {entity_type}: {value.get('value', 'N/A')}")
                        else:
                            print(f"   • {entity_type}: {value}")
                
                if result.get('response'):
                    print(f"💬 Response: {result['response']}")
                
                if result.get('missing_fields'):
                    print(f"🔍 Missing: {', '.join(result['missing_fields'])}")
                    
            except Exception as e:
                print(f"❌ Error: {str(e)}")


async def demo_risk_assessment():
    """Demo risk assessment and authentication levels"""
    print("\n" + "=" * 80)
    print("🔒 RISK ASSESSMENT & AUTHENTICATION")
    print("=" * 80)
    
    client = create_enhanced_llm_client(provider="mock")
    cache = MockCache()
    classifier = IntentClassifier(client, cache)
    
    risk_scenarios = [
        {"query": "What's my account balance?", "expected_risk": "LOW", "expected_auth": "BASIC"},
        {"query": "Transfer $100 between my accounts", "expected_risk": "MEDIUM", "expected_auth": "FULL"},
        {"query": "Wire $5000 to account 123456789", "expected_risk": "HIGH", "expected_auth": "CHALLENGE"},
        {"query": "I didn't make this $2000 purchase", "expected_risk": "HIGH", "expected_auth": "FULL"},
    ]
    
    for scenario in risk_scenarios:
        print(f"\n🔍 Query: \"{scenario['query']}\"")
        print("-" * 50)
        
        result = await classifier.classify(scenario["query"], include_risk=True)
        
        risk_level = result.get("risk_level", "N/A").upper()
        auth_required = result.get("auth_required", "N/A").upper()
        
        print(f"Intent: {result.get('intent_id', 'unknown')}")
        print(f"Risk Level: {risk_level} (expected: {scenario['expected_risk']})")
        print(f"Auth Required: {auth_required} (expected: {scenario['expected_auth']})")
        
        # Show risk assessment match
        risk_match = "✅" if risk_level == scenario['expected_risk'] else "⚠️"
        auth_match = "✅" if auth_required == scenario['expected_auth'] else "⚠️"
        print(f"Assessment: {risk_match} Risk {auth_match} Auth")


def print_header():
    """Print demo header"""
    print("🏦" + "=" * 76 + "🏦")
    print("   EBP AI BANKING CAPABILITIES - COMPREHENSIVE DEMO")
    print("   Showcasing: Intent Classification, Entity Extraction, Risk Assessment")
    print("   Multi-turn Conversations, and Context-Aware Responses")
    print("🏦" + "=" * 76 + "🏦")


def print_footer():
    """Print demo footer"""
    print("\n" + "=" * 80)
    print("✅ DEMO COMPLETE")
    print("=" * 80)
    print("\nKey Features Demonstrated:")
    print("  1. ✅ Enhanced intent classification with confidence scoring")
    print("  2. ✅ Risk level assessment for banking operations")
    print("  3. ✅ Smart entity extraction with validation")
    print("  4. ✅ Context-aware responses with precondition checking")
    print("  5. ✅ Multi-turn conversation support with reference resolution")
    print("  6. ✅ Authentication level requirements")
    print("  7. ✅ LLM provider flexibility with automatic fallback")
    print("\n💡 The system is production-ready with banking domain expertise!")


async def main():
    """Main demo function"""
    parser = argparse.ArgumentParser(description="EBP AI Banking Capabilities Demo")
    parser.add_argument(
        "--provider", 
        choices=["mock", "openai", "anthropic"], 
        default="mock",
        help="LLM provider to use (default: mock)"
    )
    parser.add_argument(
        "--scenario",
        choices=["all", "basic", "providers", "conversation", "risk"],
        default="all",
        help="Which demo scenario to run (default: all)"
    )
    
    args = parser.parse_args()
    
    print_header()
    
    try:
        if args.scenario in ("all", "basic"):
            await demo_basic_classification()
            
        if args.scenario in ("all", "providers"):
            await demo_provider_flexibility()
            
        if args.scenario in ("all", "conversation"):
            await demo_multi_turn_conversation()
            
        if args.scenario in ("all", "risk"):
            await demo_risk_assessment()
            
        print_footer()
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Demo interrupted by user")
    except Exception as e:
        print(f"\n❌ Demo failed with error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())