import {
  Card,
  Title,
  SimpleGrid,
  Paper,
  Text,
  Button
} from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import type { Account } from '../types';
import { AccountDetails } from './AccountDetails';
import { InternalTransferForm } from './InternalTransferForm';
import { ExternalTransferForm } from './ExternalTransferForm';
import { P2PTransferForm } from './P2PTransferForm';
import { WireTransferForm } from './WireTransferForm';

// Pre-built Banking Screens
export const BankingScreens = {
  AccountsOverview: ({ accounts }: { accounts: Account[] }) => {
    const navigate = useNavigate();

    const handleAccountClick = (accountId: string) => {
      navigate(`/banking/accounts/${accountId}`);
    };

    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={2} mb="md">Your Accounts</Title>
        <SimpleGrid cols={2} data-testid="accounts-grid">
          {accounts.map(account => (
            <Paper 
              key={account.id} 
              p="md" 
              withBorder
              style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
              onClick={() => handleAccountClick(account.id)}
              data-testid={`account-${account.id}`}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--mantine-color-gray-0)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '';
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = '';
              }}
            >
              <Text size="sm" color="dimmed">{account.type}</Text>
              <Text fw={500}>{account.name}</Text>
              <Text size="xl" fw={700} c="blue">
                ${account.balance.toFixed(2)}
              </Text>
              <Text size="xs" color="dimmed" mt="xs">
                Click to view details
              </Text>
            </Paper>
          ))}
        </SimpleGrid>
      </Card>
    );
  },

  TransfersHub: () => {
    const navigate = useNavigate();

    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Title order={2} mb="md">Money Transfers</Title>
        <Text size="sm" c="dimmed" mb="lg">
          Choose the type of transfer you'd like to make
        </Text>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
          <Paper p="md" withBorder style={{ textAlign: 'center' }}>
            <Text fw={500} mb="xs">Internal Transfer</Text>
            <Text size="sm" c="dimmed" mb="md">Between your accounts</Text>
            <Button 
              variant="light" 
              fullWidth
              onClick={() => navigate('/banking/transfers/internal')}
            >
              Start Transfer
            </Button>
          </Paper>
          <Paper p="md" withBorder style={{ textAlign: 'center' }}>
            <Text fw={500} mb="xs">External Transfer</Text>
            <Text size="sm" c="dimmed" mb="md">To other banks</Text>
            <Button 
              variant="light" 
              fullWidth
              onClick={() => navigate('/banking/transfers/external')}
            >
              Send Money
            </Button>
          </Paper>
          <Paper p="md" withBorder style={{ textAlign: 'center' }}>
            <Text fw={500} mb="xs">P2P Payment</Text>
            <Text size="sm" c="dimmed" mb="md">Quick payments to friends</Text>
            <Button 
              variant="light" 
              fullWidth
              color="green"
              onClick={() => navigate('/banking/transfers/p2p')}
            >
              Send Money
            </Button>
          </Paper>
          <Paper p="md" withBorder style={{ textAlign: 'center' }}>
            <Text fw={500} mb="xs">International Wire</Text>
            <Text size="sm" c="dimmed" mb="md">Global transfers</Text>
            <Button 
              variant="light" 
              fullWidth
              onClick={() => navigate('/banking/transfers/wire')}
            >
              Wire Money
            </Button>
          </Paper>
        </SimpleGrid>
      </Card>
    );
  },

  WireTransferForm,

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
  ),

  InternalTransferForm,
  ExternalTransferForm,
  P2PTransferForm,
  AccountDetails
};
