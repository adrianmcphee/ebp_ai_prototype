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
    """Strategy for resolving all account-related entities"""
    
    def __init__(self, banking_service):
        self.banking = banking_service
    
    def get_strategy_name(self) -> str:
        return "account_resolution"
    
    def can_enrich(self, entities: Dict[str, Any]) -> bool:
        """Check if any account-related entities can be enriched"""
        account_entities = ["account_id", "account_name", "account_type", "from_account", "to_account"]
        return any(key in entities for key in account_entities)
    
    def enrich(self, entities: Dict[str, Any]) -> Dict[str, Any]:
        """Resolve account info from all account-related entities"""
        enriched = entities.copy()
        
        # Define account entity keys to process
        account_entity_keys = ["account_id", "account_name", "account_type", "from_account", "to_account"]
        
        for entity_key in account_entity_keys:
            if entity_key in entities:
                # Skip if already enriched
                entity_data = entities[entity_key]
                if isinstance(entity_data, dict) and "enriched_entity" in entity_data:
                    continue
                    
                # Try to resolve this entity to an account
                account_id = self._resolve_account_id_for_entity(entity_key, entities)
                if account_id and account_id in self.banking.accounts:
                    account = self.banking.accounts[account_id]
                    
                    # Enrich the specific entity with full account details
                    if isinstance(entity_data, dict):
                        # Entity is already in dict format, add enrichment
                        enriched[entity_key] = entity_data.copy()
                        enriched[entity_key]["enriched_entity"] = {
                            "id": account.id,
                            "name": account.name,
                            "type": account.type,
                            "balance": account.balance,
                            "currency": account.currency
                        }
                        enriched[entity_key]["source"] = "enrichment"
                        enriched[entity_key]["confidence"] = 0.95
                    else:
                        # Entity is a string, convert to enriched dict format
                        enriched[entity_key] = {
                            "value": self._extract_entity_value(entity_data),
                            "raw": str(entity_data),
                            "confidence": 0.95,
                            "source": "enrichment",
                            "enriched_entity": {
                                "id": account.id,
                                "name": account.name,
                                "type": account.type,
                                "balance": account.balance,
                                "currency": account.currency
                            }
                        }
        
        # Clean up redundant entities for transfer operations
        enriched = self._cleanup_redundant_entities(enriched)
        
        return enriched
    
    def _cleanup_redundant_entities(self, entities: Dict[str, Any]) -> Dict[str, Any]:
        """Remove redundant account entities when transfer-specific entities are present"""
        # If we have from_account and/or to_account, remove generic account_type
        # since transfer-specific entities are more precise
        if ("from_account" in entities or "to_account" in entities) and "account_type" in entities:
            # Check if account_type is redundant (same value as from_account or to_account)
            account_type_value = self._extract_entity_value(entities["account_type"])
            from_account_value = self._extract_entity_value(entities.get("from_account", {}))
            to_account_value = self._extract_entity_value(entities.get("to_account", {}))
            
            # Remove account_type if it matches either from_account or to_account
            if account_type_value in [from_account_value, to_account_value]:
                entities_copy = entities.copy()
                del entities_copy["account_type"]
                return entities_copy
        
        return entities
    
    def _resolve_account_id_for_entity(self, entity_key: str, entities: Dict[str, Any]) -> str:
        """Resolve account ID for a specific entity"""
        entity_data = entities[entity_key]
        entity_value = self._extract_entity_value(entity_data)
        
        if not entity_value:
            return None
            
        entity_value = entity_value.lower().strip()
        
        # Direct account ID lookup
        if entity_key == "account_id":
            if entity_value in self.banking.accounts:
                return entity_value
        
        # Account type-based resolution
        if entity_key in ["account_type", "from_account", "to_account"]:
            # Handle account type references (checking, savings, etc.)
            matching_accounts = []
            for acc_id, account in self.banking.accounts.items():
                if account.type.lower() == entity_value:
                    matching_accounts.append(acc_id)
            
            # If only one account of this type, return it
            if len(matching_accounts) == 1:
                return matching_accounts[0]
            # For multiple matches, need additional logic or disambiguation
            elif len(matching_accounts) > 1:
                # For transfer entities, try to be smart about disambiguation
                if entity_key == "from_account":
                    # Prefer primary checking as default source
                    for acc_id in matching_accounts:
                        if "primary" in self.banking.accounts[acc_id].name.lower():
                            return acc_id
                    return matching_accounts[0]  # Fallback to first match
                elif entity_key == "to_account":
                    # For destination, return first match
                    return matching_accounts[0]
                else:
                    # Generic account_type, return first match
                    return matching_accounts[0]
        
        # Account name-based resolution
        if entity_key == "account_name":
            for acc_id, account in self.banking.accounts.items():
                if account.name.lower() == entity_value:
                    return acc_id
                # Also try partial matching for common phrases
                if entity_value in account.name.lower() or account.name.lower() in entity_value:
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
    
    async def enrich(self, intent_id: str, entities: Dict[str, Any]) -> Dict[str, Any]:
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
                # Check if the strategy's enrich method is async
                import inspect
                if inspect.iscoroutinefunction(strategy.enrich):
                    enriched = await strategy.enrich(enriched)
                else:
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
