#!/bin/bash

# Setup script for LLM providers
# DO NOT put actual API keys in this file!

echo "🔐 LLM Provider Setup"
echo "===================="
echo ""
echo "This script will help you configure LLM providers safely."
echo ""

# Check if .env exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists. Backing up to .env.backup"
    cp .env .env.backup
else
    echo "📝 Creating .env from template..."
    cp .env.example .env
fi

echo ""
echo "Please choose your setup method:"
echo "1) Use environment variables (recommended for production)"
echo "2) Add to .env file (for local development only)"
echo "3) Just use mock provider (no API keys needed)"
echo ""
read -p "Enter choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "✅ Environment Variable Setup"
        echo "Add these to your ~/.zshrc or ~/.bashrc file:"
        echo ""
        echo "export ANTHROPIC_API_KEY='your-key-here'"
        echo "export OPENAI_API_KEY='your-key-here'"
        echo "export LLM_PROVIDER='anthropic'  # or 'openai' or 'mock'"
        echo ""
        echo "Then run: source ~/.zshrc"
        ;;
    2)
        echo ""
        echo "✅ .env File Setup"
        echo "Edit the .env file and add your keys:"
        echo ""
        echo "  nano .env"
        echo ""
        echo "⚠️  IMPORTANT: Never commit .env to git!"
        echo "Checking .gitignore..."
        
        if grep -q "^.env$" .gitignore 2>/dev/null; then
            echo "✅ .env is already in .gitignore"
        else
            echo ".env" >> .gitignore
            echo "✅ Added .env to .gitignore"
        fi
        ;;
    3)
        echo ""
        echo "✅ Mock Provider Setup"
        echo "No API keys needed! The mock provider is already configured."
        echo ""
        # Set mock as default in .env
        sed -i '' 's/^LLM_PROVIDER=.*/LLM_PROVIDER=mock/' .env 2>/dev/null || \
        sed -i 's/^LLM_PROVIDER=.*/LLM_PROVIDER=mock/' .env 2>/dev/null
        echo "Set LLM_PROVIDER=mock in .env"
        ;;
esac

echo ""
echo "📚 Next Steps:"
echo "1. Get your API keys from:"
echo "   - Anthropic: https://console.anthropic.com/settings/keys"
echo "   - OpenAI: https://platform.openai.com/api-keys"
echo ""
echo "2. Test your setup:"
echo "   python example_usage.py"
echo ""
echo "3. Run tests:"
echo "   pytest tests/test_real_llm.py -v"
echo ""
echo "✅ Setup complete!"