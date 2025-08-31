import React from 'react';
import {
  Card,
  Text,
  Button,
  Stack,
  Group,
  TextInput,
  ActionIcon,
  Affix,
  Transition
} from '@mantine/core';
import { useForm } from '@mantine/form';

interface NavigationAssistantProps {
  /** Whether the assistant is visible */
  isVisible: boolean;
  /** Whether the connection is active */
  isConnected: boolean;
  /** Callback to close the assistant */
  onClose: () => void;
  /** Callback when assistant should be opened */
  onOpen: () => void;
  /** Callback when form is submitted */
  onSubmit: (values: { message: string }) => void;
}

export const NavigationAssistant: React.FC<NavigationAssistantProps> = ({
  isVisible,
  isConnected,
  onClose,
  onOpen,
  onSubmit
}) => {
  const form = useForm({
    initialValues: {
      message: ''
    }
  });

  const handleFormSubmit = (values: { message: string }) => {
    const userMessage = values.message.trim();
    if (!userMessage) return;

    onSubmit(values);
    form.reset();
  };

  const setSuggestion = (message: string) => {
    form.setFieldValue('message', message);
  };

  return (
    <>
      {/* Floating Assistant Button */}
      <Affix position={{ bottom: 20, right: 20 }}>
        <Transition transition="slide-up" mounted={!isVisible}>
          {(transitionStyles) => (
            <ActionIcon
              size="xl"
              radius="xl"
              variant="filled"
              color="blue"
              style={{ ...transitionStyles }}
              onClick={onOpen}
              title="Navigation Assistant"
              data-testid="navigation-assistant-open-button"
            >
              🤖
            </ActionIcon>
          )}
        </Transition>
      </Affix>
      
      {/* Navigation Assistant Modal/Overlay */}
      {isVisible && (
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
          data-testid="navigation-assistant-modal"
        >
          <Group justify="apart" mb="md">
            <Group>
              <Text>🤖</Text>
              <Text fw={500} data-testid="navigation-assistant-title">
                Navigation Assistant
              </Text>
            </Group>
            <ActionIcon 
              size="sm" 
              variant="subtle"
              onClick={onClose}
              data-testid="navigation-assistant-close"
            >
              ✕
            </ActionIcon>
          </Group>
          
          <Text size="sm" color="dimmed" mb="md" data-testid="navigation-assistant-description">
            Tell me where you want to go and I'll take you there.
          </Text>
          
          <form onSubmit={form.onSubmit(handleFormSubmit)}>
            <Stack gap="sm">
              <TextInput
                {...form.getInputProps('message')}
                placeholder="Try: 'Take me to international transfers'"
                size="sm"
                data-testid="navigation-assistant-input"
              />
              
              <Group justify="center" gap="xs">
                <Button 
                  size="xs" 
                  variant="subtle" 
                  onClick={() => setSuggestion('Take me to international transfers')}
                  data-testid="suggestion-international-transfers"
                >
                  International Transfers
                </Button>
                <Button 
                  size="xs" 
                  variant="subtle" 
                  onClick={() => setSuggestion('Show me account overview')}
                  data-testid="suggestion-account-overview"
                >
                  Account Overview
                </Button>
                <Button 
                  size="xs" 
                  variant="subtle" 
                  onClick={() => setSuggestion('Take me to my savings account')}
                  data-testid="suggestion-savings-account"
                >
                  Savings Account Details
                </Button>
              </Group>
              
              <Button 
                type="submit" 
                disabled={!isConnected}
                size="sm"
                data-testid="navigation-assistant-submit"
              >
                Navigate
              </Button>
            </Stack>
          </form>
        </Card>
      )}
    </>
  );
};
