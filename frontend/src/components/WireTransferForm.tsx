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
  Center,
  Badge
} from '@mantine/core';
import { useLocation, useNavigate } from 'react-router-dom';
import { notifications } from '@mantine/notifications';
import { apiService } from '../services/api';
import type { Account, Recipient } from '../types';

interface FormData {
  fromAccount: string;
  recipientName: string;
  recipientBank: string;
  accountNumber: string;
  swiftCode: string;
  bankAddress: string;
  recipientCountry: string;
  correspondentBank: string;
  amount: number | string | '';
  currency: string;
  purpose: string;
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
  recipient?: { 
    value: string; 
    enriched_entity?: {
      name: string;
      account_number: string;
      bank_name: string;
      swift_code?: string;
      bank_address?: string;
      bank_country: string;
    }; 
    source: string 
  };
  currency?: { value: string; source: string };
  purpose?: { value: string; source: string };
  memo?: { value: string; source: string };
}

// 20 most popular currencies for international transfers
const POPULAR_CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'SEK', label: 'SEK - Swedish Krona' },
  { value: 'NOK', label: 'NOK - Norwegian Krone' },
  { value: 'MXN', label: 'MXN - Mexican Peso' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'HKD', label: 'HKD - Hong Kong Dollar' },
  { value: 'NZD', label: 'NZD - New Zealand Dollar' },
  { value: 'KRW', label: 'KRW - South Korean Won' },
  { value: 'THB', label: 'THB - Thai Baht' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'BRL', label: 'BRL - Brazilian Real' },
  { value: 'ZAR', label: 'ZAR - South African Rand' },
  { value: 'DKK', label: 'DKK - Danish Krone' }
];

// Purpose codes from backend UI catalog
const PURPOSE_CODES = [
  { value: 'Family Support', label: 'Family Support' },
  { value: 'Education', label: 'Education' },
  { value: 'Business', label: 'Business' },
  { value: 'Personal', label: 'Personal' }
];

// Countries that might require correspondent banks
const COUNTRIES_REQUIRING_CORRESPONDENT = ['Other', 'Some African Countries', 'Some Asian Countries'];

export const WireTransferForm: React.FC = () => {
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
    recipientName: '',
    recipientBank: '',
    accountNumber: '',
    swiftCode: '',
    bankAddress: '',
    recipientCountry: '',
    correspondentBank: '',
    amount: '',
    currency: 'USD', // Default to USD
    purpose: '',
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

  // Fetch international recipients on component mount
  useEffect(() => {
    const loadRecipients = async () => {
      try {
        setRecipientsLoading(true);
        setRecipientsError(null);
        const fetchedRecipients = await apiService.getRecipients();
        // Filter for international recipients only (bank_country !== 'US')
        const internationalRecipients = fetchedRecipients.filter(r => 
          r.bank_country !== 'US'
        );
        setRecipients(internationalRecipients);
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

    // Pre-fill currency
    if (entities.currency?.value) {
      updates.currency = entities.currency.value;
    }

    // Pre-fill purpose
    if (entities.purpose?.value) {
      updates.purpose = entities.purpose.value;
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
      updates.swiftCode = recipient.swift_code || '';
      updates.bankAddress = recipient.bank_address || '';
      updates.recipientCountry = recipient.bank_country;
    } else if (entities.recipient?.value) {
      updates.recipientName = entities.recipient.value;
    }

    // Pre-fill memo
    if (entities.memo?.value) {
      updates.memo = entities.memo.value;
    }

    setFormData(prev => ({ ...prev, ...updates }));
  }, [location.state, accounts, recipients]);

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
      errors.accountNumber = 'Please enter account number or IBAN';
    } else {
      // IBAN validation (basic check for IBAN format)
      const accountNumber = formData.accountNumber.trim().replace(/\s/g, '');
      if (accountNumber.length > 15 && /^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(accountNumber)) {
        // Looks like IBAN format - basic validation
        if (accountNumber.length < 15 || accountNumber.length > 34) {
          errors.accountNumber = 'IBAN must be between 15-34 characters';
        }
      } else if (accountNumber.length < 8) {
        errors.accountNumber = 'Account number must be at least 8 characters';
      }
    }
    if (!formData.swiftCode.trim()) {
      errors.swiftCode = 'Please enter SWIFT/BIC code';
    } else if (!/^[A-Z0-9]{8,11}$/.test(formData.swiftCode.replace(/\s/g, ''))) {
      errors.swiftCode = 'SWIFT code must be 8-11 alphanumeric characters';
    }
    if (!formData.bankAddress.trim()) {
      errors.bankAddress = 'Please enter bank address';
    }
    if (!formData.recipientCountry.trim()) {
      errors.recipientCountry = 'Please enter recipient country';
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      errors.amount = 'Please enter a valid amount';
    }
    if (!formData.currency) {
      errors.currency = 'Please select currency';
    }

    // Check transfer limits (international wire: $100,000)
    if (formData.amount && Number(formData.amount) > 100000) {
      errors.amount = 'International wire transfers are limited to $100,000 per transaction';
    }

    // Check sufficient balance
    if (formData.fromAccount && formData.amount) {
      const sourceAccount = accounts.find(acc => acc.id === formData.fromAccount);
      if (sourceAccount && sourceAccount.balance < Number(formData.amount)) {
        errors.amount = `Insufficient balance. Available: $${sourceAccount.balance.toFixed(2)}`;
      }
    }

    // Conditional validation for correspondent bank
    if (COUNTRIES_REQUIRING_CORRESPONDENT.includes(formData.recipientCountry) && !formData.correspondentBank.trim()) {
      errors.correspondentBank = 'Correspondent bank is required for this destination';
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

  const formatRecipientOption = (recipient: Recipient) => 
    `${recipient.name}${recipient.alias ? ` (${recipient.alias})` : ''} - ${recipient.bank_name}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      console.log('Submitting international wire transfer:', formData);
      
      notifications.show({
        title: 'Wire Transfer Initiated',
        message: `$${formData.amount} ${formData.currency} will be sent to ${formData.recipientName} at ${formData.recipientBank}`,
        color: 'green',
      });

      navigate('/banking/transfers');
    } catch {
      notifications.show({
        title: 'Wire Transfer Failed',
        message: 'There was an error processing your wire transfer. Please try again.',
        color: 'red',
      });
    }
  };

  const isFormValid = formData.fromAccount && formData.recipientName && 
                     formData.recipientBank && formData.accountNumber &&
                     formData.swiftCode && formData.bankAddress &&
                     formData.recipientCountry && formData.amount && 
                     formData.currency &&
                     Number(formData.amount) > 0 && Object.keys(formErrors).length === 0;

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
          <Title order={2}>International Wire Transfer</Title>
          <Text size="sm" c="dimmed">
            Send money internationally (3-5 business days)
          </Text>
        </div>
        <Badge color="orange" variant="light">High Security</Badge>
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

          <Divider label="Recipient Information" labelPosition="center" />

          {/* Known Recipients Dropdown */}
          {recipients.length > 0 && (
            <Select
              label="Select Known Recipient (Optional)"
              placeholder="Choose from your saved recipients"
              value={recipients.find(r => r.name === formData.recipientName)?.id || ''}
              onChange={(value) => {
                const selectedRecipient = recipients.find(r => r.id === value);
                if (selectedRecipient) {
                  setFormData(prev => ({
                    ...prev,
                    recipientName: selectedRecipient.name,
                    recipientBank: selectedRecipient.bank_name,
                    accountNumber: selectedRecipient.account_number,
                    swiftCode: selectedRecipient.swift_code || '',
                    bankAddress: selectedRecipient.bank_address || '',
                    recipientCountry: selectedRecipient.bank_country
                  }));
                }
              }}
              data={recipients.map(rec => ({ 
                value: rec.id, 
                label: formatRecipientOption(rec) 
              }))}
              searchable
              clearable
            />
          )}

          {/* Recipient Name */}
          <TextInput
            label="Recipient Name"
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
            label="Recipient Bank"
            placeholder="Name of the recipient's bank"
            required
            value={formData.recipientBank}
            onChange={(e) => setFormData(prev => ({ ...prev, recipientBank: e.target.value }))}
            style={getFieldStyle('recipientBank', true)}
            error={formErrors.recipientBank}
            onBlur={validateForm}
          />

          {/* Account Number / IBAN */}
          <TextInput
            label="Account Number / IBAN"
            placeholder="Account number or IBAN (e.g., DE89370400440532013000)"
            required
            value={formData.accountNumber}
            onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
            style={getFieldStyle('accountNumber', true)}
            error={formErrors.accountNumber}
            description="Enter the recipient's account number or IBAN"
            onBlur={validateForm}
          />

          {/* SWIFT Code */}
          <TextInput
            label="SWIFT/BIC Code"
            placeholder="00000000 (e.g., DEUTDEFF)"
            required
            value={formData.swiftCode}
            onChange={(e) => setFormData(prev => ({ ...prev, swiftCode: e.target.value.toUpperCase() }))}
            style={getFieldStyle('swiftCode', true)}
            error={formErrors.swiftCode}
            description="8-11 character bank identifier code"
            onBlur={validateForm}
          />

          {/* Bank Address */}
          <TextInput
            label="Bank Address"
            placeholder="Full address of the recipient's bank"
            required
            value={formData.bankAddress}
            onChange={(e) => setFormData(prev => ({ ...prev, bankAddress: e.target.value }))}
            style={getFieldStyle('bankAddress', true)}
            error={formErrors.bankAddress}
            onBlur={validateForm}
          />

          {/* Recipient Country */}
          <TextInput
            label="Recipient Country"
            placeholder="Country where the recipient bank is located"
            required
            value={formData.recipientCountry}
            onChange={(e) => setFormData(prev => ({ ...prev, recipientCountry: e.target.value }))}
            style={getFieldStyle('recipientCountry', true)}
            error={formErrors.recipientCountry}
            onBlur={validateForm}
          />

          {/* Correspondent Bank - Conditional */}
          {COUNTRIES_REQUIRING_CORRESPONDENT.includes(formData.recipientCountry) && (
            <TextInput
              label="Correspondent Bank"
              placeholder="Intermediary bank (if required)"
              required
              value={formData.correspondentBank}
              onChange={(e) => setFormData(prev => ({ ...prev, correspondentBank: e.target.value }))}
              style={getFieldStyle('correspondentBank', true)}
              error={formErrors.correspondentBank}
              description="Required for this destination country"
              onBlur={validateForm}
            />
          )}

          <Divider label="Transfer Details" labelPosition="center" />

          {/* Amount */}
          <NumberInput
            label="Amount"
            placeholder="0.00"
            required
            value={formData.amount}
            onChange={(value) => setFormData(prev => ({ ...prev, amount: value ?? '' }))}
            decimalScale={2}
            min={0.01}
            max={100000}
            leftSection="$"
            style={getFieldStyle('amount', true)}
            error={formErrors.amount}
            description="Maximum: $100,000 per transaction"
            onBlur={validateForm}
          />

          {/* Currency */}
          <Select
            label="Currency"
            placeholder="Select destination currency"
            required
            value={formData.currency}
            onChange={(value) => setFormData(prev => ({ ...prev, currency: value || 'USD' }))}
            data={POPULAR_CURRENCIES}
            style={getFieldStyle('currency', true)}
            error={formErrors.currency}
            searchable
            onBlur={validateForm}
          />

          {/* Purpose */}
          <Select
            label="Purpose of Transfer"
            placeholder="Select transfer purpose (optional)"
            value={formData.purpose}
            onChange={(value) => setFormData(prev => ({ ...prev, purpose: value || '' }))}
            data={PURPOSE_CODES}
            style={getFieldStyle('purpose', false)}
            error={formErrors.purpose}
            description="Optional - for compliance and regulatory purposes"
            onBlur={validateForm}
          />

          {/* Memo */}
          <TextInput
            label="Memo"
            placeholder="Optional note for this transfer"
            value={formData.memo}
            onChange={(e) => setFormData(prev => ({ ...prev, memo: e.target.value }))}
            description="Additional information for the recipient"
          />

          {/* Preview */}
          {isFormValid && (
            <Alert color="orange" title="Wire Transfer Preview">
              <Text size="sm">
                Send <strong>${formData.amount} {formData.currency}</strong> to{' '}
                <strong>{formData.recipientName}</strong> at <strong>{formData.recipientBank}</strong>
                <br />Country: <strong>{formData.recipientCountry}</strong>
                {formData.purpose && <><br />Purpose: <strong>{formData.purpose}</strong></>}
                <br />Processing time: <strong>3-5 business days</strong>
                <br />Fee: <strong>$45 (international wire fee)</strong>
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
              color="orange"
            >
              Send Wire Transfer
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
};
