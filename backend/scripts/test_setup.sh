#!/bin/bash

echo "🧪 Testing NLP Banking Setup"
echo "============================"
echo ""

# Test Python environment
echo "1. Testing Python environment..."
cd backend
python3 -c "
import sys
sys.path.append('.')
try:
    from src.mock_banking import MockBankingService
    from src.llm_client import MockLLMClient
    from src.cache import MockCache
    print('✅ Python imports working')
except ImportError as e:
    print(f'❌ Import error: {e}')
    sys.exit(1)
"

# Test basic functionality
echo ""
echo "2. Testing basic NLP functionality..."
python3 -c "
import sys
import asyncio
sys.path.append('.')

async def test():
    from src.mock_banking import MockBankingService
    from src.llm_client import MockLLMClient
    from src.entity_extractor import EntityExtractor
    
    # Test banking service
    banking = MockBankingService()
    balance = await banking.get_balance('CHK001')
    print(f'  Account balance: \${balance}')
    
    # Test entity extraction
    llm = MockLLMClient()
    extractor = EntityExtractor(llm)
    entities = extractor._extract_with_patterns('Send \$500 to John')
    print(f'  Extracted entities: {entities}')
    
    return True

result = asyncio.run(test())
if result:
    print('✅ Basic functionality working')
"

echo ""
echo "3. Checking test data..."
cd tests
python3 -c "
import sys
sys.path.append('..')
sys.path.append('.')
try:
    from fixtures.test_data import TestDataFixtures
    print(f'  Test users: {len(TestDataFixtures.TEST_USERS)}')
    print(f'  Test scenarios: {len(TestDataFixtures.TEST_SCENARIOS)}')
    print('✅ Test data accessible')
except ImportError as e:
    print(f'❌ Test data error: {e}')
"

cd ../..
echo ""
echo "✅ Setup verification complete!"