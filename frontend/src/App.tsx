import { useState, useEffect, useRef } from 'react';
import {
  MantineProvider,
  AppShell,
  Container,
  Title,
  Paper,
  TextInput,
  Button,
  Stack,
  Group,
  Text,
  Badge,
  Card,
  Grid,
  Loader,
  Alert,
  ActionIcon,
  Avatar,
  Menu,
  Divider,
  ScrollArea,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { Notifications } from '@mantine/notifications';
import {
  IconSend,
  IconCreditCard,
  IconHistory,
  IconHelpCircle,
  IconCurrencyDollar,
  IconUser,
  IconLogout,
  IconSettings,
} from '@tabler/icons-react';
import axios from 'axios';

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

interface Account {
  id: string;
  name: string;
  balance: number;
  type: string;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [disambiguationOptions, setDisambiguationOptions] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const form = useForm({
    initialValues: {
      message: '',
    },
  });

  useEffect(() => {
    initializeSession();
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
      const response = await axios.post(`${API_BASE}/api/session`);
      const data = response.data;
      setSessionId(data.session_id);
      
      // Initialize WebSocket
      const ws = new WebSocket(`ws://localhost:8000/ws/${data.session_id}`);
      
      ws.onopen = () => {
        addSystemMessage('Connected to EBP Banking Assistant 🏦');
      };
      
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      };
      
      ws.onerror = (error) => {
        notifications.show({
          title: 'Connection Error',
          message: 'Failed to connect to banking assistant',
          color: 'red',
        });
      };
      
      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to initialize session:', error);
      notifications.show({
        title: 'Session Error',
        message: 'Failed to initialize banking session',
        color: 'red',
      });
    }
  };

  const loadAccounts = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/accounts`);
      setAccounts(response.data.accounts);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      notifications.show({
        title: 'Account Error',
        message: 'Failed to load account information',
        color: 'orange',
      });
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

  const handleSubmit = async (values: { message: string }) => {
    if (!values.message.trim() || !sessionId) return;

    const query = values.message;
    form.reset();
    addUserMessage(query);
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/api/process`, {
        query,
        session_id: sessionId
      });

      handleProcessResponse(response.data);
    } catch (error) {
      console.error('Failed to process query:', error);
      notifications.show({
        title: 'Processing Error',
        message: 'Sorry, there was an error processing your request',
        color: 'red',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessResponse = (data: ProcessResponse) => {
    let responseMessage = '';
    
    switch (data.intent) {
      case 'balance':
        if (data.execution?.success) {
          responseMessage = `Your ${data.entities.account || 'account'} balance is $${data.execution.data.balance.toFixed(2)}`;
        } else {
          responseMessage = 'I can help you check your balance. Which account would you like to check?';
        }
        break;
        
      case 'transfer':
        if (data.missing_fields?.length > 0) {
          responseMessage = `I need more information to complete the transfer. Please provide: ${data.missing_fields.join(', ')}`;
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
    
    if (data.warnings?.length > 0) {
      responseMessage += `\n⚠️ ${data.warnings.join(', ')}`;
    }
    
    addAssistantMessage(responseMessage, data);
  };

  const handleQuickAction = (action: string) => {
    form.setFieldValue('message', action);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.6) return 'yellow';
    return 'red';
  };

  return (
    <MantineProvider>
      <Notifications />
      <div data-testid="app">
        <AppShell
          header={{ height: 70 }}
          padding="md"
        >
          <AppShell.Header data-testid="header">
            <Container size="xl" h="100%">
              <Group justify="space-between" h="100%">
                <Group>
                  <IconCurrencyDollar size={32} color="blue" />
                  <Title order={2} c="blue">EBP Banking Assistant</Title>
                </Group>
              
              <Group>
                <Menu>
                  <Menu.Target>
                    <ActionIcon variant="subtle" size="lg">
                      <IconUser size={20} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconSettings size={16} />}>
                      Settings
                    </Menu.Item>
                    <Menu.Item leftSection={<IconLogout size={16} />}>
                      Logout
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Group>
          </Container>
        </AppShell.Header>

        <AppShell.Main>
          <Container size="xl">
            <Grid>
              {/* Account Summary */}
              <Grid.Col span={12}>
                <Paper p="md" shadow="sm">
                  <Title order={3} mb="md">Account Overview</Title>
                  <Grid>
                    {accounts.map(account => (
                      <Grid.Col key={account.id} span={{ base: 12, sm: 6, md: 4 }}>
                        <Card withBorder>
                          <Text size="sm" c="dimmed">{account.name}</Text>
                          <Text size="xl" fw={700}>${account.balance.toFixed(2)}</Text>
                          <Badge variant="light" size="sm">{account.type}</Badge>
                        </Card>
                      </Grid.Col>
                    ))}
                  </Grid>
                </Paper>
              </Grid.Col>

              {/* Chat Interface */}
              <Grid.Col span={12}>
                <Paper p="md" shadow="sm" style={{ height: '500px', display: 'flex', flexDirection: 'column' }}>
                  <Title order={3} mb="md">Chat with Assistant</Title>
                  
                  <ScrollArea style={{ flex: 1 }} mb="md">
                    <Stack gap="sm">
                      {messages.map(message => (
                        <Paper
                          key={message.id}
                          p="sm"
                          bg={message.type === 'user' ? 'blue.1' : message.type === 'system' ? 'gray.1' : 'green.1'}
                          data-testid={`message-${message.type}`}
                        >
                          <Group justify="space-between" mb="xs">
                            <Badge
                              variant="light"
                              color={message.type === 'user' ? 'blue' : message.type === 'system' ? 'gray' : 'green'}
                            >
                              {message.type}
                            </Badge>
                            {message.confidence && (
                              <Badge
                                variant="light"
                                color={getConfidenceColor(message.confidence)}
                              >
                                {message.intent} ({(message.confidence * 100).toFixed(0)}%)
                              </Badge>
                            )}
                          </Group>
                          <Text size="sm">{message.content}</Text>
                        </Paper>
                      ))}
                      
                      {disambiguationOptions && (
                        <Alert title="Please select an option:" color="blue">
                          <Stack gap="xs">
                            {disambiguationOptions.map((option: any) => (
                              <Button
                                key={option.id}
                                variant="light"
                                size="xs"
                                onClick={() => {
                                  if (wsRef.current) {
                                    wsRef.current.send(JSON.stringify({
                                      type: 'disambiguation',
                                      field: 'recipient',
                                      selection: option
                                    }));
                                  }
                                  setDisambiguationOptions(null);
                                }}
                              >
                                {option.name}
                              </Button>
                            ))}
                          </Stack>
                        </Alert>
                      )}
                      
                      {isLoading && (
                        <Paper p="sm" bg="gray.1">
                          <Group>
                            <Loader size="sm" />
                            <Text size="sm" c="dimmed">Assistant is thinking...</Text>
                          </Group>
                        </Paper>
                      )}
                      
                      <div ref={messagesEndRef} />
                    </Stack>
                  </ScrollArea>

                  {/* Quick Actions */}
                  <Group mb="md">
                    <Button
                      variant="light"
                      leftSection={<IconCurrencyDollar size={16} />}
                      onClick={() => handleQuickAction("Check my balance")}
                    >
                      Check Balance
                    </Button>
                    <Button
                      variant="light"
                      leftSection={<IconCreditCard size={16} />}
                      onClick={() => handleQuickAction("Send money")}
                    >
                      Transfer
                    </Button>
                    <Button
                      variant="light"
                      leftSection={<IconHistory size={16} />}
                      onClick={() => handleQuickAction("Show my recent transactions")}
                    >
                      History
                    </Button>
                    <Button
                      variant="light"
                      leftSection={<IconHelpCircle size={16} />}
                      onClick={() => handleQuickAction("Help")}
                    >
                      Help
                    </Button>
                  </Group>

                  {/* Message Input */}
                  <form onSubmit={form.onSubmit(handleSubmit)}>
                    <Group>
                      <TextInput
                        {...form.getInputProps('message')}
                        placeholder="Ask me anything about your banking..."
                        style={{ flex: 1 }}
                        disabled={isLoading}
                        data-testid="chat-input"
                      />
                      <Button
                        type="submit"
                        leftSection={<IconSend size={16} />}
                        disabled={isLoading || !form.values.message.trim()}
                        data-testid="send-button"
                      >
                        Send
                      </Button>
                    </Group>
                  </form>
                </Paper>
              </Grid.Col>
            </Grid>
          </Container>
        </AppShell.Main>
        </AppShell>
      </div>
    </MantineProvider>
  );
}

export default App;
