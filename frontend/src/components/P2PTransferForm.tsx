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
  Badge
} from '@mantine/core';
import { useLocation, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';

interface P2PTransferFormProps {
  accounts?: Array<{
    id: string;
    name: string;
    type: string;
    balance: number;
  }>;
}

interface FormData {
  fromAccount: string;
  recipient: string;
  amount: number | string | '';
  memo: string;
  paymentMethod: string;
}

interface EntityData {
  amount?: { value: number; raw: string; source: string };
  from_account?: { value: string; enriched_entity?: any; source: string };
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

const P2P_RECIPIENTS = [
  { id: 'RCP004', name: 'Sarah Johnson', alias: 'Sarah', phone: '555-0123' },
  { id: 'RCP005', name: 'Michael Davis', alias: 'Mike', phone: '555-0124' },
  { id: 'RCP006', name: 'Jennifer Wilson', alias: 'Jen', phone: '555-0125' }
];

export const P2PTransferForm: React.FC<P2PTransferFormProps> = ({ 
  accounts = [
    { id: 'CHK001', name: 'Primary Checking', type: 'checking', balance: 5000.00 },
    { id: 'SAV001', name: 'Savings Account', type: 'savings', balance: 15000.00 },
    { id: 'CHK002', name: 'Business Checking', type: 'checking', balance: 25000.00 }
  ]
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    fromAccount: '',
    recipient: '',
    amount: '',
    memo: '',
    paymentMethod: 'Zelle'
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Extract entities from navigation state
  useEffect(() => {
    const entities = (location.state as any)?.entities as EntityData;
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

    // Pre-fill recipient
    if (entities.recipient?.enriched_entity) {
      const recipient = entities.recipient.enriched_entity;
      const matchedRecipient = P2P_RECIPIENTS.find(r => 
        r.name === recipient.name || r.alias === recipient.alias
      );
      if (matchedRecipient) {
        updates.recipient = matchedRecipient.id;
      }
    } else if (entities.recipient?.value) {
      // Try to match by name or alias
      const matchedRecipient = P2P_RECIPIENTS.find(r => 
        r.name.toLowerCase().includes(entities.recipient!.value.toLowerCase()) ||
        r.alias.toLowerCase().includes(entities.recipient!.value.toLowerCase())
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
  }, [location.state, accounts]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.fromAccount) {
      errors.fromAccount = 'Please select a source account';
    }
    if (!formData.recipient) {
      errors.recipient = 'Please select a recipient';
    }
    if (!formData.amount || formData.amount <= 0) {
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
  };

  const getFieldStyle = (fieldName: keyof FormData, isRequired: boolean) => ({
    borderColor: isRequired && formErrors[fieldName] ? '#fa5252' : undefined,
    borderWidth: isRequired && formErrors[fieldName] ? 2 : undefined
  });

  const formatAccountOption = (account: any) => 
    `${account.name} - $${account.balance.toFixed(2)}`;

  const formatRecipientOption = (recipient: any) => 
    `${recipient.name} (${recipient.alias}) - ${recipient.phone}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      const recipient = P2P_RECIPIENTS.find(r => r.id === formData.recipient);
      
      console.log('Submitting P2P transfer:', formData);
      
      notifications.show({
        title: 'Payment Sent',
        message: `$${formData.amount} sent to ${recipient?.name} via ${formData.paymentMethod}`,
        color: 'green',
      });

      navigate('/banking/transfers');
    } catch (error) {
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

  const selectedRecipient = P2P_RECIPIENTS.find(r => r.id === formData.recipient);

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

          {/* Recipient */}
          <Select
            label={
              <Group gap="xs">
                <Text>Send To</Text>
                <Text c="red">*</Text>
              </Group>
            }
            placeholder="Select recipient"
            required
            value={formData.recipient}
            onChange={(value) => setFormData(prev => ({ ...prev, recipient: value || '' }))}
            data={P2P_RECIPIENTS.map(rec => ({ 
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
