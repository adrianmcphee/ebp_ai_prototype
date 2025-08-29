import React from 'react';
import {
  Card,
  Title,
  SimpleGrid,
  Paper,
  Text,
  Button,
  Stack,
  TextInput,
  Select,
  NumberInput
} from '@mantine/core';
import type { Account } from '../types';

// Pre-built Banking Screens
export const BankingScreens = {
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
