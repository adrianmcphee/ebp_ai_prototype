import React, { useState, useEffect } from 'react';
import {
  MantineProvider,
  AppShell,
  Text,
  TextInput,
  Button,
  Stack,
  Paper,
  Badge,
  Group,
  Container,
  Card,
  Title,
  Notification,
  Loader,
  SimpleGrid,
  Space,
  Divider,
  Tabs,
  Select,
  NumberInput,
  Checkbox,
  Textarea,
  Modal,
  Box
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import axios from 'axios';

// Types
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
  status: string;
  intent?: string;
  confidence?: number;
  entities?: any;
  message?: string;
  ui_assistance?: UIAssistance;
  execution?: any;
  [key: string]: any;
}

interface UIAssistance {
  type: 'navigation' | 'transaction_form';
  action: string;
  screen_id?: string;
  route_path?: string;
  component_name?: string;
  form_config?: DynamicFormConfig;
  title?: string;
  subtitle?: string;
  description?: string;
  success_message?: string;
}

interface DynamicFormConfig {
  screen_id: string;
  title: string;
  subtitle: string;
  fields: FormField[];
  confirmation_required: boolean;
  complexity_reduction: string;
}

interface FormField {
  id: string;
  type: string;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  value?: any;
  pre_filled?: boolean;
  help_text?: string;
  conditional_on?: string;
  hidden?: boolean;
}

interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
}

// Pre-built Banking Screens
const BankingScreens = {
  AccountsOverview: ({ accounts }: { accounts: Account[] }) => (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Title order={2} mb="md">Your Accounts</Title>
      <SimpleGrid cols={2}>
        {accounts.map(account => (
          <Paper key={account.id} p="md" withBorder>
            <Text size="sm" color="dimmed">{account.type}</Text>
                         <Text fw={500}>{account.name}</Text>
             <Text size="xl" fw={700} c="blue">
              ${account.balance.toFixed(2)}
            </Text>
          </Paper>
        ))}
      </SimpleGrid>
    </Card>
  ),

  TransfersHub: () => (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Title order={2} mb="md">Money Transfers</Title>
      <SimpleGrid cols={3}>
                 <Paper p="md" withBorder style={{ textAlign: 'center' }}>
           <Text fw={500} mb="xs">Internal Transfer</Text>
           <Text size="sm" c="dimmed">Between your accounts</Text>
           <Button variant="light" mt="md" fullWidth>Start Transfer</Button>
         </Paper>
         <Paper p="md" withBorder style={{ textAlign: 'center' }}>
           <Text fw={500} mb="xs">External Transfer</Text>
           <Text size="sm" c="dimmed">To other banks</Text>
           <Button variant="light" mt="md" fullWidth>Send Money</Button>
         </Paper>
         <Paper p="md" withBorder style={{ textAlign: 'center' }}>
           <Text fw={500} mb="xs">International Wire</Text>
           <Text size="sm" c="dimmed">Global transfers</Text>
           <Button variant="light" mt="md" fullWidth>Wire Money</Button>
         </Paper>
       </SimpleGrid>
     </Card>
   ),

   WireTransferForm: () => (
     <Card shadow="sm" padding="lg" radius="md" withBorder>
       <Title order={2} mb="md">International Wire Transfer</Title>
       <Text size="sm" c="dimmed" mb="lg">Complete form with all required fields</Text>
       <Stack gap="md">
        <TextInput label="Recipient Name" placeholder="Full name" required />
        <TextInput label="Recipient Address Line 1" placeholder="Street address" required />
        <TextInput label="Recipient Address Line 2" placeholder="Apt, suite, etc." />
        <TextInput label="Bank Name" placeholder="Recipient bank" required />
        <TextInput label="Bank Address" placeholder="Bank address" required />
        <TextInput label="SWIFT/BIC Code" placeholder="SWIFT code" required />
        <TextInput label="IBAN" placeholder="International account number" />
        <TextInput label="Account Number" placeholder="Account number" required />
        <TextInput label="Routing Number" placeholder="Routing number" />
        <TextInput label="Correspondent Bank" placeholder="If required" />
        <Select 
          label="Purpose Code" 
          placeholder="Select purpose"
          data={Array.from({length: 20}, (_, i) => `Purpose ${i + 1}`)}
          required 
        />
        <NumberInput label="Amount" placeholder="0.00" required />
        <Button size="lg" mt="md">Submit Wire Transfer</Button>
      </Stack>
    </Card>
  ),

  BillPayHub: () => (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Title order={2} mb="md">Pay Bills</Title>
      <Text mb="lg">Manage your bill payments and payees</Text>
      <SimpleGrid cols={2}>
                 <Paper p="md" withBorder>
           <Text fw={500} mb="xs">Upcoming Bills</Text>
           <Text size="sm" c="dimmed">3 bills due this week</Text>
           <Button variant="light" mt="md" fullWidth>View Bills</Button>
         </Paper>
         <Paper p="md" withBorder>
           <Text fw={500} mb="xs">Add New Payee</Text>
           <Text size="sm" c="dimmed">Set up new bill payment</Text>
           <Button variant="light" mt="md" fullWidth>Add Payee</Button>
         </Paper>
      </SimpleGrid>
    </Card>
  )
};

// Dynamic Form Component
const DynamicForm: React.FC<{ 
  config: DynamicFormConfig;
  onSubmit: (data: any) => void;
  onCancel: () => void;
}> = ({ config, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Record<string, any>>({});

  // Initialize form with pre-filled values
  useEffect(() => {
    const initialData: Record<string, any> = {};
    config.fields.forEach(field => {
      if (field.value !== undefined) {
        initialData[field.id] = field.value;
      }
    });
    setFormData(initialData);
  }, [config]);

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const renderField = (field: FormField) => {
    if (field.hidden) return null;

    const commonProps = {
      key: field.id,
      label: field.label,
      placeholder: field.placeholder,
      required: field.required,
      value: formData[field.id] || '',
      onChange: (value: any) => handleFieldChange(field.id, value),
      description: field.help_text
    };

    switch (field.type) {
      case 'amount':
        return (
                     <NumberInput
             {...commonProps}
             decimalScale={2}
             min={0}
             leftSection="$"
             onChange={(value) => handleFieldChange(field.id, value)}
           />
        );

      case 'dropdown':
        return (
          <Select
            {...commonProps}
            data={field.options || []}
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        );

      case 'account_select':
        return (
          <Select
            {...commonProps}
            data={['Checking Account - $2,150.00', 'Savings Account - $15,432.18']}
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        );

      case 'recipient_select':
        return (
          <Select
            {...commonProps}
            data={['John Smith', 'Sarah Johnson', 'Mike Chen', 'Add New Recipient']}
            searchable
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        );

      case 'checkbox':
        return (
          <Checkbox
            key={field.id}
            label={field.label}
            checked={formData[field.id] || false}
            onChange={(event) => handleFieldChange(field.id, event.currentTarget.checked)}
          />
        );

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            onChange={(event) => handleFieldChange(field.id, event.currentTarget.value)}
          />
        );

      default:
        return (
          <TextInput
            {...commonProps}
            onChange={(event) => handleFieldChange(field.id, event.currentTarget.value)}
          />
        );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group position="apart" mb="md">
        <div>
          <Title order={2}>{config.title}</Title>
          <Text size="sm" color="dimmed">{config.subtitle}</Text>
        </div>
        <Badge color="green" variant="light">
          {config.complexity_reduction} simpler
        </Badge>
      </Group>

      <form onSubmit={handleSubmit}>
        <Stack spacing="md">
          {config.fields.map(renderField)}
          
          <Group position="apart" mt="xl">
            <Button variant="subtle" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" size="lg">
              {config.confirmation_required ? 'Review & Confirm' : 'Submit'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
};

const API_BASE = 'http://localhost:8000';

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentScreen, setCurrentScreen] = useState<string | null>(null);
  const [dynamicForm, setDynamicForm] = useState<DynamicFormConfig | null>(null);
  const [activeTab, setActiveTab] = useState<string>('chat');

  const form = useForm({
    initialValues: {
      message: ''
    }
  });

  useEffect(() => {
    initializeSession();
    loadAccounts();
    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const initializeSession = async () => {
    try {
      await axios.post(`${API_BASE}/api/session`);
      addSystemMessage('Connected to EBP Banking Assistant');
    } catch (error) {
      console.error('Failed to initialize session:', error);
      notifications.show({
        title: 'Connection Error',
        message: 'Failed to connect to banking assistant',
        color: 'red',
      });
    }
  };

  const connectWebSocket = () => {
    const websocket = new WebSocket(`ws://localhost:8000/ws/${Date.now()}`);
    
    websocket.onopen = () => {
      setIsConnected(true);
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };

    websocket.onclose = () => {
      setIsConnected(false);
      setWs(null);
    };
  };

  const loadAccounts = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/accounts`);
      setAccounts(response.data.accounts);
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

  const addAssistantMessage = (content: string, data?: ProcessResponse) => {
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
    }
  };

  const handleProcessResponse = (data: ProcessResponse) => {
    // Handle UI assistance first
    if (data.ui_assistance) {
      handleUIAssistance(data.ui_assistance);
    }

    // Generate appropriate response message
    let responseMessage = data.message || '';
    
    if (!responseMessage) {
      if (data.ui_assistance?.type === 'navigation') {
        responseMessage = `Opening ${data.ui_assistance.title}...`;
      } else if (data.ui_assistance?.type === 'transaction_form') {
        responseMessage = `I've created a streamlined form for you.`;
      } else {
        responseMessage = "I'm processing your request...";
      }
    }

    addAssistantMessage(responseMessage, data);
  };

  const handleUIAssistance = (uiAssistance: UIAssistance) => {
    if (uiAssistance.type === 'navigation') {
      // Navigation Assistance - show pre-built screen
      setCurrentScreen(uiAssistance.component_name || '');
      setActiveTab('banking');
      
      notifications.show({
        title: 'Navigation',
        message: `Opened ${uiAssistance.title}`,
        color: 'blue',
      });
    } else if (uiAssistance.type === 'transaction_form' && uiAssistance.form_config) {
      // Transaction Assistance - show dynamic form
      setDynamicForm(uiAssistance.form_config);
      setActiveTab('transaction');
      
      notifications.show({
        title: 'Smart Form Created',
        message: `${uiAssistance.form_config.complexity_reduction} simpler than traditional forms`,
        color: 'green',
      });
    }
  };

  const handleSubmit = async (values: { message: string }) => {
    const userMessage = values.message.trim();
    if (!userMessage) return;

    addUserMessage(userMessage);
    form.reset();

    try {
      const response = await axios.post(`${API_BASE}/api/process`, {
        query: userMessage
      });
      handleProcessResponse(response.data);
    } catch (error) {
      console.error('Error processing message:', error);
      addAssistantMessage('Sorry, I encountered an error processing your request.');
    }
  };

  const handleDynamicFormSubmit = (formData: any) => {
    console.log('Form submitted:', formData);
    notifications.show({
      title: 'Form Submitted',
      message: 'Your transaction has been processed',
      color: 'green',
    });
    setDynamicForm(null);
    setActiveTab('chat');
  };

  const renderBankingScreen = () => {
    if (!currentScreen) {
      return (
        <Container size="md" py="xl">
          <Title order={2} ta="center" mb="xl">Banking Dashboard</Title>
          <SimpleGrid cols={2} spacing="lg">
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Text weight={500} mb="xs">Quick Actions</Text>
              <Text size="sm" color="dimmed" mb="md">Common banking tasks</Text>
              <Stack spacing="xs">
                <Button variant="light" fullWidth onClick={() => setCurrentScreen('AccountsOverview')}>
                  View Accounts
                </Button>
                <Button variant="light" fullWidth onClick={() => setCurrentScreen('TransfersHub')}>
                  Transfer Money
                </Button>
                <Button variant="light" fullWidth onClick={() => setCurrentScreen('BillPayHub')}>
                  Pay Bills
                </Button>
              </Stack>
            </Card>
            <Card shadow="sm" padding="lg" radius="md" withBorder>
              <Text weight={500} mb="xs">AI Assistant</Text>
              <Text size="sm" color="dimmed" mb="md">Natural language banking</Text>
              <Button variant="light" fullWidth onClick={() => setActiveTab('chat')}>
                Open Chat Assistant
              </Button>
            </Card>
          </SimpleGrid>
        </Container>
      );
    }

    // Render specific banking screen
    const ScreenComponent = BankingScreens[currentScreen as keyof typeof BankingScreens];
    if (ScreenComponent) {
      return (
        <Container size="md" py="xl">
          <Button variant="subtle" mb="md" onClick={() => setCurrentScreen(null)}>
            ← Back to Dashboard
          </Button>
          <ScreenComponent accounts={accounts} />
        </Container>
      );
    }

    return <div>Screen not found</div>;
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.6) return 'yellow';
    return 'red';
  };

  return (
    <MantineProvider>
      <div data-testid="app">
        <AppShell
          header={{ height: 60 }}
          padding="md"
        >
          <AppShell.Header data-testid="header">
            <Container size="xl" h="100%">
              <Group h="100%" px="md" position="apart">
                <Title order={3}>EBP Banking AI Prototype</Title>
                <Group>
                  <Badge color={isConnected ? 'green' : 'red'} variant="light">
                    {isConnected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </Group>
              </Group>
            </Container>
          </AppShell.Header>

          <AppShell.Main>
            <Container size="xl">
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                  <Tabs.Tab value="chat">💬 Chat Assistant</Tabs.Tab>
                  <Tabs.Tab value="banking">🏦 Banking Screens</Tabs.Tab>
                  <Tabs.Tab value="transaction">📝 Smart Forms</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="chat" pt="md">
                  <Card shadow="sm" padding="lg" radius="md" withBorder>
                    <Stack spacing="xs" style={{ height: '400px', overflowY: 'auto' }} mb="md">
                      {messages.map((message) => (
                        <Paper
                          key={message.id}
                          data-testid={`message-${message.type}`}
                          p="sm"
                          style={{
                            backgroundColor: message.type === 'user' ? '#e3f2fd' : 
                                           message.type === 'assistant' ? '#f3e5f5' : '#fff3e0',
                            alignSelf: message.type === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '80%'
                          }}
                        >
                          <Text size="sm">{message.content}</Text>
                          {message.confidence !== undefined && (
                            <Badge 
                              size="xs" 
                              color={getConfidenceColor(message.confidence)}
                              mt="xs"
                            >
                              {Math.round(message.confidence * 100)}% confident
                            </Badge>
                          )}
                        </Paper>
                      ))}
                    </Stack>

                    <form onSubmit={form.onSubmit(handleSubmit)}>
                      <Group>
                        <TextInput
                          data-testid="chat-input"
                          {...form.getInputProps('message')}
                          placeholder="Try: 'Take me to transfers' or 'Send $500 to John'"
                          style={{ flex: 1 }}
                        />
                        <Button 
                          data-testid="send-button"
                          type="submit" 
                          disabled={!isConnected}
                        >
                          Send
                        </Button>
                      </Group>
                    </form>

                    <Group mt="md" spacing="xs">
                      <Text size="xs" color="dimmed">Quick examples:</Text>
                      <Button size="xs" variant="subtle" onClick={() => form.setFieldValue('message', 'Take me to international transfers')}>
                        Navigation
                      </Button>
                      <Button size="xs" variant="subtle" onClick={() => form.setFieldValue('message', 'Send $500 to my friend in Canada')}>
                        Transaction
                      </Button>
                      <Button size="xs" variant="subtle" onClick={() => form.setFieldValue('message', 'What\'s my balance?')}>
                        Balance
                      </Button>
                    </Group>
                  </Card>
                </Tabs.Panel>

                <Tabs.Panel value="banking" pt="md">
                  {renderBankingScreen()}
                </Tabs.Panel>

                <Tabs.Panel value="transaction" pt="md">
                  <Container size="md" py="xl">
                    {dynamicForm ? (
                      <DynamicForm
                        config={dynamicForm}
                        onSubmit={handleDynamicFormSubmit}
                        onCancel={() => {
                          setDynamicForm(null);
                          setActiveTab('chat');
                        }}
                      />
                    ) : (
                      <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Title order={2} ta="center" mb="md">Smart Transaction Forms</Title>
                        <Text ta="center" color="dimmed" mb="xl">
                          Dynamic forms will appear here when you make transaction requests through the chat assistant.
                        </Text>
                        <Text ta="center">
                          Try saying: "Send $500 to my friend in Canada" in the chat to see a custom form.
                        </Text>
                      </Card>
                    )}
                  </Container>
                </Tabs.Panel>
              </Tabs>
            </Container>
          </AppShell.Main>
        </AppShell>
      </div>
    </MantineProvider>
  );
};

export default App;
