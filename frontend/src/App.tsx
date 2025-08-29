import React, { useState, useEffect } from 'react';
import {
  MantineProvider,
  AppShell,
  Text,
  Button,
  Stack,
  Group,
  TextInput,
  Container,
  Card,
  Title,
  SimpleGrid,
  Tabs,
  ActionIcon,
  Affix,
  Transition
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import type { Message, ProcessResponse, UIAssistance, DynamicFormConfig, Account } from './types';
import { BankingScreens } from './components/BankingScreens';
import { DynamicForm } from './components/DynamicForm';
import { ChatPanel } from './components/ChatPanel';
import { Header } from './components/Header';
import { apiService } from './services/api';
import { websocketService, type WebSocketMessageHandler } from './services/websocket';









const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentScreen, setCurrentScreen] = useState<string | null>(null);
  const [dynamicForm, setDynamicForm] = useState<DynamicFormConfig | null>(null);
  const [activeTab, setActiveTab] = useState<string>('banking');
  const [showNavigationAssistant, setShowNavigationAssistant] = useState<boolean>(false);

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
      websocketService.disconnect(ws);
    };
  }, []);

  const initializeSession = async () => {
    try {
      await apiService.initializeSession();
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
    const handleMessage: WebSocketMessageHandler = (message) => {
      handleWebSocketMessage(message);
    };
    
    const websocket = websocketService.connect(handleMessage);
    
    websocket.onopen = () => {
      setIsConnected(true);
      setWs(websocket);
    };

    websocket.onclose = () => {
      setIsConnected(false);
      setWs(null);
    };
  };

  const loadAccounts = async () => {
    try {
      const accounts = await apiService.getAccounts();
      setAccounts(accounts);
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  };

  const addSystemMessage = (content: string) => {
    const message: Message = {
      id: crypto.randomUUID(),
      type: 'system',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const addUserMessage = (content: string) => {
    const message: Message = {
      id: crypto.randomUUID(),
      type: 'user',
      content,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const addAssistantMessage = (content: string, data?: ProcessResponse) => {
    const message: Message = {
      id: crypto.randomUUID(),
      type: 'assistant',
      content,
      intent: data?.intent,
      confidence: data?.confidence,
      entities: data?.entities,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const handleWebSocketMessage = (message: { type: string; data: ProcessResponse }) => {
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
      const data = await apiService.processMessage(userMessage, activeTab);
      handleProcessResponse(data);
    } catch (error) {
      console.error('Error processing message:', error);
      addAssistantMessage('Sorry, I encountered an error processing your request.');
    }
  };

  const handleDynamicFormSubmit = (formData: Record<string, unknown>) => {
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



  return (
    <MantineProvider>
      <div data-testid="app">
        <AppShell
          header={{ height: 60 }}
          padding="md"
        >
          <Header isConnected={isConnected} />

          <AppShell.Main>
            <Container size="xl">
              <Tabs value={activeTab} onChange={setActiveTab}>
                <Tabs.List>
                  <Tabs.Tab value="banking">🧭 Navigation Assistance</Tabs.Tab>
                  <Tabs.Tab value="transaction">📝 Transaction Assistance</Tabs.Tab>
                  <Tabs.Tab value="chat">💬 Chat Assistant</Tabs.Tab>
                </Tabs.List>

                <Tabs.Panel value="chat" pt="md">
                  <ChatPanel
                    messages={messages}
                    form={form}
                    isConnected={isConnected}
                    onSubmit={handleSubmit}
                  />
                </Tabs.Panel>

                <Tabs.Panel value="banking" pt="md">
                  <Container size="md" py="xl">
                    {/* Show traditional banking UI by default */}
                    {!currentScreen && (
                      <>
                        <Title order={1} ta="center" mb="xl">Your Banking Dashboard</Title>
                        <SimpleGrid cols={1} spacing="xl">
                          <BankingScreens.AccountsOverview accounts={accounts} />
                          <BankingScreens.TransfersHub />
                          <BankingScreens.BillPayHub />
                        </SimpleGrid>
                      </>
                    )}
                    
                    {/* Show specific banking screen when navigated */}
                    {renderBankingScreen()}
                    
                    {/* Floating AI Navigation Assistant */}
                    <Affix position={{ bottom: 20, right: 20 }}>
                      <Transition transition="slide-up" mounted={!showNavigationAssistant}>
                        {(transitionStyles) => (
                          <ActionIcon
                            size="xl"
                            radius="xl"
                            variant="filled"
                            color="blue"
                            style={{ ...transitionStyles }}
                            onClick={() => setShowNavigationAssistant(true)}
                            title="Navigation Assistant"
                          >
                            🤖
                          </ActionIcon>
                        )}
                      </Transition>
                    </Affix>
                    
                    {/* Navigation Assistant Modal/Overlay */}
                    {showNavigationAssistant && (
                      <Card 
                        shadow="xl" 
                        padding="lg" 
                        radius="md" 
                        withBorder 
                        style={{
                          position: 'fixed',
                          bottom: 80,
                          right: 20,
                          width: 400,
                          zIndex: 1000,
                          background: 'white'
                        }}
                      >
                        <Group position="apart" mb="md">
                          <Group>
                            <Text>🤖</Text>
                            <Text fw={500}>Navigation Assistant</Text>
                          </Group>
                          <ActionIcon 
                            size="sm" 
                            variant="subtle"
                            onClick={() => setShowNavigationAssistant(false)}
                          >
                            ✕
                          </ActionIcon>
                        </Group>
                        
                        <Text size="sm" color="dimmed" mb="md">
                          Tell me where you want to go and I'll take you there.
                        </Text>
                        
                        <form onSubmit={form.onSubmit(handleSubmit)}>
                          <Stack spacing="sm">
                            <TextInput
                              {...form.getInputProps('message')}
                              placeholder="Try: 'Take me to international transfers'"
                              size="sm"
                            />
                            <Group position="apart">
                              <Button 
                                size="xs" 
                                variant="subtle" 
                                onClick={() => form.setFieldValue('message', 'Take me to international transfers')}
                              >
                                International Transfers
                              </Button>
                              <Button 
                                size="xs" 
                                variant="subtle" 
                                onClick={() => form.setFieldValue('message', 'Show me account overview')}
                              >
                                Account Overview
                              </Button>
                            </Group>
                            <Button 
                              type="submit" 
                              disabled={!isConnected}
                              size="sm"
                              onClick={() => setShowNavigationAssistant(false)}
                            >
                              Navigate
                            </Button>
                          </Stack>
                        </form>
                      </Card>
                    )}
                  </Container>
                </Tabs.Panel>

                <Tabs.Panel value="transaction" pt="md">
                  <Container size="md" py="xl">
                    {dynamicForm ? (
                      <DynamicForm
                        config={dynamicForm}
                        onSubmit={handleDynamicFormSubmit}
                        onCancel={() => {
                          setDynamicForm(null);
                          setActiveTab('banking');
                        }}
                      />
                    ) : (
                      <Card shadow="sm" padding="lg" radius="md" withBorder>
                        <Title order={2} ta="center" mb="md">Transaction Assistance</Title>
                        <Text ta="center" color="dimmed" mb="xl">
                          Smart forms will appear here when you make transaction requests through the chat assistant.
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
