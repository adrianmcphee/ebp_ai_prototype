"""Intent-driven entity enrichment"""

import inspect
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Type


class EnrichmentStrategy(ABC):
    """Strategy for specific enrichment type"""
    
    @abstractmethod
    def get_strategy_name(self) -> str:
        """Name of this enrichment strategy"""
        pass
    
    @abstractmethod
    def can_enrich(self, entities: Dict[str, Any]) -> bool:
        """Check if entities can be enriched by this strategy"""
        pass
    
    @abstractmethod
    def enrich(self, entities: Dict[str, Any]) -> Dict[str, Any]:
        """Apply enrichment to entities"""
        pass


class AccountResolutionStrategy(EnrichmentStrategy):
    """Strategy for resolving account entities"""
    
    def __init__(self, banking_service):
        self.banking = banking_service
    
    def get_strategy_name(self) -> str:
        return "account_resolution"
    
    def can_enrich(self, entities: Dict[str, Any]) -> bool:
        return any(key in entities for key in ["account_id", "account_name", "account_type"])
    
    def enrich(self, entities: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve account info from entities"""
        account_id = self._resolve_account_id(entities)
        if account_id and account_id in self.banking.accounts:
            account = self.banking.accounts[account_id]
            enriched = entities.copy()
            
            # Add account_id if not already present
            if "account_id" not in enriched:
                enriched["account_id"] = account_id
                
            # Optionally enrich with additional account info
            if "account_type" not in enriched:
                enriched["account_type"] = {
                    "value": account.type,
                    "raw": account.type,
                    "confidence": 0.95,
                    "source": "enrichment"
                }
            if "account_name" not in enriched:
                enriched["account_name"] = {
                    "value": account.name,
                    "raw": account.name,
                    "confidence": 0.95,
                    "source": "enrichment"
                }
            return enriched
        return entities
    
    def _resolve_account_id(self, entities: Dict[str, Any]) -> str:
        """Account id resolution"""
        if "account_id" in entities:
            account_id = self._extract_entity_value(entities["account_id"])
            return account_id
        
        if "account_type" in entities:
            account_type = self._extract_entity_value(entities["account_type"])
            if account_type:
                account_type = account_type.lower()
                for acc_id, account in self.banking.accounts.items():
                    if account.type.lower() == account_type:
                        return acc_id
        
        return None
    
    def _extract_entity_value(self, entity: Any) -> str:
        """Safely extract string value from entity (handles both dict and string formats)"""
        if isinstance(entity, dict):
            # Entity is in dictionary format with metadata
            return entity.get("value", "")
        elif isinstance(entity, str):
            # Entity is a simple string (backward compatibility)
            return entity
        else:
            # Fallback for other types
            return str(entity) if entity is not None else ""


class IntentDrivenEnricher:
    """Enricher that reads requirements from intent itself"""
    
    def __init__(self, intent_catalog, banking_service=None):
        self.intent_catalog = intent_catalog
        self._strategies: Dict[str, EnrichmentStrategy] = {}
        
        # Auto-discover and register all strategies
        self._auto_discover_strategies(banking_service)
    
    def _auto_discover_strategies(self, banking_service=None) -> None:
        """Automatically discover and register all EnrichmentStrategy subclasses"""
        # Get all EnrichmentStrategy subclasses
        strategy_classes = self._get_strategy_classes()
        
        for strategy_class in strategy_classes:
            try:
                # Try to instantiate the strategy
                strategy_instance = self._instantiate_strategy(strategy_class, banking_service)
                if strategy_instance:
                    self._strategies[strategy_instance.get_strategy_name()] = strategy_instance
            except Exception as e:
                # Log warning but continue with other strategies
                print(f"Warning: Could not instantiate strategy {strategy_class.__name__}: {e}")
    
    def _get_strategy_classes(self) -> List[Type[EnrichmentStrategy]]:
        """Get all concrete EnrichmentStrategy subclasses"""
        strategy_classes = []
        
        # Get all classes in current module
        current_module = inspect.getmodule(self)
        for name, obj in inspect.getmembers(current_module, inspect.isclass):
            # Check if it's a concrete subclass of EnrichmentStrategy
            if (issubclass(obj, EnrichmentStrategy) and 
                obj != EnrichmentStrategy and 
                not inspect.isabstract(obj)):
                strategy_classes.append(obj)
        
        return strategy_classes
    
    def _instantiate_strategy(self, strategy_class: Type[EnrichmentStrategy], banking_service=None) -> EnrichmentStrategy:
        """Instantiate strategy with appropriate dependencies"""
        # Check constructor signature to determine dependencies
        sig = inspect.signature(strategy_class.__init__)
        params = list(sig.parameters.keys())[1:]  # Skip 'self'
        
        if not params:
            # No dependencies needed
            return strategy_class()
        elif 'banking_service' in params and banking_service:
            # Needs banking service
            return strategy_class(banking_service)
        else:
            # Unknown dependencies - skip this strategy
            return None
    
    def enrich(self, intent_id: str, entities: Dict[str, Any]) -> Dict[str, Any]:
        """Enrich based on intent's declared requirements"""
        # Get intent and its enrichment requirements
        intent = self.intent_catalog.get_intent(intent_id)
        if not intent or not intent.enrichment_requirements:
            return entities
        
        # Apply each required enrichment strategy
        enriched = entities
        for requirement in intent.enrichment_requirements:
            strategy = self._strategies.get(requirement)
            if strategy and strategy.can_enrich(enriched):
                enriched = strategy.enrich(enriched)
        
        return enriched


class RecipientResolutionStrategy(EnrichmentStrategy):
    """Resolves recipient names to recipient records."""
    
    def __init__(self, banking_service):
        self.banking = banking_service
        
    def get_strategy_name(self) -> str:
        return "recipient_resolution"
        
    def can_enrich(self, entities: Dict[str, Any]) -> bool:
        return "recipient" in entities and "enriched_entity" not in entities.get("recipient", {})
        
    async def enrich(self, entities: Dict[str, Any]) -> Dict[str, Any]:
        recipient_data = entities["recipient"]
        query = self._extract_entity_value(recipient_data)
        
        # Search for recipient
        matches = await self.banking.search_recipients(query)
        
        if len(matches) == 1:
            # Single match - enrich with full data
            recipient_data["enriched_entity"] = matches[0]
            recipient_data["source"] = "enrichment"
            recipient_data["confidence"] = 0.95
            
            # Add transfer type for intent refinement
            recipient_data["transfer_type"] = self._determine_transfer_type(matches[0])
            
        elif len(matches) > 1:
            # Multiple matches - needs disambiguation
            recipient_data["disambiguation_required"] = True
            recipient_data["options"] = matches
            recipient_data["confidence"] = 0.60
            
        else:
            # No matches
            recipient_data["not_found"] = True
            recipient_data["confidence"] = 0.0
            
        return entities
    
    def _determine_transfer_type(self, recipient: dict) -> str:
        """Determine transfer type based on recipient data."""
        if recipient.get("bank_country") not in [None, "US"]:
            return "international"
        elif recipient.get("bank_name") == "Mock Bank":
            return "internal"  
        else:
            return "external"
    
    def _extract_entity_value(self, entity: Any) -> str:
        """Safely extract string value from entity (handles both dict and string formats)"""
        if isinstance(entity, dict):
            # Entity is in dictionary format with metadata
            return entity.get("value", "")
        elif isinstance(entity, str):
            # Entity is a simple string (backward compatibility)
            return entity
        else:
            # Fallback for other types
            return str(entity) if entity is not None else ""
