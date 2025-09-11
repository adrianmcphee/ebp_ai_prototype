"""Intent refinement logic for post-enrichment intent adjustment"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple, List


class IntentRefinementRegistry:
    """Registry for intent refinement rules that auto-registers rules."""
    
    _instance = None
    _rules: List['IntentRefinementRule'] = []
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    @classmethod
    def register(cls, rule: 'IntentRefinementRule') -> None:
        """Register a refinement rule."""
        if cls._instance is None:
            cls._instance = cls()
        cls._rules.append(rule)
    
    @classmethod
    def get_rules(cls) -> List['IntentRefinementRule']:
        """Get all registered rules sorted by priority."""
        if cls._instance is None:
            cls._instance = cls()
        return sorted(cls._rules, key=lambda rule: rule.priority)
    
    @classmethod
    def clear(cls) -> None:
        """Clear all registered rules (useful for testing)."""
        cls._rules.clear()


class IntentRefinementRule(ABC):
    """Abstract base class for intent refinement rules."""
    
    def __init_subclass__(cls, **kwargs):
        """Auto-register any subclass when it's defined."""
        super().__init_subclass__(**kwargs)
        # Create an instance and register it
        if not getattr(cls, '_is_abstract', False):
            try:
                instance = cls()
                IntentRefinementRegistry.register(instance)
            except Exception:
                # If instantiation fails, it might be an abstract subclass
                pass
    
    @abstractmethod
    def applies(self, initial_intent: str, entities: Dict[str, Any]) -> bool:
        """Check if this rule applies to the given intent and entities."""
        pass
    
    @abstractmethod
    def refine(self, initial_intent: str, entities: Dict[str, Any]) -> Tuple[str, str]:
        """Apply refinement and return (new_intent, reason)."""
        pass
    
    @property
    @abstractmethod
    def priority(self) -> int:
        """Rule priority (lower number = higher priority)."""
        pass


class InternationalRecipientRule(IntentRefinementRule):
    """International recipients always become international wire transfers."""
    
    @property
    def priority(self) -> int:
        return 1  # Highest priority
    
    def applies(self, initial_intent: str, entities: Dict[str, Any]) -> bool:
        recipient = entities.get("recipient", {})
        transfer_type = self._determine_transfer_type(recipient)
        return transfer_type == "international" and initial_intent != "international.wire.send"
    
    def refine(self, initial_intent: str, entities: Dict[str, Any]) -> Tuple[str, str]:
        return "international.wire.send", "international_recipient"
    
    def _determine_transfer_type(self, recipient: Dict[str, Any]) -> str:
        """Determine transfer type based on recipient data."""
        enriched_entity = recipient.get("enriched_entity", {})
        bank_country = enriched_entity.get("bank_country")
        
        if bank_country and bank_country != "US":
            return "international"
        return "domestic"


class ExplicitP2PKeywordRule(IntentRefinementRule):
    """Explicit P2P keywords (Zelle, Venmo, etc.) override other logic."""
    
    P2P_KEYWORDS = ["zelle", "venmo", "cash app"]
    P2P_LIMIT = 1000
    
    @property
    def priority(self) -> int:
        return 2  # High priority - explicit user intent
    
    def applies(self, initial_intent: str, entities: Dict[str, Any]) -> bool:
        query_lower = entities.get("original_query", "").lower()
        has_p2p_keyword = any(keyword in query_lower for keyword in self.P2P_KEYWORDS)
        amount = entities.get("amount", {}).get("value", 0)
        return has_p2p_keyword and amount <= self.P2P_LIMIT
    
    def refine(self, initial_intent: str, entities: Dict[str, Any]) -> Tuple[str, str]:
        return "payments.p2p.send", "explicit_p2p_service"


class P2PLimitExceededRule(IntentRefinementRule):
    """P2P payments exceeding limits are upgraded to external transfers."""
    
    P2P_LIMIT = 1000
    
    @property
    def priority(self) -> int:
        return 3  # Medium priority - business rule enforcement
    
    def applies(self, initial_intent: str, entities: Dict[str, Any]) -> bool:
        amount = entities.get("amount", {}).get("value", 0)
        return initial_intent == "payments.p2p.send" and amount > self.P2P_LIMIT
    
    def refine(self, initial_intent: str, entities: Dict[str, Any]) -> Tuple[str, str]:
        return "payments.transfer.external", "p2p_limit_exceeded"


class IntentRefiner:
    """Refines intent classification using auto-registered business rules."""
    
    def __init__(self):
        """Initialize the refiner. Rules are auto-registered via the registry."""
        pass
    
    def refine_intent(self, 
                     initial_intent: str, 
                     entities: Dict[str, Any]) -> Tuple[str, str]:
        """
        Refine intent based on registered business rules.
        
        Args:
            initial_intent: The initially classified intent
            entities: Extracted and enriched entities
            
        Returns:
            Tuple of (final_intent, refinement_reason)
        """
        # Get all registered rules (already sorted by priority)
        rules = IntentRefinementRegistry.get_rules()
        
        # Apply rules in priority order
        for rule in rules:
            if rule.applies(initial_intent, entities):
                return rule.refine(initial_intent, entities)
        
        # No refinement applied
        return initial_intent, "no_refinement"
