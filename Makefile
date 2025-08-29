# EBP AI Banking Capabilities - Makefile
# ===========================================

.PHONY: help setup install test lint format clean demo api mcp frontend start

# Default Python and paths
PYTHON := python3
BACKEND_DIR := backend
SCRIPTS_DIR := scripts
BACKEND_SCRIPTS_DIR := $(BACKEND_DIR)/scripts
VENV_DIR := $(BACKEND_DIR)/venv

# Use system Python consistently
PIP := $(PYTHON) -m pip

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
BLUE := \033[0;34m
NC := \033[0m

help: ## Show this help message
	@echo "EBP AI Banking Capabilities - Make Targets"
	@echo "==========================================="
	@echo ""
	@echo "Setup & Installation:"
	@echo "  setup     - Complete project setup (install + configure)"
	@echo "  install   - Install dependencies and create virtual environment"
	@echo "  clean     - Clean up generated files and cache"
	@echo ""
	@echo "Development:"
	@echo "  lint      - Run code linting (ruff)"
	@echo "  format    - Format code and fix linting issues"
	@echo "  test      - Run all tests"
	@echo "  test-unit - Run unit tests only"
	@echo "  test-api  - Run API integration tests"
	@echo "  test-e2e  - Run end-to-end tests"
	@echo ""
	@echo "Demos & Examples:"
	@echo "  demo      - Run comprehensive demo"
	@echo "  demo-basic      - Run basic classification demo"
	@echo "  demo-providers  - Run LLM provider flexibility demo"
	@echo "  demo-conversation - Run multi-turn conversation demo"
	@echo "  demo-risk       - Run risk assessment demo"
	@echo ""
	@echo "Services:"
	@echo "  api       - Start the API server"
	@echo "  mcp       - Start the MCP server"
	@echo "  frontend  - Start the frontend development server"
	@echo "  start     - Start both frontend and backend (default ports)"
	@echo "  start-ports - Start with custom ports (BACKEND_PORT=8000 FRONTEND_PORT=3001)"
	@echo ""
	@echo "Testing:"
	@echo "  test         - Run all tests"
	@echo "  test-unit    - Run unit tests only"
	@echo "  test-api     - Run API integration tests"
	@echo "  test-e2e     - Run end-to-end tests"
	@echo "  test-e2e-debug     - Run E2E tests in debug mode"
	@echo "  test-e2e-headed    - Run E2E tests with visible browser"
	@echo "  test-e2e-chrome    - Run E2E tests in Chrome only"
	@echo "  test-mcp     - Test MCP server functionality"
	@echo "  test-mcp-comprehensive - Run comprehensive MCP and intent testing"

setup: install ## Complete project setup
	@echo "$(GREEN)✅ Project setup complete!$(NC)"
	@echo "$(BLUE)Next steps:$(NC)"
	@echo "  • Run 'make demo' to see the system in action"
	@echo "  • Run 'make api' to start the API server"
	@echo "  • Run 'make test' to run all tests"

install: ## Install dependencies and setup environment
	@echo "$(BLUE)📦 Installing dependencies...$(NC)"
	@if [ ! -d "$(VENV_DIR)" ]; then \
		echo "Creating virtual environment..."; \
		cd $(BACKEND_DIR) && $(PYTHON) -m venv venv; \
	fi
	@cd $(BACKEND_DIR) && $(PYTHON) -m pip install --upgrade pip
	@cd $(BACKEND_DIR) && $(PYTHON) -m pip install -r ../requirements.txt
	@echo "$(GREEN)✅ Dependencies installed$(NC)"

clean: ## Clean up generated files and cache
	@echo "$(YELLOW)🧹 Cleaning up...$(NC)"
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@find . -name "*.pyc" -delete 2>/dev/null || true
	@find . -name "*.pyo" -delete 2>/dev/null || true
	@find . -name ".DS_Store" -delete 2>/dev/null || true
	@rm -rf $(BACKEND_DIR)/.pytest_cache 2>/dev/null || true
	@rm -rf $(BACKEND_DIR)/.ruff_cache 2>/dev/null || true
	@echo "$(GREEN)✅ Cleanup complete$(NC)"

lint: ## Run code linting
	@echo "$(BLUE)🔍 Running linting checks...$(NC)"
	@cd $(BACKEND_DIR) && $(PYTHON) -m ruff check src/ tests/ --output-format=text

format: ## Format code and fix linting issues
	@echo "$(BLUE)🎨 Formatting code...$(NC)"
	@cd $(BACKEND_DIR) && $(PYTHON) -m ruff check --fix src/ tests/
	@echo "$(GREEN)✅ Code formatting complete$(NC)"

test: test-unit test-api ## Run all tests
	@echo "$(GREEN)🎉 All tests completed!$(NC)"

test-unit: ## Run unit tests only
	@echo "$(BLUE)🧪 Running unit tests...$(NC)"
	@cd $(BACKEND_DIR) && PYTHONPATH=. $(PYTHON) -m pytest tests/test_mock_banking.py tests/test_api.py -v --tb=short

test-api: ## Run API integration tests  
	@echo "$(BLUE)🌐 Running API tests...$(NC)"
	@bash $(BACKEND_SCRIPTS_DIR)/test_setup.sh

test-e2e: ## Run end-to-end tests
	@bash $(SCRIPTS_DIR)/run-e2e-tests.sh

test-e2e-debug: ## Run E2E tests in debug mode
	@bash $(SCRIPTS_DIR)/run-e2e-tests.sh debug

test-e2e-headed: ## Run E2E tests with visible browser
	@bash $(SCRIPTS_DIR)/run-e2e-tests.sh headed

test-e2e-chrome: ## Run E2E tests in Chrome only
	@bash $(SCRIPTS_DIR)/run-e2e-tests.sh chrome

test-full: ## Run comprehensive test suite
	@echo "$(BLUE)🔬 Running full test suite...$(NC)"
	@bash $(BACKEND_SCRIPTS_DIR)/run_full_test.sh

demo: ## Run comprehensive demo
	@echo "$(BLUE)🎭 Running comprehensive demo...$(NC)"
	@cd $(BACKEND_DIR) && $(PYTHON) demo.py

demo-basic: ## Run basic classification demo
	@echo "$(BLUE)🎯 Running basic demo...$(NC)"
	@cd $(BACKEND_DIR) && $(PYTHON) demo.py --scenario basic

demo-providers: ## Run LLM provider flexibility demo
	@echo "$(BLUE)🔄 Running provider demo...$(NC)"
	@cd $(BACKEND_DIR) && $(PYTHON) demo.py --scenario providers

demo-conversation: ## Run multi-turn conversation demo
	@echo "$(BLUE)💬 Running conversation demo...$(NC)"
	@cd $(BACKEND_DIR) && $(PYTHON) demo.py --scenario conversation

demo-risk: ## Run risk assessment demo
	@echo "$(BLUE)🔒 Running risk assessment demo...$(NC)"
	@cd $(BACKEND_DIR) && $(PYTHON) demo.py --scenario risk

api: ## Start the API server
	@echo "$(BLUE)🚀 Starting API server...$(NC)"
	@echo "$(YELLOW)API will be available at: http://localhost:8000$(NC)"
	@echo "$(YELLOW)API docs at: http://localhost:8000/docs$(NC)"
	@cd $(BACKEND_DIR) && \
	export DATABASE_URL=mock && \
	export REDIS_URL=mock && \
	export LLM_PROVIDER=mock && \
	$(PYTHON) -m uvicorn src.api:app --reload --host 0.0.0.0 --port 8000

mcp: ## Start the MCP server
	@echo "$(BLUE)🔗 Starting MCP server...$(NC)"
	@./$(SCRIPTS_DIR)/run-mcp-server.sh

frontend: ## Start the frontend development server
	@echo "$(BLUE)🖥️  Starting frontend...$(NC)"
	@cd frontend && npm run dev

start: ## Start both frontend and backend services
	@echo "$(BLUE)🚀 Starting EBP Banking Application...$(NC)"
	@./$(SCRIPTS_DIR)/start-app.sh

start-ports: ## Start services with custom ports (usage: make start-ports BACKEND_PORT=8000 FRONTEND_PORT=3001)
	@echo "$(BLUE)🚀 Starting EBP Banking Application on custom ports...$(NC)"
	@./$(SCRIPTS_DIR)/start-app.sh $(BACKEND_PORT) $(FRONTEND_PORT)

test-mcp: ## Test MCP server functionality
	@echo "$(BLUE)🤖 Testing MCP Server...$(NC)"
	@cd $(BACKEND_DIR) && \
	export LLM_PROVIDER=mock && \
	export DATABASE_URL=mock && \
	export REDIS_URL=mock && \
	$(PYTHON) -m pytest tests/test_mcp_server.py -v

test-mcp-comprehensive: ## Run comprehensive MCP and intent testing
	@echo "$(BLUE)🧪 Running Comprehensive MCP Tests...$(NC)"
	@cd $(BACKEND_DIR) && \
	export LLM_PROVIDER=mock && \
	export DATABASE_URL=mock && \
	export REDIS_URL=mock && \
	$(PYTHON) -m pytest tests/test_mcp_comprehensive.py -v

# Docker targets removed - using direct startup for simplicity

# Development utilities
dev-setup: ## Setup development environment with git hooks
	@echo "$(BLUE)⚙️  Setting up development environment...$(NC)"
	@bash $(BACKEND_SCRIPTS_DIR)/setup_providers.sh

check: lint test-unit ## Quick development check (lint + unit tests)
	@echo "$(GREEN)✅ Quick check complete$(NC)"

# Provider-specific demos (requires API keys)
demo-openai: ## Run demo with OpenAI provider
	@cd $(BACKEND_DIR) && $(PYTHON) demo.py --provider openai

demo-anthropic: ## Run demo with Anthropic provider  
	@cd $(BACKEND_DIR) && $(PYTHON) demo.py --provider anthropic

# Show project status
status: ## Show project status and configuration
	@echo "$(BLUE)📊 EBP AI Banking Capabilities - Project Status$(NC)"
	@echo "=============================================="
	@echo "Python: $$($(PYTHON) --version 2>&1 || echo 'Not found')"
	@echo "Virtual Environment: $$(test -d $(VENV_DIR) && echo '✅ Installed' || echo '❌ Missing')"
	@echo "Dependencies: $$(test -f $(VENV_DIR)/pyvenv.cfg && echo '✅ Installed' || echo '❌ Missing')"
	@echo ""
	@echo "Environment Variables:"
	@echo "  DATABASE_URL: $${DATABASE_URL:-'Not set (will use mock)'}"
	@echo "  REDIS_URL: $${REDIS_URL:-'Not set (will use mock)'}"
	@echo "  LLM_PROVIDER: $${LLM_PROVIDER:-'Not set (will use mock)'}"
	@echo "  OPENAI_API_KEY: $$(test -n "$$OPENAI_API_KEY" && echo '✅ Set' || echo '❌ Not set')"
	@echo "  ANTHROPIC_API_KEY: $$(test -n "$$ANTHROPIC_API_KEY" && echo '✅ Set' || echo '❌ Not set')"