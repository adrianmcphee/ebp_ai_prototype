import React from 'react';
import {
  AppShell,
  Container,
  Group,
  Title,
  Badge
} from '@mantine/core';

interface HeaderProps {
  isConnected: boolean;
}

export const Header: React.FC<HeaderProps> = ({ isConnected }) => {
  return (
    <AppShell.Header data-testid="header">
      <Container size="xl" h="100%">
        <Group h="100%" px="md" justify="apart">
          <Title order={3}>EBP Banking AI Prototype</Title>
          <Group>
            <Badge 
              data-testid="connection-status"
              color={isConnected ? 'green' : 'red'} 
              variant="light"
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </Group>
        </Group>
      </Container>
    </AppShell.Header>
  );
};