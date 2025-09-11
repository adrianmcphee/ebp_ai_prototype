import React, { useState, useEffect } from 'react';
import {
  Card,
  Title,
  Stack,
  Button,
  Select,
  NumberInput,
  TextInput,
  Text,
  Group,
  Alert,
  Loader,
  Center
} from '@mantine/core';
import { useLocation, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { apiService } from '../services/api';
import type { Account } from '../types';

interface FormData {
  fromAccount: string;
  toAccount: string;
  amount: number | string | '';
  memo: string;
}

interface EntityData {
  amount?: { value: number; raw: string; source: string };
  from_account?: { 
    value: string; 
    enriched_entity?: {
      id: string;
      name: string;
      type: string;
      balance: number;
    }; 
    source: string;
  };
  to_account?: { 
    value: string; 
    enriched_entity?: {
      id: string;
      name: string;
      type: string;
      balance: number;
    }; 
    source: string;
  };
  memo?: { value: string; source: string };
}

export const InternalTransferForm: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    fromAccount: '',
    toAccount: '',
    amount: '',
    memo: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch accounts on component mount
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setAccountsLoading(true);
        setAccountsError(null);
        const fetchedAccounts = await apiService.getAccounts();
        setAccounts(fetchedAccounts);
      } catch (error) {
        console.error('Failed to load accounts:', error);
        setAccountsError('Failed to load accounts. Please refresh the page.');
        notifications.show({
          title: 'Error',
          message: 'Failed to load your accounts. Please try again.',
          color: 'red',
        });
      } finally {
        setAccountsLoading(false);
      }
    };

    loadAccounts();
  }, []);

  // Extract entities from navigation state
  useEffect(() => {
    const entities = (location.state as { entities?: EntityData })?.entities;
    if (!entities) return;

    const updates: Partial<FormData> = {};

    // Pre-fill amount
    if (entities.amount?.value) {
      updates.amount = entities.amount.value;
    }

    // Pre-fill from account
    if (entities.from_account?.enriched_entity?.id) {
      updates.fromAccount = entities.from_account.enriched_entity.id;
    } else if (entities.from_account?.value) {
      // Try to match by account type or name
      const matchedAccount = accounts.find(acc => 
        acc.type.toLowerCase().includes(entities.from_account!.value.toLowerCase()) ||
        acc.name.toLowerCase().includes(entities.from_account!.value.toLowerCase())
      );
      if (matchedAccount) {
        updates.fromAccount = matchedAccount.id;
      }
    }

    // Pre-fill to account
    if (entities.to_account?.enriched_entity?.id) {
      updates.toAccount = entities.to_account.enriched_entity.id;
    } else if (entities.to_account?.value) {
      const matchedAccount = accounts.find(acc => 
        acc.type.toLowerCase().includes(entities.to_account!.value.toLowerCase()) ||
        acc.name.toLowerCase().includes(entities.to_account!.value.toLowerCase())
      );
      if (matchedAccount) {
        updates.toAccount = matchedAccount.id;
      }
    }

    // Pre-fill memo
    if (entities.memo?.value) {
      updates.memo = entities.memo.value;
    }

    setFormData(prev => ({ ...prev, ...updates }));
  }, [location.state, accounts]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.fromAccount) {
      errors.fromAccount = 'Please select a source account';
    }
    if (!formData.toAccount) {
      errors.toAccount = 'Please select a destination account';
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      errors.amount = 'Please enter a valid amount';
    }
    if (formData.fromAccount === formData.toAccount) {
      errors.toAccount = 'Destination account must be different from source account';
    }

    // Check sufficient balance
    if (formData.fromAccount && formData.amount) {
      const sourceAccount = accounts.find(acc => acc.id === formData.fromAccount);
      if (sourceAccount && sourceAccount.balance < Number(formData.amount)) {
        errors.amount = `Insufficient balance. Available: $${sourceAccount.balance.toFixed(2)}`;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getFieldStyle = (fieldName: keyof FormData, isRequired: boolean) => ({
    borderColor: isRequired && formErrors[fieldName] ? '#fa5252' : undefined,
    borderWidth: isRequired && formErrors[fieldName] ? 2 : undefined
  });

  const formatAccountOption = (account: { name: string; balance: number }) => 
    `${account.name} - $${account.balance.toFixed(2)}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      // Submit transfer
      console.log('Submitting internal transfer:', formData);
      
      notifications.show({
        title: 'Transfer Initiated',
        message: `$${formData.amount} will be transferred from ${accounts.find(a => a.id === formData.fromAccount)?.name} to ${accounts.find(a => a.id === formData.toAccount)?.name}`,
        color: 'green',
      });

      // Navigate back to transfers hub
      navigate('/banking/transfers');
    } catch {
      notifications.show({
        title: 'Transfer Failed',
        message: 'There was an error processing your transfer. Please try again.',
        color: 'red',
      });
    }
  };

  const isFormValid = formData.fromAccount && formData.toAccount && 
                     formData.amount && Number(formData.amount) > 0 &&
                     formData.fromAccount !== formData.toAccount &&
                     Object.keys(formErrors).length === 0;

  // Show loading state while accounts are being fetched
  if (accountsLoading) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Center>
          <Stack align="center" gap="md">
            <Loader size="md" />
            <Text>Loading accounts...</Text>
          </Stack>
        </Center>
      </Card>
    );
  }

  // Show error state if accounts failed to load
  if (accountsError) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Alert color="red" title="Error Loading Accounts">
          <Text>{accountsError}</Text>
          <Button 
            mt="md" 
            color="red" 
            variant="light"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </Button>
        </Alert>
      </Card>
    );
  }

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Title order={2} mb="md">Internal Transfer</Title>
      <Text size="sm" c="dimmed" mb="lg">
        Transfer money between your accounts instantly
      </Text>

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {/* From Account */}
          <Select
            label={
              <Group gap="xs">
                <Text>From Account</Text>
                <Text c="red">*</Text>
              </Group>
            }
            placeholder="Select source account"
            required
            value={formData.fromAccount}
            onChange={(value) => setFormData(prev => ({ ...prev, fromAccount: value || '' }))}
            data={accounts.map(acc => ({ value: acc.id, label: formatAccountOption(acc) }))}
            style={getFieldStyle('fromAccount', true)}
            error={formErrors.fromAccount}
            onBlur={validateForm}
          />

          {/* To Account */}
          <Select
            label={
              <Group gap="xs">
                <Text>To Account</Text>
                <Text c="red">*</Text>
              </Group>
            }
            placeholder="Select destination account"
            required
            value={formData.toAccount}
            onChange={(value) => setFormData(prev => ({ ...prev, toAccount: value || '' }))}
            data={accounts
              .filter(acc => acc.id !== formData.fromAccount)
              .map(acc => ({ value: acc.id, label: formatAccountOption(acc) }))
            }
            style={getFieldStyle('toAccount', true)}
            error={formErrors.toAccount}
            onBlur={validateForm}
          />

          {/* Amount */}
          <NumberInput
            label={
              <Group gap="xs">
                <Text>Amount</Text>
                <Text c="red">*</Text>
              </Group>
            }
            placeholder="0.00"
            required
            value={formData.amount}
            onChange={(value) => setFormData(prev => ({ ...prev, amount: value ?? '' }))}
            decimalScale={2}
            min={0.01}
            leftSection="$"
            style={getFieldStyle('amount', true)}
            error={formErrors.amount}
            onBlur={validateForm}
          />

          {/* Memo */}
          <TextInput
            label="Memo"
            placeholder="Optional note for this transfer"
            value={formData.memo}
            onChange={(e) => setFormData(prev => ({ ...prev, memo: e.target.value }))}
          />

          {/* Preview */}
          {isFormValid && (
            <Alert color="blue" title="Transfer Preview">
              <Text size="sm">
                Transfer <strong>${formData.amount}</strong> from{' '}
                <strong>{accounts.find(a => a.id === formData.fromAccount)?.name}</strong> to{' '}
                <strong>{accounts.find(a => a.id === formData.toAccount)?.name}</strong>
                {formData.memo && <><br />Memo: {formData.memo}</>}
              </Text>
            </Alert>
          )}

          {/* Actions */}
          <Group justify="apart" mt="xl">
            <Button variant="subtle" onClick={() => navigate('/banking/transfers')}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              size="lg"
              disabled={!isFormValid}
            >
              Transfer Money
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
};
