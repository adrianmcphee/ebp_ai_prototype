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
  Divider,
  Loader,
  Center
} from '@mantine/core';
import { useLocation, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { apiService } from '../services/api';
import type { Account } from '../types';

interface FormData {
  fromAccount: string;
  recipientName: string;
  recipientBank: string;
  accountNumber: string;
  routingNumber: string;
  amount: number | string | '';
  memo: string;
  wireType: string;
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
  recipient?: { 
    value: string; 
    enriched_entity?: {
      name: string;
      account_number: string;
      bank_name: string;
      routing_number: string;
    }; 
    source: string 
  };
  memo?: { value: string; source: string };
}

export const ExternalTransferForm: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    fromAccount: '',
    recipientName: '',
    recipientBank: '',
    accountNumber: '',
    routingNumber: '',
    amount: '',
    memo: '',
    wireType: 'ACH'
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
    }

    // Pre-fill recipient information
    if (entities.recipient?.enriched_entity) {
      const recipient = entities.recipient.enriched_entity;
      updates.recipientName = recipient.name;
      updates.recipientBank = recipient.bank_name;
      updates.accountNumber = recipient.account_number;
      updates.routingNumber = recipient.routing_number;
    } else if (entities.recipient?.value) {
      updates.recipientName = entities.recipient.value;
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
    if (!formData.recipientName.trim()) {
      errors.recipientName = 'Please enter recipient name';
    }
    if (!formData.recipientBank.trim()) {
      errors.recipientBank = 'Please enter recipient bank';
    }
    if (!formData.accountNumber.trim()) {
      errors.accountNumber = 'Please enter account number';
    }
    if (!formData.routingNumber.trim()) {
      errors.routingNumber = 'Please enter routing number';
    } else if (!/^\d{9}$/.test(formData.routingNumber.replace(/\D/g, ''))) {
      errors.routingNumber = 'Routing number must be 9 digits';
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      errors.amount = 'Please enter a valid amount';
    }

    // Check transfer limits
    if (formData.amount && Number(formData.amount) > 10000) {
      errors.amount = 'External transfers are limited to $10,000 per transaction';
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
      console.log('Submitting external transfer:', formData);
      
      notifications.show({
        title: 'Transfer Initiated',
        message: `$${formData.amount} will be sent to ${formData.recipientName} at ${formData.recipientBank}`,
        color: 'green',
      });

      navigate('/banking/transfers');
    } catch {
      notifications.show({
        title: 'Transfer Failed',
        message: 'There was an error processing your transfer. Please try again.',
        color: 'red',
      });
    }
  };

  const isFormValid = formData.fromAccount && formData.recipientName && 
                     formData.recipientBank && formData.accountNumber &&
                     formData.routingNumber && formData.amount && 
                     Number(formData.amount) > 0 && Object.keys(formErrors).length === 0;

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
      <Title order={2} mb="md">External Transfer</Title>
      <Text size="sm" c="dimmed" mb="lg">
        Send money to an account at another bank (1-3 business days)
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

          <Divider label="Recipient Information" labelPosition="center" />

          {/* Recipient Name */}
          <TextInput
            label={
              <Group gap="xs">
                <Text>Recipient Name</Text>
                <Text c="red">*</Text>
              </Group>
            }
            placeholder="Full name as it appears on their account"
            required
            value={formData.recipientName}
            onChange={(e) => setFormData(prev => ({ ...prev, recipientName: e.target.value }))}
            style={getFieldStyle('recipientName', true)}
            error={formErrors.recipientName}
            onBlur={validateForm}
          />

          {/* Recipient Bank */}
          <TextInput
            label={
              <Group gap="xs">
                <Text>Recipient Bank</Text>
                <Text c="red">*</Text>
              </Group>
            }
            placeholder="Bank name (e.g., Wells Fargo, Chase)"
            required
            value={formData.recipientBank}
            onChange={(e) => setFormData(prev => ({ ...prev, recipientBank: e.target.value }))}
            style={getFieldStyle('recipientBank', true)}
            error={formErrors.recipientBank}
            onBlur={validateForm}
          />

          {/* Account Number */}
          <TextInput
            label={
              <Group gap="xs">
                <Text>Account Number</Text>
                <Text c="red">*</Text>
              </Group>
            }
            placeholder="Recipient's account number"
            required
            value={formData.accountNumber}
            onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
            style={getFieldStyle('accountNumber', true)}
            error={formErrors.accountNumber}
            onBlur={validateForm}
          />

          {/* Routing Number */}
          <TextInput
            label={
              <Group gap="xs">
                <Text>Routing Number</Text>
                <Text c="red">*</Text>
              </Group>
            }
            placeholder="9-digit routing number"
            required
            value={formData.routingNumber}
            onChange={(e) => setFormData(prev => ({ ...prev, routingNumber: e.target.value }))}
            style={getFieldStyle('routingNumber', true)}
            error={formErrors.routingNumber}
            onBlur={validateForm}
          />

          <Divider label="Transfer Details" labelPosition="center" />

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
            max={10000}
            leftSection="$"
            style={getFieldStyle('amount', true)}
            error={formErrors.amount}
            onBlur={validateForm}
          />

          {/* Wire Type */}
          <Select
            label="Transfer Type"
            value={formData.wireType}
            onChange={(value) => setFormData(prev => ({ ...prev, wireType: value || 'ACH' }))}
            data={[
              { value: 'ACH', label: 'ACH Transfer (1-3 days, free)' },
              { value: 'Wire', label: 'Wire Transfer (same day, $25 fee)' }
            ]}
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
                Send <strong>${formData.amount}</strong> to{' '}
                <strong>{formData.recipientName}</strong> at <strong>{formData.recipientBank}</strong>
                <br />Processing time: {formData.wireType === 'Wire' ? 'Same day' : '1-3 business days'}
                {formData.wireType === 'Wire' && <><br />Fee: $25</>}
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
              Send Money
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
};
