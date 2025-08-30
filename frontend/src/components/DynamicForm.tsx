import React, { useState, useEffect } from 'react';
import {
  Card,
  Group,
  Title,
  Text,
  Badge,
  Stack,
  Button,
  TextInput,
  NumberInput,
  Select,
  Checkbox,
  Textarea
} from '@mantine/core';
import type { DynamicFormConfig, FormField } from '../types';

interface DynamicFormProps {
  config: DynamicFormConfig;
  onSubmit: (data: Record<string, unknown>) => void;
  onCancel: () => void;
}

export const DynamicForm: React.FC<DynamicFormProps> = ({ config, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Initialize form with pre-filled values
  useEffect(() => {
    const initialData: Record<string, unknown> = {};
    config.fields.forEach(field => {
      if (field.value !== undefined) {
        initialData[field.id] = field.value;
      }
    });
    setFormData(initialData);
  }, [config]);

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const renderField = (field: FormField) => {
    if (field.hidden) return null;

    const commonProps = {
      key: field.id,
      label: field.label,
      placeholder: field.placeholder,
      required: field.required,
      value: (formData[field.id] as string) || '',
      onChange: (value: unknown) => handleFieldChange(field.id, value),
      description: field.help_text
    };

    switch (field.type) {
      case 'amount':
        return (
          <NumberInput
            {...commonProps}
            decimalScale={2}
            min={0}
            leftSection="$"
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        );

      case 'dropdown':
        return (
          <Select
            {...commonProps}
            data={field.options || []}
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        );

      case 'account_select':
        return (
          <Select
            {...commonProps}
            data={['Checking Account - $2,150.00', 'Savings Account - $15,432.18']}
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        );

      case 'recipient_select':
        return (
          <Select
            {...commonProps}
            data={['John Smith', 'Sarah Johnson', 'Mike Chen', 'Add New Recipient']}
            searchable
            onChange={(value) => handleFieldChange(field.id, value)}
          />
        );

      case 'checkbox':
        return (
          <Checkbox
            key={field.id}
            label={field.label}
            checked={(formData[field.id] as boolean) || false}
            onChange={(event) => handleFieldChange(field.id, event.currentTarget.checked)}
          />
        );

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            onChange={(event) => handleFieldChange(field.id, event.currentTarget.value)}
          />
        );

      default:
        return (
          <TextInput
            {...commonProps}
            onChange={(event) => handleFieldChange(field.id, event.currentTarget.value)}
          />
        );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="apart" mb="md">
        <div>
          <Title order={2}>{config.title}</Title>
          <Text size="sm" c="dimmed">{config.subtitle}</Text>
        </div>
        <Badge color="green" variant="light">
          {config.complexity_reduction} simpler
        </Badge>
      </Group>

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {config.fields.map(renderField)}
          
          <Group justify="apart" mt="xl">
            <Button variant="subtle" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" size="lg">
              {config.confirmation_required ? 'Review & Confirm' : 'Submit'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Card>
  );
};
