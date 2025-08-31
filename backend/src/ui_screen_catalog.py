"""
UI Screen Catalog - Maps intents to UI screens and dynamic form components
Supports both Navigation Assistance and Transaction Assistance use cases
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Union
from enum import Enum


class ScreenType(Enum):
    """Type of UI screen or component"""
    PRE_BUILT = "pre_built"  # Existing banking screens for navigation
    DYNAMIC_FORM = "dynamic_form"  # Dynamically assembled forms for transactions
    HYBRID = "hybrid"  # Combination of pre-built with dynamic elements


class FormFieldType(Enum):
    """Types of form fields for dynamic assembly"""
    TEXT = "text"
    EMAIL = "email"
    PHONE = "phone"
    AMOUNT = "amount"
    ACCOUNT_SELECT = "account_select"
    RECIPIENT_SELECT = "recipient_select"
    DATE = "date"
    DROPDOWN = "dropdown"
    CHECKBOX = "checkbox"
    TEXTAREA = "textarea"
    BANK_LOOKUP = "bank_lookup"
    ROUTING_NUMBER = "routing_number"
    CARD_SELECT = "card_select"


@dataclass
class FormField:
    """Definition of a form field for dynamic assembly"""
    field_id: str
    field_type: FormFieldType
    label: str
    required: bool = True
    placeholder: str = ""
    validation_pattern: Optional[str] = None
    options: List[str] = field(default_factory=list)
    default_value: Optional[str] = None
    help_text: str = ""
    conditional_on: Optional[str] = None  # Show only if another field has specific value


@dataclass
class UIScreen:
    """Definition of a UI screen or dynamic form"""
    screen_id: str
    name: str
    screen_type: ScreenType
    category: str
    
    # For navigation assistance (pre-built screens)
    route_path: Optional[str] = None
    component_name: Optional[str] = None
    
    # For transaction assistance (dynamic forms)
    form_fields: List[FormField] = field(default_factory=list)
    
    # Common properties
    description: str = ""
    related_intents: List[str] = field(default_factory=list)
    related_operations: List[str] = field(default_factory=list)
    auth_required: bool = True
    risk_level: str = "MEDIUM"
    preconditions: List[str] = field(default_factory=list)
    
    # UI hints
    title_template: str = ""
    subtitle_template: str = ""
    success_message: str = ""
    confirmation_required: bool = True


class UIScreenCatalog:
    """Catalog of all UI screens and dynamic forms"""
    
    def __init__(self):
        self.screens: Dict[str, UIScreen] = {}
        self._initialize_screens()
    
    def _initialize_screens(self):
        """Initialize all pre-built screens and dynamic form templates"""
        
        # =============================================================================
        # NAVIGATION ASSISTANCE - Pre-built Banking Screens
        # =============================================================================
        
        # Main Navigation Screens
        self.screens["banking_dashboard"] = UIScreen(
            screen_id="banking_dashboard",
            name="Dashboard",
            screen_type=ScreenType.PRE_BUILT,
            category="dashboard",
            route_path="/banking",
            component_name="BankingDashboard",
            description="Main banking dashboard with account overview",
            related_intents=["navigation.banking.dashboard"],
            title_template="Banking Dashboard"
        )

        self.screens["chat_assistant"] = UIScreen(
            screen_id="chat_assistant",
            name="Chat Assistant", 
            screen_type=ScreenType.PRE_BUILT,
            category="support",
            route_path="/chat",
            component_name="ChatPanel",
            description="AI-powered chat assistant for banking help",
            related_intents=["navigation.chat.assistant"],
            title_template="Chat Assistant"
        )

        self.screens["transaction_assistance"] = UIScreen(
            screen_id="transaction_assistance",
            name="Transaction Assistance",
            screen_type=ScreenType.PRE_BUILT, 
            category="transactions",
            route_path="/transaction",
            component_name="TransactionAssistance",
            description="Dynamic transaction assistance interface",
            related_intents=["navigation.transaction.assistance"],
            title_template="Transaction Assistance"
        )
        
        # Account Management Screens
        self.screens["accounts_overview"] = UIScreen(
            screen_id="accounts_overview",
            name="Account Overview",
            screen_type=ScreenType.PRE_BUILT,
            category="accounts",
            route_path="/banking/accounts",
            component_name="AccountsOverview",
            description="Main accounts dashboard showing all account balances",
            related_intents=["navigation.accounts.overview", "accounts.balance.check"],
            title_template="Your Accounts"
        )
        
        self.screens["account_details"] = UIScreen(
            screen_id="account_details",
            name="Account Details",
            screen_type=ScreenType.PRE_BUILT,
            category="accounts",
            route_path="/banking/accounts/{account_id}",
            component_name="AccountDetails",
            description="Detailed view of a specific account with transactions",
            related_intents=["navigation.accounts.details", "accounts.transactions.history"],
            title_template="Account Details"
        )
        
        # Transfer Screens
        self.screens["transfers_hub"] = UIScreen(
            screen_id="transfers_hub",
            name="Transfer Hub",
            screen_type=ScreenType.PRE_BUILT,
            category="transfers",
            route_path="/banking/transfers",
            component_name="TransfersHub",
            description="Main transfer dashboard with options for different transfer types",
            related_intents=["navigation.transfers.hub", "navigation.transfers.main"],
            title_template="Money Transfers"
        )
        
        self.screens["wire_transfers"] = UIScreen(
            screen_id="wire_transfers",
            name="Wire Transfers",
            screen_type=ScreenType.PRE_BUILT,
            category="transfers",
            route_path="/banking/transfers/wire",
            component_name="WireTransferForm",
            description="Traditional wire transfer form with all fields",
            related_intents=["navigation.transfers.wire", "navigation.transfers.international"],
            title_template="International Wire Transfer"
        )
        
        # Bill Pay Screens
        self.screens["bill_pay_hub"] = UIScreen(
            screen_id="bill_pay_hub",
            name="Bill Pay",
            screen_type=ScreenType.PRE_BUILT,
            category="payments",
            route_path="/banking/payments/bills",
            component_name="BillPayHub",
            description="Bill payment dashboard and payee management",
            related_intents=["navigation.payments.bills", "navigation.bill_pay"],
            title_template="Pay Bills"
        )
        
        # =============================================================================
        # TRANSACTION ASSISTANCE - Dynamic Form Templates
        # =============================================================================
        
        # Quick Transfer Forms
        self.screens["quick_internal_transfer"] = UIScreen(
            screen_id="quick_internal_transfer",
            name="Quick Internal Transfer",
            screen_type=ScreenType.DYNAMIC_FORM,
            category="transfers",
            description="Streamlined form for transfers between your accounts",
            related_intents=["payments.transfer.internal"],
            related_operations=["transfer_funds_internal"],
            form_fields=[
                FormField("from_account", FormFieldType.ACCOUNT_SELECT, "From Account", required=True),
                FormField("to_account", FormFieldType.ACCOUNT_SELECT, "To Account", required=True),
                FormField("amount", FormFieldType.AMOUNT, "Amount", required=True, placeholder="0.00"),
                FormField("memo", FormFieldType.TEXT, "Memo", required=False, placeholder="Optional note")
            ],
            title_template="Transfer Money",
            subtitle_template="Between your accounts",
            success_message="Transfer completed successfully",
            confirmation_required=True
        )
        
        self.screens["quick_external_transfer"] = UIScreen(
            screen_id="quick_external_transfer",
            name="Quick External Transfer",
            screen_type=ScreenType.DYNAMIC_FORM,
            category="transfers",
            description="Streamlined form for transfers to external recipients",
            related_intents=["payments.transfer.external", "payments.p2p.send"],
            related_operations=["send_payment"],
            form_fields=[
                FormField("from_account", FormFieldType.ACCOUNT_SELECT, "From Account", required=True),
                FormField("recipient", FormFieldType.RECIPIENT_SELECT, "Send To", required=True),
                FormField("amount", FormFieldType.AMOUNT, "Amount", required=True, placeholder="0.00"),
                FormField("memo", FormFieldType.TEXT, "Memo", required=False, placeholder="What's this for?")
            ],
            title_template="Send Money",
            subtitle_template="To someone else",
            success_message="Payment sent successfully",
            confirmation_required=True
        )
        
        # International Transfer (Custom Form)
        self.screens["quick_international_transfer"] = UIScreen(
            screen_id="quick_international_transfer",
            name="Quick International Transfer",
            screen_type=ScreenType.DYNAMIC_FORM,
            category="transfers",
            description="Simplified international transfer for common destinations",
            related_intents=["payments.transfer.international"],
            related_operations=["send_international_payment"],
            form_fields=[
                FormField("recipient_name", FormFieldType.TEXT, "Recipient Name", required=True),
                FormField("recipient_country", FormFieldType.DROPDOWN, "Country", required=True, 
                         options=["Canada", "United Kingdom", "European Union", "Australia", "Other"]),
                FormField("bank_name", FormFieldType.BANK_LOOKUP, "Recipient Bank", required=True),
                FormField("account_number", FormFieldType.TEXT, "Account Number", required=True),
                FormField("amount", FormFieldType.AMOUNT, "Amount (USD)", required=True),
                FormField("purpose", FormFieldType.DROPDOWN, "Purpose", required=True,
                         options=["Family Support", "Education", "Business", "Personal"]),
                # Advanced fields (shown conditionally)
                FormField("swift_code", FormFieldType.TEXT, "SWIFT Code", required=False,
                         help_text="We'll help find this if needed"),
                FormField("correspondent_bank", FormFieldType.TEXT, "Correspondent Bank", required=False,
                         conditional_on="recipient_country:Other")
            ],
            title_template="Send Money Internationally",
            subtitle_template="To {recipient_country}",
            success_message="International transfer initiated",
            confirmation_required=True,
            risk_level="HIGH"
        )
        
        # Bill Payment Forms
        self.screens["utility_bill_payment"] = UIScreen(
            screen_id="utility_bill_payment", 
            name="Utility Bill Payment",
            screen_type=ScreenType.DYNAMIC_FORM,
            category="payments",
            description="Streamlined utility bill payment with company lookup",
            related_intents=["payments.bills.utilities"],
            related_operations=["pay_bill"],
            form_fields=[
                FormField("utility_company", FormFieldType.DROPDOWN, "Utility Company", required=True,
                         options=["PG&E", "Edison", "LADWP", "San Diego Gas & Electric", "Other"]),
                FormField("account_number", FormFieldType.TEXT, "Account Number", required=True),
                FormField("amount", FormFieldType.AMOUNT, "Amount", required=True),
                FormField("payment_date", FormFieldType.DATE, "Payment Date", required=True,
                         default_value="today"),
                FormField("autopay_setup", FormFieldType.CHECKBOX, "Set up AutoPay", required=False)
            ],
            title_template="Pay Utility Bill",
            subtitle_template="Quick and easy payment",
            success_message="Bill payment scheduled",
            confirmation_required=True
        )
        
        # Card Management
        self.screens["quick_card_control"] = UIScreen(
            screen_id="quick_card_control",
            name="Quick Card Control",
            screen_type=ScreenType.DYNAMIC_FORM,
            category="cards",
            description="Quick card blocking/unblocking",
            related_intents=["cards.block", "cards.unblock"],
            related_operations=["block_card", "unblock_card"],
            form_fields=[
                FormField("card_selection", FormFieldType.CARD_SELECT, "Select Card", required=True),
                FormField("action", FormFieldType.DROPDOWN, "Action", required=True,
                         options=["Block Card", "Unblock Card", "Report Lost/Stolen"]),
                FormField("reason", FormFieldType.DROPDOWN, "Reason", required=True,
                         options=["Temporary Block", "Lost", "Stolen", "Suspicious Activity"]),
                FormField("replacement_needed", FormFieldType.CHECKBOX, "Order Replacement Card", required=False)
            ],
            title_template="Card Management",
            subtitle_template="Control your cards",
            success_message="Card status updated",
            confirmation_required=True,
            risk_level="MEDIUM"
        )
    
    def get_screen_for_intent(self, intent_id: str, context: Optional[Dict[str, Any]] = None) -> Optional[UIScreen]:
        """Get the appropriate screen for an intent"""
        
        # Check for navigation intents first (pre-built screens)
        if intent_id.startswith("navigation."):
            for screen in self.screens.values():
                if intent_id in screen.related_intents and screen.screen_type == ScreenType.PRE_BUILT:
                    return screen
        
        # For transaction intents, look for dynamic forms
        else:
            for screen in self.screens.values():
                if intent_id in screen.related_intents and screen.screen_type == ScreenType.DYNAMIC_FORM:
                    # Could add context-based selection here
                    return screen
        
        return None
    
    def get_navigation_screens(self) -> List[UIScreen]:
        """Get all pre-built screens for navigation"""
        return [screen for screen in self.screens.values() 
                if screen.screen_type == ScreenType.PRE_BUILT]
    
    def get_dynamic_forms(self) -> List[UIScreen]:
        """Get all dynamic form templates"""
        return [screen for screen in self.screens.values() 
                if screen.screen_type == ScreenType.DYNAMIC_FORM]
    
    def get_screen_by_id(self, screen_id: str) -> Optional[UIScreen]:
        """Get screen by ID"""
        return self.screens.get(screen_id)
    
    def assemble_dynamic_form(self, intent_id: str, entities: Dict[str, Any], 
                             context: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """Assemble a dynamic form based on intent and entities"""
        
        screen = self.get_screen_for_intent(intent_id, context)
        if not screen or screen.screen_type != ScreenType.DYNAMIC_FORM:
            return None
        
        # Build form configuration
        form_config = {
            "screen_id": screen.screen_id,
            "title": screen.title_template,
            "subtitle": screen.subtitle_template,
            "fields": [],
            "confirmation_required": screen.confirmation_required,
            "estimated_fields": len(screen.form_fields)
        }
        
        # Process fields and apply smart defaults
        for field in screen.form_fields:
            field_config = {
                "id": field.field_id,
                "type": field.field_type.value,
                "label": field.label,
                "required": field.required,
                "placeholder": field.placeholder,
                "options": field.options,
                "help_text": field.help_text,
                "value": field.default_value
            }
            
            # Apply smart defaults from entities
            if field.field_id in entities:
                field_config["value"] = entities[field.field_id]
                field_config["pre_filled"] = True
            
            # Conditional field logic
            if field.conditional_on:
                field_config["conditional_on"] = field.conditional_on
                field_config["hidden"] = True  # Start hidden
            
            form_config["fields"].append(field_config)
        
        # Calculate complexity reduction
        traditional_form_fields = 57  # Example: traditional wire transfer form
        dynamic_form_fields = len([f for f in screen.form_fields if not f.conditional_on])
        complexity_reduction = int((1 - dynamic_form_fields / traditional_form_fields) * 100)
        form_config["complexity_reduction"] = f"{complexity_reduction}%"
        
        return form_config


# Global instance
ui_screen_catalog = UIScreenCatalog() 