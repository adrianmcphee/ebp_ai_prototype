import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Title, 
  Text, 
  Stack, 
  Group, 
  SimpleGrid,
  Badge,
  Button,
  LoadingOverlay,
  Alert,
  Table
} from '@mantine/core';
import { useParams, useNavigate } from 'react-router-dom';
import type { Account, AccountBalance, Transaction } from '../types';
import { apiService } from '../services/api';

interface AccountDetailsProps {
  accounts: Account[];
}

export const AccountDetails: React.FC<AccountDetailsProps> = ({ accounts }) => {
  const { accountId } = useParams<{ accountId: string }>();
  const navigate = useNavigate();
  const [accountBalance, setAccountBalance] = useState<AccountBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get account info from accounts array
  const account = accounts.find(acc => acc.id === accountId);

  useEffect(() => {
    const loadAccountDetails = async () => {
      if (!accountId) {
        setError('Account ID is required');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Check if account exists in local accounts array
        if (!account) {
          setError('Account not found');
          setLoading(false);
          return;
        }

        // Load account balance and transactions from API
        const [balanceResponse, transactionsResponse] = await Promise.all([
          apiService.getAccountBalance(accountId),
          apiService.getAccountTransactions(accountId, 10) // Get last 10 transactions
        ]);
        
        setAccountBalance(balanceResponse);
        setTransactions(transactionsResponse.transactions);
      } catch (err) {
        console.error('Failed to load account details:', err);
        setError('Failed to load account details. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadAccountDetails();
  }, [accountId, account]);

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount: number, currency: string): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  if (loading) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <LoadingOverlay visible={true} data-testid="loading-overlay" />
        <div style={{ height: '300px' }} />
      </Card>
    );
  }

  if (error || !accountBalance || !account) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Alert variant="light" color="red" title="Error">
          {error}
        </Alert>
        <Group justify="center" mt="md">
          <Button variant="light" onClick={() => navigate('/banking/accounts')}>
            Back to Accounts
          </Button>
        </Group>
      </Card>
    );
  }

  return (
    <Stack gap="md">
              {/* Account Header */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" align="flex-start" mb="md">
            <div>
              <Title order={2} data-testid="account-details-title">
                {account.name}
              </Title>
              <Group gap="xs" mt="xs">
                <Badge color="blue" variant="light" data-testid="account-type">
                  {account.type}
                </Badge>
              </Group>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Text size="sm" color="dimmed">Current Balance</Text>
              <Text size="xl" fw={700} c="blue" data-testid="account-balance">
                {formatCurrency(accountBalance.balance, account.currency)}
              </Text>
            </div>
          </Group>
        </Card>

            {/* Account Details */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md" data-testid="account-details-grid">
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={3} size="h4" mb="md">Account Information</Title>
          <Stack gap="sm">
            <Group justify="space-between">
              <Text color="dimmed">Account ID</Text>
              <Text fw={500} data-testid="account-number">
                {accountBalance.account_id}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text color="dimmed">Account Type</Text>
              <Text fw={500} data-testid="account-type-detail">
                {account.type}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text color="dimmed">Current Balance</Text>
              <Text fw={500} data-testid="balance-detail">
                {formatCurrency(accountBalance.balance, account.currency)}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text color="dimmed">Currency</Text>
              <Text fw={500} data-testid="account-currency">
                {account.currency}
              </Text>
            </Group>
          </Stack>
        </Card>

        {/* Quick Actions */}
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={3} size="h4" mb="md">Quick Actions</Title>
          <Stack gap="sm">
            <Button 
              variant="light" 
              fullWidth
              onClick={() => navigate('/banking/transfers')}
              data-testid="transfer-button"
            >
              Transfer Money
            </Button>
            <Button 
              variant="light" 
              fullWidth
              onClick={() => navigate('/banking/payments/bills')}
              data-testid="pay-bills-button"
            >
              Pay Bills
            </Button>
            <Button 
              variant="outline" 
              fullWidth
              disabled
              data-testid="statement-button"
            >
              View Statements (Coming Soon)
            </Button>
          </Stack>
        </Card>
      </SimpleGrid>

      {/* Recent Transactions */}
      {transactions.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Title order={3} size="h4" mb="md">Recent Transactions</Title>
                              <Table striped highlightOnHover>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Date</Table.Th>
                          <Table.Th>Amount</Table.Th>
                          <Table.Th>Description</Table.Th>
                          <Table.Th>Balance After</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {transactions.map((transaction) => (
                          <Table.Tr key={transaction.id}>
                            <Table.Td>{formatDate(transaction.date)}</Table.Td>
                            <Table.Td>
                              <Text
                                c={transaction.type === 'credit' ? 'green' : 'red'}
                                fw={500}
                              >
                                {transaction.type === 'credit' ? '+' : ''}
                                {formatCurrency(Math.abs(transaction.amount), account.currency)}
                              </Text>
                            </Table.Td>
                            <Table.Td>
                              <div>
                                <Text size="sm" fw={500}>{transaction.description}</Text>
                                {transaction.merchant && (
                                  <Text size="xs" color="dimmed">{transaction.merchant}</Text>
                                )}
                              </div>
                            </Table.Td>
                            <Table.Td>
                              <Text fw={500}>
                                {formatCurrency(transaction.balance_after, account.currency)}
                              </Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
          </Card>
      )}
    </Stack>
  );
};

