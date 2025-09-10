import React, { useState, useEffect } from 'react';
import {
  MantineProvider,
  AppShell,
  Text,
  Button,
  Stack,
  Group,
  Container,
  Card,
  Title,
  SimpleGrid
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { Notifications, notifications } from '@mantine/notifications';
import { BrowserRouter, Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import type { Message, ProcessResponse, UIAssistance, DynamicFormConfig, Account } from './types';
import { BankingScreens } from './components/BankingScreens';
import { DynamicForm } from './components/DynamicForm';
import { ChatPanel } from './components/ChatPanel';
import { Header } from './components/Header';
import { Breadcrumb } from './components/Breadcrumb';
import { NavigationAssistant } from './components/NavigationAssistant';
import { apiService } from './services/api';
import { websocketService, type WebSocketMessageHandler } from './services/websocket';
import { sessionService } from './services/session';
import type { MessageStrategy } from './services/message-strategy';
import { MessageStrategyFactory } from './services/message-strategy';
import { 
  buildNavigationGroups,
  getRouteByPath,
  processIntentNavigation,
  getAllRoutes,
  isValidRoute
} from './services/route-service';
import type { IntentNavigationResult } from './types';

export const MainApp: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [dynamicForm, setDynamicForm] = useState<DynamicFormConfig | null>(null);
  const [showNavigationAssistant, setShowNavigationAssistant] = useState<boolean>(false);
  
  // Navigation groups for header
  const [navigationGroups] = useState(buildNavigationGroups());

  // Derive active tab from URL using modern route service
  const activeTab = getRouteByPath(location.pathname)?.tab || 'banking';

  const form = useForm({
    initialValues: {
      message: ''
    }
  });

  const initializeSession = async () => {
    try {
      await sessionService.initialize();
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

  /**
   * Handle intent-based navigation using the navigation orchestrator
   * Clean component logic that delegates to services
   */
  const handleIntentBasedNavigation = (
    intentId: string, 
    entities: Record<string, unknown> = {},
    uiContext: string = 'banking'
  ): IntentNavigationResult => {
    // Use simple route service instead of complex orchestrator
    const result = processIntentNavigation(intentId, entities, uiContext);

    // Handle UI feedback (stays in component)
    if (result.success && result.route) {
      navigate(result.route);
      
      notifications.show({
        title: 'Navigation',
        message: `Opened ${result.target?.title}`,
        color: 'blue',
      });
    } else {
      notifications.show({
        title: 'Navigation Error',
        message: result.error || 'Unable to navigate',
        color: 'red',
      });
    }

    return result;
  };

  const handleUIAssistance = (uiAssistance: UIAssistance) => {
    if (uiAssistance.type === 'navigation') {
      // Legacy navigation support - use React Router navigation
      try {
        let routePath: string | undefined;
        
        // Try to use route_path from backend response first
        if (uiAssistance.route_path && isValidRoute(uiAssistance.route_path)) {
          routePath = uiAssistance.route_path;
        }
        // Fallback to component name mapping
        else if (uiAssistance.component_name) {
          const route = getAllRoutes().find(r => r.component === uiAssistance.component_name);
          routePath = route?.path;
        }
        
        if (routePath) {
          navigate(routePath);
          // Tab will automatically update based on URL
          
          notifications.show({
            title: 'Navigation',
            message: `Opened ${uiAssistance.title}`,
            color: 'blue',
          });
        } else {
          console.error('No valid route found for navigation assistance:', uiAssistance);
          notifications.show({
            title: 'Navigation Error',
            message: 'Unable to navigate to the requested screen',
            color: 'red',
          });
        }
      } catch (error) {
        console.error('Navigation error:', error);
        notifications.show({
          title: 'Navigation Error', 
          message: 'Failed to navigate to the requested screen',
          color: 'red',
        });
      }
    } else if (uiAssistance.type === 'transaction_form' && uiAssistance.form_config) {
      // Transaction Assistance - navigate to transaction tab and show form
      setDynamicForm(uiAssistance.form_config);
      navigate('/transaction');
      
      notifications.show({
        title: 'Smart Form Created',
        message: `${uiAssistance.form_config.complexity_reduction} simpler than traditional forms`,
        color: 'green',
      });
    }
  };

  const handleProcessResponse = (data: ProcessResponse, messageStrategy: MessageStrategy) => {
    // Determine which navigation approach to use based on context and intent
    const shouldUseIntentBasedNavigation = 
      activeTab === 'banking' && 
      data.intent;

    if (shouldUseIntentBasedNavigation) {
      // Use new intent-based navigation (Universal Schema Approach)
      const navigationResult = handleIntentBasedNavigation(
        data.intent!,
        data.entities as Record<string, unknown> || {},
        activeTab
      );

      // Generate response message based on navigation result
      let responseMessage = data.message || '';
      if (!responseMessage) {
        if (navigationResult.success && navigationResult.target) {
          responseMessage = `Opening ${navigationResult.target.title}...`;
        } else {
          responseMessage = navigationResult.error || "I'm processing your request...";
        }
      }

      messageStrategy.handleAssistantResponse(responseMessage, data);
    } else {
      // Fallback to legacy UI assistance approach
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

      messageStrategy.handleAssistantResponse(responseMessage, data);
    }
  };

  const handleWebSocketMessage = (message: { type: string; data: ProcessResponse }) => {
    if (message.type === 'result') {
      // WebSocket messages are typically part of chat flow, so use persistent strategy
      const messageStrategy = MessageStrategyFactory.createPersistent(addUserMessage, addAssistantMessage);
      handleProcessResponse(message.data, messageStrategy);
    }
  };

  // Handler for Chat Panel form submission
  // Uses persistent session and message strategies - maintains conversation context and history
  const handleSubmit = async (values: { message: string }) => {
    const userMessage = values.message.trim();
    if (!userMessage) return;

    // Close navigation assistant if it's open (prevents form disconnect issues)
    if (showNavigationAssistant) {
      setShowNavigationAssistant(false);
    }

    // Create persistent message strategy for chat history
    const messageStrategy = MessageStrategyFactory.createPersistent(addUserMessage, addAssistantMessage);
    
    messageStrategy.handleUserMessage(userMessage);
    form.reset();

    try {
      // Uses persistent session by default for conversation continuity
      const data = await apiService.processMessage(userMessage, activeTab);
      handleProcessResponse(data, messageStrategy);
    } catch (error) {
      console.error('Error processing message:', error);
      messageStrategy.handleAssistantResponse('Sorry, I encountered an error processing your request.');
    }
  };

  // Handler for Navigation Assistant form submission
  // Uses stateless session and silent message strategies - independent requests without chat pollution
  const handleNavigationSubmit = async (values: { message: string }) => {
    const userMessage = values.message.trim();
    if (!userMessage) return;

    // Close navigation assistant
    setShowNavigationAssistant(false);

    // Create silent message strategy - no chat history pollution
    const messageStrategy = MessageStrategyFactory.createSilent();
    
    messageStrategy.handleUserMessage(userMessage);

    try {
      // Use stateless strategy for navigation requests (no session continuity)
      const data = await apiService.processMessageStateless(userMessage, activeTab);
      handleProcessResponse(data, messageStrategy);
    } catch (error) {
      console.error('Error processing navigation message:', error);
      // Show error via notification instead of chat message
      notifications.show({
        title: 'Navigation Error',
        message: 'Sorry, I encountered an error processing your navigation request.',
        color: 'red',
      });
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
    navigate('/');
  };

  // Main tab content components
  const BankingDashboard = () => (
    <Container size="md" py="xl">
      <Title order={1} ta="center" mb="xl">Your Banking Dashboard</Title>
      
      {/* Main Banking Hubs - moved to top */}
      <SimpleGrid cols={1} spacing="xl" mb="xl">
        <BankingScreens.AccountsOverview accounts={accounts} />
        <BankingScreens.TransfersHub />
        <BankingScreens.BillPayHub />
      </SimpleGrid>

      {/* Quick Actions and AI Assistant - moved to bottom */}
      <SimpleGrid cols={2} spacing="lg">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Text fw={500} mb="xs">Quick Actions</Text>
          <Text size="sm" color="dimmed" mb="md">Common banking tasks</Text>
          <Stack gap="xs">
            <Button 
              variant="light" 
              fullWidth 
              onClick={() => navigate('/banking/accounts')}
              data-testid="dashboard-view-accounts"
            >
              View Accounts
            </Button>
            <Button 
              variant="light" 
              fullWidth 
              onClick={() => navigate('/banking/transfers')}
              data-testid="dashboard-transfer-money"
            >
              Transfer Money
            </Button>
            <Button 
              variant="light" 
              fullWidth 
              onClick={() => navigate('/banking/payments/bills')}
              data-testid="dashboard-pay-bills"
            >
              Pay Bills
            </Button>
          </Stack>
        </Card>
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Text fw={500} mb="xs">AI Assistant</Text>
          <Text size="sm" color="dimmed" mb="md">Natural language banking</Text>
          <Button 
            variant="light" 
            fullWidth 
            onClick={() => navigate('/chat')}
            data-testid="dashboard-open-chat"
          >
            Open Chat Assistant
          </Button>
        </Card>
      </SimpleGrid>
    </Container>
  );

  const ChatTabContent = () => (
    <ChatPanel
      messages={messages}
      form={form}
      isConnected={isConnected}
      onSubmit={handleSubmit}
    />
  );

  const TransactionTabContent = () => (
    <Container size="md" py="xl">
      {dynamicForm ? (
        <DynamicForm
          config={dynamicForm}
          onSubmit={handleDynamicFormSubmit}
          onCancel={() => {
            setDynamicForm(null);
            navigate('/');
          }}
        />
      ) : (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={2} ta="center" mb="md" data-testid="transaction-assistance-title">Transaction Assistance</Title>
          <Text ta="center" color="dimmed" mb="xl" data-testid="transaction-assistance-description">
            Smart forms that adapt to your banking needs. Ask me to help with transfers, payments, or account management.
          </Text>
          <Text ta="center" color="dimmed" size="sm" data-testid="transaction-assistance-help">
            Try: "Help me transfer money to my savings" or "Set up a bill payment"
          </Text>
        </Card>
      )}
    </Container>
  );

  const NotFound = () => (
    <Container size="md" py="xl">
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={2} ta="center" mb="md">Page Not Found</Title>
        <Text ta="center" color="dimmed" mb="xl">
          The page you're looking for doesn't exist.
        </Text>
        <Group justify="center">
          <Button onClick={() => navigate('/')}>
            Go to Dashboard
          </Button>
        </Group>
      </Card>
    </Container>
  );

  // Route component wrapper with breadcrumb navigation
  const RouteComponent: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <Container size="md" py="xl">
        <div style={{ marginBottom: 'var(--mantine-spacing-md)' }}>
          <Breadcrumb 
            getRouteByPath={getRouteByPath}
          />
        </div>
        {children}
      </Container>
    );
  };

  // Default route redirect component
  const DefaultRouteRedirect: React.FC = () => {
    // Get the first route from the route service
    const allRoutes = getAllRoutes();
    const firstRoute = allRoutes[0];
    
    if (firstRoute && firstRoute.path !== '/') {
      // Redirect to first route if it's not '/'
      return <Navigate to={firstRoute.path} replace />;
    } else if (firstRoute?.path === '/') {
      // If first route is '/', render its component directly
      return renderRouteComponent(firstRoute.component);
    }
    
    // Fallback to banking dashboard if no routes found
    return <BankingDashboard />;
  };

  // Component renderer based on route config
  // @FIXME: This is a temporary solution untill we know where the source of truth is
  // If it's on the frontend, we should just render the component directly
  // if on the backend, we should do React.createElement(componentName).
  // Which is already a BFF solution similar to CXP portal.
  const renderRouteComponent = (componentName: string) => {
    switch (componentName) {
      case 'BankingDashboard':
        return <BankingDashboard />;
      case 'ChatPanel':
        return <ChatTabContent />;
      case 'TransactionAssistance':
        return <TransactionTabContent />;
      case 'AccountsOverview':
        return (
          <RouteComponent>
            <BankingScreens.AccountsOverview accounts={accounts} />
          </RouteComponent>
        );
      case 'TransfersHub':
        return (
          <RouteComponent>
            <BankingScreens.TransfersHub />
          </RouteComponent>
        );
      case 'WireTransferForm':
        return (
          <RouteComponent>
            <BankingScreens.WireTransferForm />
          </RouteComponent>
        );
      case 'BillPayHub':
        return (
          <RouteComponent>
            <BankingScreens.BillPayHub />
          </RouteComponent>
        );
      case 'AccountDetails':
        return (
          <RouteComponent>
            <BankingScreens.AccountDetails accounts={accounts} />
          </RouteComponent>
        );
      default:
        return <NotFound />;
    }
  };





  // Handle root redirect
  useEffect(() => {
    if (location.pathname === '/') {
      const rootRoute = getRouteByPath('/');
      if (rootRoute?.redirectTo) {
        navigate(rootRoute.redirectTo, { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  // Initialize app on startup
  useEffect(() => {
    initializeSession();
    loadAccounts();
    connectWebSocket();

    return () => {
      websocketService.disconnect(ws);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MantineProvider>
      <div data-testid="app">
        <AppShell
          header={{ height: 56 }}
          padding="md"
        >
          <Header isConnected={isConnected} navigationGroups={navigationGroups} />

          <AppShell.Main>
            <Container size="xl">
              {/* Main Content Area - Configuration-driven Routes */}
              <Container size="xl" pt="md">
                <Routes>
                  {/* Default route - redirect to first fetched route */}
                  <Route path="/" element={<DefaultRouteRedirect />} />
                  
                  {/* Generate routes from modern route service */}
                  {getAllRoutes().map((route) => (
                    <Route 
                      key={route.path}
                      path={route.path} 
                      element={renderRouteComponent(route.component)} 
                    />
                  ))}
                  
                  {/* 404 - Must be last */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Container>

              {/* Floating AI Navigation Assistant - Only show on banking routes */}
              {activeTab === 'banking' && (
                <NavigationAssistant
                  isVisible={showNavigationAssistant}
                  isConnected={isConnected}
                  onClose={() => setShowNavigationAssistant(false)}
                  onOpen={() => setShowNavigationAssistant(true)}
                  onSubmit={handleNavigationSubmit}
                />
              )}
            </Container>
          </AppShell.Main>
        </AppShell>
      </div>
      <Notifications />
    </MantineProvider>
  );
};

// Wrapper component with BrowserRouter
const App: React.FC = () => {
  return (
    <BrowserRouter>
      <MainApp />
    </BrowserRouter>
  );
};

export default App;
