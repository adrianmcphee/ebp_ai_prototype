"""Intent refinement logic for post-enrichment intent adjustment"""

from typing import Dict, Any, Tuple


class IntentRefiner:
    """Refines intent classification based on enriched entities."""
    
    # Transfer type limits
    P2P_LIMIT = 1000
    EXTERNAL_LIMIT = 10000
    INTERNATIONAL_LIMIT = 100000
    
    def refine_intent(self, 
                     initial_intent: str, 
                     entities: Dict[str, Any]) -> Tuple[str, str]:
        """
        Refine intent based on business rules.
        Returns: (final_intent, refinement_reason)
        """
        
        # Extract key data
        amount = entities.get("amount", {}).get("value", 0)
        recipient = entities.get("recipient", {})
        transfer_type = recipient.get("transfer_type")
        
        # Rule 1: International recipient always becomes international wire
        if transfer_type == "international":
            if initial_intent != "international.wire.send":
                return "international.wire.send", "international_recipient"
                
        # Rule 2: Amount exceeds P2P limit
        if initial_intent == "payments.p2p.send" and amount > self.P2P_LIMIT:
            # Upgrade to external transfer
            return "payments.transfer.external", "p2p_limit_exceeded"
            
        # Rule 3: Internal bank but different customer
        if transfer_type == "internal" and recipient.get("enriched_entity"):
            recipient_data = recipient["enriched_entity"]
            # Check if it's actually a different customer at same bank
            if recipient_data.get("customer_id") != "current_user":
                return "payments.transfer.external", "different_customer_same_bank"
                
        # Rule 4: Explicit P2P keywords override amount limits for suggestions
        query_lower = entities.get("original_query", "").lower()
        if any(keyword in query_lower for keyword in ["zelle", "venmo", "cash app"]):
            if amount <= self.P2P_LIMIT:
                return "payments.p2p.send", "explicit_p2p_service"
                
        # No refinement needed
        return initial_intent, "no_refinement"
