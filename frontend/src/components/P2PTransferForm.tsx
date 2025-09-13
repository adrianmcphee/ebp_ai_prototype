import React, { useState, useEffect, useCallback } from 'react';
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
  Badge,
  Loader,
  Center
} from '@mantine/core';
import { useLocation, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { apiService } from '../services/api';
import type { Account, Recipient } from '../types';

interface FormData {
  fromAccount: string;
  recipient: string;
  amount: number | string | '';
  memo: string;
  paymentMethod: string;
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
      alias: string;
    }; 
    source: string 
  };
  memo?: { value: string; source: string };
}

// Recipients are now fetched from API

export const P2PTransferForm: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [recipientsLoading, setRecipientsLoading] = useState(true);
  const [recipientsError, setRecipientsError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    fromAccount: '',
    recipient: '',
    amount: '',
    memo: '',
    paymentMethod: 'Zelle'
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [hasValidatedAfterLoad, setHasValidatedAfterLoad] = useState(false);

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

  // Fetch recipients on component mount
  useEffect(() => {
    const loadRecipients = async () => {
      try {
        setRecipientsLoading(true);
        setRecipientsError(null);
        const fetchedRecipients = await apiService.getRecipients();
        // For P2P transfers, we can use all recipients but prioritize those with aliases
        // Filter for domestic recipients (same country) for P2P context
        const p2pRecipients = fetchedRecipients.filter(r => 
          r.bank_country === 'US' && r.alias // P2P typically uses known contacts with aliases
        );
        setRecipients(p2pRecipients.length > 0 ? p2pRecipients : fetchedRecipients);
      } catch (error) {
        console.error('Failed to load recipients:', error);
        setRecipientsError('Failed to load recipients. Please refresh the page.');
        notifications.show({
          title: 'Error',
          message: 'Failed to load recipients. Please try again.',
          color: 'red',
        });
      } finally {
        setRecipientsLoading(false);
      }
    };

    loadRecipients();
  }, []);

  // Extract entities from navigation state
  useEffect(() => {
    const entities = (location.state as { entities?: EntityData })?.entities;
    if (!entities || recipients.length === 0) return;

    const updates: Partial<FormData> = {};

    // Pre-fill amount
    if (entities.amount?.value) {
      updates.amount = entities.amount.value;
    }

    // Pre-fill from account
    if (entities.from_account?.enriched_entity?.id) {
      updates.fromAccount = entities.from_account.enriched_entity.id;
    }

    // Pre-fill recipient
    if (entities.recipient?.enriched_entity) {
      const recipient = entities.recipient.enriched_entity;
      const matchedRecipient = recipients.find(r => 
        r.name === recipient.name || 
        (r.alias && recipient.alias && r.alias === recipient.alias)
      );
      if (matchedRecipient) {
        updates.recipient = matchedRecipient.id;
      }
    } else if (entities.recipient?.value) {
      // Try to match by name or alias
      const matchedRecipient = recipients.find(r => 
        r.name.toLowerCase().includes(entities.recipient!.value.toLowerCase()) ||
        (r.alias && r.alias.toLowerCase().includes(entities.recipient!.value.toLowerCase()))
      );
      if (matchedRecipient) {
        updates.recipient = matchedRecipient.id;
      }
    }

    // Pre-fill memo
    if (entities.memo?.value) {
      updates.memo = entities.memo.value;
    }

    setFormData(prev => ({ ...prev, ...updates }));
  }, [location.state, accounts, recipients]);

  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.fromAccount) {
      errors.fromAccount = 'Please select a source account';
    }
    if (!formData.recipient) {
      errors.recipient = 'Please select a recipient';
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      errors.amount = 'Please enter a valid amount';
    }

    // P2P transfer limits
    if (formData.amount && Number(formData.amount) > 1000) {
      errors.amount = 'P2P transfers are limited to $1,000 per transaction';
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
  }, [formData, accounts]);

  // Validate form after data loads to highlight required empty fields
  useEffect(() => {
    if (!accountsLoading && !recipientsLoading && !hasValidatedAfterLoad) {
      validateForm();
      setHasValidatedAfterLoad(true);
    }
  }, [accountsLoading, recipientsLoading, hasValidatedAfterLoad, validateForm]);

  const getFieldStyle = (fieldName: keyof FormData, isRequired: boolean) => ({
    borderColor: isRequired && formErrors[fieldName] ? '#fa5252' : undefined,
    borderWidth: isRequired && formErrors[fieldName] ? 2 : undefined
  });

  const formatAccountOption = (account: { name: string; balance: number }) => 
    `${account.name} - $${account.balance.toFixed(2)}`;

  const formatRecipientOption = (recipient: Recipient) => 
    `${recipient.name}${recipient.alias ? ` (${recipient.alias})` : ''} - ${recipient.bank_name}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const recipient = recipients.find(r => r.id === formData.recipient);
      
      console.log('Submitting P2P transfer:', formData);
      
      notifications.show({
        title: 'Payment Sent',
        message: `$${formData.amount} sent to ${recipient?.name} via ${formData.paymentMethod}`,
        color: 'green',
      });

      navigate('/banking/transfers');
    } catch {
      notifications.show({
        title: 'Payment Failed',
        message: 'There was an error sending your payment. Please try again.',
        color: 'red',
      });
    }
  };

  const isFormValid = formData.fromAccount && formData.recipient && 
                     formData.amount && Number(formData.amount) > 0 &&
                     Object.keys(formErrors).length === 0;

  const selectedRecipient = recipients.find(r => r.id === formData.recipient);

  // Show loading state while data is being fetched
  if (accountsLoading || recipientsLoading) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Center>
          <Stack align="center" gap="md">
            <Loader size="md" />
            <Text>Loading accounts and recipients...</Text>
          </Stack>
        </Center>
      </Card>
    );
  }

  // Show error state if data failed to load
  if (accountsError || recipientsError) {
    return (
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Alert color="red" title="Error Loading Data">
          <Text>
            {accountsError && `Accounts: ${accountsError}`}
            {accountsError && recipientsError && <br />}
            {recipientsError && `Recipients: ${recipientsError}`}
          </Text>
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
      <Group justify="apart" mb="md">
        <div>
          <Title order={2}>Send Money</Title>
          <Text size="sm" c="dimmed">
            Quick person-to-person payments
          </Text>
        </div>
        <Badge color="green" variant="light">Instant</Badge>
      </Group>

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {/* From Account */}
          <Select
            label="From Account"
            placeholder="Select source account"
            required
            value={formData.fromAccount}
            onChange={(value) => setFormData(prev => ({ ...prev, fromAccount: value || '' }))}
            data={accounts.map(acc => ({ value: acc.id, label: formatAccountOption(acc) }))}
            style={getFieldStyle('fromAccount', true)}
            error={formErrors.fromAccount}
            onBlur={validateForm}
          />

          {/* Recipient */}
          <Select
            label="Send To"
            placeholder="Select recipient"
            required
            value={formData.recipient}
            onChange={(value) => setFormData(prev => ({ ...prev, recipient: value || '' }))}
            data={recipients.map(rec => ({ 
              value: rec.id, 
              label: formatRecipientOption(rec) 
            }))}
            style={getFieldStyle('recipient', true)}
            error={formErrors.recipient}
            onBlur={validateForm}
            searchable
          />

          {/* Amount */}
          <NumberInput
            label="Amount"
            placeholder="0.00"
            required
            value={formData.amount}
            onChange={(value) => setFormData(prev => ({ ...prev, amount: value ?? '' }))}
            decimalScale={2}
            min={0.01}
            max={1000}
            leftSection="$"
            style={getFieldStyle('amount', true)}
            error={formErrors.amount}
            onBlur={validateForm}
          />

          {/* Payment Method */}
          <Select
            label="Payment Method"
            value={formData.paymentMethod}
            onChange={(value) => setFormData(prev => ({ ...prev, paymentMethod: value || 'Zelle' }))}
            data={[
              { value: 'Zelle', label: 'Zelle (Instant, free)' },
              { value: 'Internal P2P', label: 'Internal P2P (Instant, free)' }
            ]}
          />

          {/* Memo */}
          <TextInput
            label="What's this for?"
            placeholder="Optional note (e.g., dinner, rent, birthday gift)"
            value={formData.memo}
            onChange={(e) => setFormData(prev => ({ ...prev, memo: e.target.value }))}
          />

          {/* Preview */}
          {isFormValid && selectedRecipient && (
            <Alert color="green" title="Payment Preview">
              <Text size="sm">
                Send <strong>${formData.amount}</strong> to{' '}
                <strong>{selectedRecipient.name}</strong> via <strong>{formData.paymentMethod}</strong>
                <br />This payment will be delivered instantly
                {formData.memo && <><br />Note: {formData.memo}</>}
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
              color="green"
            >
              Send Money
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
};
