import React, { useState, useEffect, useRef } from 'react';
import './App.css';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  intent?: string;
  confidence?: number;
  entities?: any;
  timestamp: Date;
}

interface ProcessResponse {
  intent: string;
  confidence: number;
  entities: any;
  validation: any;
  missing_fields: string[];
  disambiguations: any;
  warnings: string[];
  suggestions: any;
  requires_confirmation: boolean;
  can_execute: boolean;
  ui_hints: any;
  execution?: any;
}

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [pendingAction, setPendingAction] = useState<any>(null);
  const [disambiguationOptions, setDisambiguationOptions] = useState<any>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Initialize session
    initializeSession();
    // Load accounts
    loadAccounts();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeSession = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/session`, {
        method: 'POST'
      });
      const data = await response.json();
      setSessionId(data.session_id);
      
      // Initialize WebSocket
      const ws = new WebSocket(`ws://localhost:8000/ws/${data.session_id}`);
      
      ws.onopen = () => {
        addSystemMessage('Connected to banking assistant');
      };
      
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      };
      
      ws.onerror = (error) => {
        addSystemMessage('Connection error. Please refresh.');
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to initialize session:', error);
      addSystemMessage('Failed to connect. Please refresh.');
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/accounts`);
      const data = await response.json();
      setAccounts(data.accounts);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const addSystemMessage = (content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'system',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const addUserMessage = (content: string) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const addAssistantMessage = (content: string, data?: Partial<ProcessResponse>) => {
    const message: Message = {
      id: Date.now().toString(),
      type: 'assistant',
      content,
      intent: data?.intent,
      confidence: data?.confidence,
      entities: data?.entities,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const handleWebSocketMessage = (message: any) => {
    if (message.type === 'result') {
      handleProcessResponse(message.data);
    } else if (message.type === 'disambiguation_resolved') {
      addSystemMessage(`Selected: ${message.selection}`);
      setDisambiguationOptions(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !sessionId) return;

    const query = input;
    setInput('');
    addUserMessage(query);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          session_id: sessionId
        })
      });

      const data: ProcessResponse = await response.json();
      handleProcessResponse(data);
    } catch (error) {
      console.error('Failed to process query:', error);
      addSystemMessage('Sorry, there was an error processing your request.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessResponse = (data: ProcessResponse) => {
    // Generate response message
    let responseMessage = '';
    
    switch (data.intent) {
      case 'balance':
        if (data.execution?.success) {
          responseMessage = `Your ${data.entities.account || 'account'} balance is $${data.execution.data.balance.toFixed(2)}`;
          setCurrentBalance(data.execution.data.balance);
        } else {
          responseMessage = 'I can help you check your balance. Which account would you like to check?';
        }
        break;
        
      case 'transfer':
        if (data.missing_fields?.length > 0) {
          responseMessage = `I need more information to complete the transfer. Please provide: ${data.missing_fields.join(', ')}`;
          setPendingAction(data);
        } else if (data.disambiguations?.recipient) {
          responseMessage = 'Multiple recipients found. Please select:';
          setDisambiguationOptions(data.disambiguations.recipient);
        } else if (data.validation?.valid === false) {
          responseMessage = `Transfer cannot be completed: ${data.validation.invalid_fields?.amount || 'Invalid request'}`;
        } else if (data.requires_confirmation) {
          responseMessage = `Ready to transfer $${data.entities.amount} to ${data.entities.recipient}. Please confirm.`;
        } else if (data.execution?.success) {
          responseMessage = `Transfer completed! $${data.entities.amount} sent to ${data.entities.recipient}. New balance: $${data.execution.new_balance}`;
        } else {
          responseMessage = `I'll help you transfer $${data.entities.amount} to ${data.entities.recipient}.`;
        }
        break;
        
      case 'history':
        responseMessage = 'Here are your recent transactions...';
        break;
        
      case 'navigation':
        responseMessage = `Navigating to ${data.entities.destination}...`;
        break;
        
      default:
        responseMessage = "I'm not sure how to help with that. Could you please rephrase?";
    }
    
    // Add warnings if any
    if (data.warnings?.length > 0) {
      responseMessage += `\n⚠️ ${data.warnings.join(', ')}`;
    }
    
    addAssistantMessage(responseMessage, data);
    
    // Update UI based on hints
    if (data.ui_hints?.show_disambiguation) {
      // Show disambiguation options
    }
    if (data.ui_hints?.prompt_for_missing) {
      // Highlight missing fields
    }
  };

  const handleDisambiguationSelect = (option: any) => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'disambiguation',
        field: 'recipient',
        selection: option
      }));
    }
    setDisambiguationOptions(null);
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
  };

  return (
    <div className="App" data-testid="app">
      <header className="App-header" data-testid="header">
        <h1>NLP Banking Assistant</h1>
        <div className="account-summary">
          {accounts.map(account => (
            <div key={account.id} className="account-card" data-testid={`account-${account.id}`}>
              <span>{account.name}</span>
              <strong>${account.balance.toFixed(2)}</strong>
            </div>
          ))}
        </div>
      </header>
      
      <main className="chat-container" data-testid="chat-container">
        <div className="messages" data-testid="messages">
          {messages.map(message => (
            <div
              key={message.id}
              className={`message ${message.type}`}
              data-testid={`message-${message.type}`}
            >
              <div className="message-content">
                {message.content}
              </div>
              {message.confidence && (
                <div className="message-meta" data-testid="confidence">
                  Intent: {message.intent} ({(message.confidence * 100).toFixed(0)}%)
                </div>
              )}
            </div>
          ))}
          
          {disambiguationOptions && (
            <div className="disambiguation" data-testid="disambiguation">
              <p>Please select:</p>
              {disambiguationOptions.map((option: any) => (
                <button
                  key={option.id}
                  onClick={() => handleDisambiguationSelect(option)}
                  data-testid={`disambig-${option.id}`}
                >
                  {option.name}
                </button>
              ))}
            </div>
          )}
          
          {isLoading && (
            <div className="message assistant loading" data-testid="loading">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
        
        <div className="quick-actions" data-testid="quick-actions">
          <button onClick={() => handleQuickAction("Check my balance")} data-testid="quick-balance">
            Check Balance
          </button>
          <button onClick={() => handleQuickAction("Send money")} data-testid="quick-transfer">
            Transfer
          </button>
          <button onClick={() => handleQuickAction("Show my recent transactions")} data-testid="quick-history">
            History
          </button>
          <button onClick={() => handleQuickAction("Help")} data-testid="quick-help">
            Help
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="input-form" data-testid="input-form">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything about your banking..."
            disabled={isLoading}
            data-testid="chat-input"
          />
          <button type="submit" disabled={isLoading || !input.trim()} data-testid="send-button">
            Send
          </button>
        </form>
      </main>
    </div>
  );
}

export default App;