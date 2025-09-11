import React, { useEffect, useRef } from 'react';
import {
  Card,
  Stack,
  Paper,
  Text,
  Badge,
  Group,
  TextInput,
  Button
} from '@mantine/core';
import { useForm } from '@mantine/form';
import type { Message } from '../types';

interface ChatPanelProps {
  messages: Message[];
  isConnected: boolean;
  onSubmit: (values: { message: string }) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isConnected,
  onSubmit
}) => {
  // Manage form internally to prevent parent re-renders from affecting input
  const form = useForm({
    initialValues: {
      message: ''
    }
  });

  // Ref for the scrollable messages container
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleFormSubmit = (values: { message: string }) => {
    onSubmit(values);
    form.reset();
  };
  
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'green';
    if (confidence >= 0.6) return 'yellow';
    return 'red';
  };

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Stack data-testid="messages" gap="xs" style={{ height: '400px', overflowY: 'auto' }} mb="md">
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
                data-testid="confidence"
                size="xs" 
                color={getConfidenceColor(message.confidence)}
                mt="xs"
              >
                {Math.round(message.confidence * 100)}% confident
              </Badge>
            )}
          </Paper>
        ))}
        {/* Invisible element to scroll to */}
        <div ref={messagesEndRef} />
      </Stack>

      <form onSubmit={form.onSubmit(handleFormSubmit)}>
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

      <Group data-testid="quick-actions" mt="md" gap="xs">
        <Text size="xs" c="dimmed">Quick examples:</Text>
        <Button 
          data-testid="quick-transfer"
          size="xs" 
          variant="subtle" 
          onClick={() => form.setFieldValue('message', 'Transfer $100 from my checking account to my savings account')}
        >
          $100 to saving
        </Button>
        <Button 
          data-testid="quick-transaction"
          size="xs" 
          variant="subtle" 
          onClick={() => form.setFieldValue('message', 'Send $500 to my friend in Canada')}
        >
          Transaction
        </Button>
        <Button 
          data-testid="quick-balance"
          size="xs" 
          variant="subtle" 
          onClick={() => form.setFieldValue('message', 'What\'s my balance?')}
        >
          Balance
        </Button>
      </Group>
    </Card>
  );
};
