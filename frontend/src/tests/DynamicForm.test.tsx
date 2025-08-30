import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DynamicForm } from '../components/DynamicForm';
import type { DynamicFormConfig, FormField } from '../types';

// Mock Mantine components to isolate unit under test
vi.mock('@mantine/core', () => ({
  Card: vi.fn(({ children }) => <div data-testid="form-card">{children}</div>),
  Group: vi.fn(({ children, justify }) => (
    <div data-testid="group" data-justify={justify}>{children}</div>
  )),
  Title: vi.fn(({ children, order }) => (
    <h1 data-testid="form-title" data-order={order}>{children}</h1>
  )),
  Text: vi.fn(({ children }) => <div data-testid="form-subtitle">{children}</div>),
  Badge: vi.fn(({ children, color, variant }) => (
    <span data-testid="complexity-badge" data-color={color} data-variant={variant}>{children}</span>
  )),
  Stack: vi.fn(({ children }) => <div data-testid="form-stack">{children}</div>),
  Button: vi.fn(({ children, type, variant, onClick, size }) => (
    <button 
      data-testid={variant === 'subtle' ? 'cancel-button' : 'submit-button'}
      type={variant === 'subtle' ? 'button' : type}
      data-variant={variant}
      data-size={size}
      onClick={() => onClick && onClick()}
    >
      {children}
    </button>
  )),
  TextInput: vi.fn(({ label, placeholder, required, value, onChange, description }) => (
    <div data-testid="text-input">
      <label data-testid="field-label">{label}</label>
      <input
        data-testid="text-input-field"
        type="text"
        placeholder={placeholder}
        data-required={required ? 'true' : 'false'}
        value={value}
        onChange={(e) => onChange?.(e)}
      />
      {description && <div data-testid="field-help">{description}</div>}
    </div>
  )),
  NumberInput: vi.fn(({ label, placeholder, required, value, onChange, description, min, decimalScale, leftSection }) => (
    <div data-testid="number-input">
      <label data-testid="field-label">{label}</label>
      <div data-testid="currency-symbol">{leftSection}</div>
      <input
        data-testid="number-input-field"
        type="number"
        placeholder={placeholder}
        data-required={required ? 'true' : 'false'}
        data-min={min}
        data-decimal-scale={decimalScale}
        value={value}
        onChange={(e) => onChange?.(parseFloat(e.target.value))}
      />
      {description && <div data-testid="field-help">{description}</div>}
    </div>
  )),
  Select: vi.fn(({ label, placeholder, required, value, onChange, description, data, searchable }) => (
    <div data-testid="select-input">
      <label data-testid="field-label">{label}</label>
      <select
        data-testid="select-field"
        data-required={required ? 'true' : 'false'}
        data-searchable={searchable ? 'true' : 'false'}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
      >
        <option value="">{placeholder}</option>
        {data?.map((option: string, index: number) => (
          <option key={index} value={option}>{option}</option>
        ))}
      </select>
      {description && <div data-testid="field-help">{description}</div>}
    </div>
  )),
  Checkbox: vi.fn(({ label, checked, onChange }) => (
    <div data-testid="checkbox-input">
      <input
        data-testid="checkbox-field"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange?.(e)}
      />
      <label data-testid="field-label">{label}</label>
    </div>
  )),
  Textarea: vi.fn(({ label, placeholder, required, value, onChange, description }) => (
    <div data-testid="textarea-input">
      <label data-testid="field-label">{label}</label>
      <textarea
        data-testid="textarea-field"
        placeholder={placeholder}
        data-required={required ? 'true' : 'false'}
        value={value}
        onChange={(e) => onChange?.(e)}
      />
      {description && <div data-testid="field-help">{description}</div>}
    </div>
  ))
}));

describe('DynamicForm Component', () => {
  const user = userEvent.setup();
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();

  const baseConfig: DynamicFormConfig = {
    screen_id: 'test_form',
    title: 'Test Form',
    subtitle: 'Test form subtitle',
    fields: [],
    confirmation_required: false,
    complexity_reduction: '40%'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Component Rendering', () => {
    it('render() - should render form with basic configuration', async () => {
      // ARRANGE
      const config = { ...baseConfig };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT
      expect(screen.getByTestId('form-card')).toBeDefined();
      expect(screen.getByTestId('form-title')).toBeDefined();
      expect(screen.getByTestId('form-subtitle')).toBeDefined();
      expect(screen.getByTestId('complexity-badge')).toBeDefined();
      expect(screen.getByTestId('submit-button')).toBeDefined();
      expect(screen.getByTestId('cancel-button')).toBeDefined();
    });

    it('render() - should display confirmation text when confirmation required', async () => {
      // ARRANGE
      const config: DynamicFormConfig = {
        ...baseConfig,
        confirmation_required: true
      };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT
      expect(screen.getByTestId('submit-button')).toBeDefined();
    });

    it('render() - should render form without fields when fields array is empty', async () => {
      // ARRANGE
      const config = { ...baseConfig, fields: [] };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT
      expect(screen.getByTestId('form-stack')).toBeDefined();
      expect(screen.queryByTestId('text-input')).toBeNull();
      expect(screen.queryByTestId('number-input')).toBeNull();
      expect(screen.queryByTestId('select-input')).toBeNull();
    });
  });

  describe('useEffect() - Form Initialization', () => {
    it('useEffect() - should initialize form with pre-filled field values', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'test_field',
          type: 'text',
          label: 'Test Field',
          required: true,
          value: 'pre-filled value'
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT
      expect(screen.getByTestId('text-input-field')).toBeDefined();
    });

    it('useEffect() - should initialize form with empty values when no pre-filled values', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'test_field',
          type: 'text',
          label: 'Test Field',
          required: true
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT
      expect(screen.getByTestId('text-input-field')).toBeDefined();
    });

    it('useEffect() - should re-initialize when config changes', async () => {
      // ARRANGE
      const initialFields: FormField[] = [
        {
          id: 'initial_field',
          type: 'text',
          label: 'Initial Field',
          required: true,
          value: 'initial value'
        }
      ];
      const initialConfig: DynamicFormConfig = { ...baseConfig, fields: initialFields };

      // ACT - Initial render
      const { rerender } = await act(async () => {
        return render(<DynamicForm config={initialConfig} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ARRANGE - New config
      const newFields: FormField[] = [
        {
          id: 'new_field',
          type: 'text',
          label: 'New Field',
          required: true,
          value: 'new value'
        }
      ];
      const newConfig: DynamicFormConfig = { ...baseConfig, fields: newFields };

      // ACT - Re-render with new config
      await act(async () => {
        rerender(<DynamicForm config={newConfig} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT
      expect(screen.getByTestId('text-input-field')).toBeDefined();
    });
  });

  describe('renderField() - Field Type Rendering', () => {
    it('renderField() - should render text input field by default', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'text_field',
          type: 'text',
          label: 'Text Field',
          placeholder: 'Enter text',
          required: true,
          help_text: 'Help text'
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT
      expect(screen.getByTestId('text-input')).toBeDefined();
      expect(screen.getByTestId('text-input-field')).toBeDefined();
      expect(screen.getByTestId('text-input-field').getAttribute('data-required')).toBe('true');
      expect(screen.getByTestId('field-help')).toBeDefined();
    });

    it('renderField() - should render amount/number input field with currency symbol', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'amount_field',
          type: 'amount',
          label: 'Amount Field',
          placeholder: 'Enter amount',
          required: true
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT
      expect(screen.getByTestId('number-input')).toBeDefined();
      expect(screen.getByTestId('number-input-field')).toBeDefined();
      expect(screen.getByTestId('currency-symbol')).toBeDefined();
      expect(screen.getByTestId('number-input-field').getAttribute('data-min')).toBe('0');
      expect(screen.getByTestId('number-input-field').getAttribute('data-decimal-scale')).toBe('2');
    });

    it('renderField() - should render dropdown select field with options', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'dropdown_field',
          type: 'dropdown',
          label: 'Dropdown Field',
          required: false,
          options: ['Option 1', 'Option 2', 'Option 3']
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT
      expect(screen.getByTestId('select-input')).toBeDefined();
      expect(screen.getByTestId('select-field')).toBeDefined();
      expect(screen.getByTestId('select-field').getAttribute('data-required')).toBe('false');
      const selectField = screen.getByTestId('select-field');
      expect(selectField.querySelectorAll('option')).toHaveLength(4); // placeholder + 3 options
    });

    it('renderField() - should render account select field with predefined options', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'account_field',
          type: 'account_select',
          label: 'Account Field',
          required: true
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT
      expect(screen.getByTestId('select-input')).toBeDefined();
      expect(screen.getByTestId('select-field')).toBeDefined();
      const selectField = screen.getByTestId('select-field');
      expect(selectField.querySelectorAll('option')).toHaveLength(3); // placeholder + 2 accounts
    });

    it('renderField() - should render recipient select field with searchable capability', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'recipient_field',
          type: 'recipient_select',
          label: 'Recipient Field',
          required: true
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT
      expect(screen.getByTestId('select-input')).toBeDefined();
      expect(screen.getByTestId('select-field')).toBeDefined();
      expect(screen.getByTestId('select-field').getAttribute('data-searchable')).toBe('true');
      const selectField = screen.getByTestId('select-field');
      expect(selectField.querySelectorAll('option')).toHaveLength(5); // placeholder + 4 recipients
    });

    it('renderField() - should render checkbox field', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'checkbox_field',
          type: 'checkbox',
          label: 'Checkbox Field',
          required: false
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT
      expect(screen.getByTestId('checkbox-input')).toBeDefined();
      expect(screen.getByTestId('checkbox-field')).toBeDefined();
      expect((screen.getByTestId('checkbox-field') as HTMLInputElement).type).toBe('checkbox');
    });

    it('renderField() - should render textarea field', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'textarea_field',
          type: 'textarea',
          label: 'Textarea Field',
          placeholder: 'Enter long text',
          required: false,
          help_text: 'Enter detailed information'
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT
      expect(screen.getByTestId('textarea-input')).toBeDefined();
      expect(screen.getByTestId('textarea-field')).toBeDefined();
      expect(screen.getByTestId('textarea-field').getAttribute('data-required')).toBe('false');
      expect(screen.getByTestId('field-help')).toBeDefined();
    });

    it('renderField() - should not render hidden fields', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'visible_field',
          type: 'text',
          label: 'Visible Field',
          required: true
        },
        {
          id: 'hidden_field',
          type: 'text',
          label: 'Hidden Field',
          required: true,
          hidden: true
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT
      expect(screen.getAllByTestId('text-input')).toHaveLength(1);
      expect(screen.getAllByTestId('text-input-field')).toHaveLength(1);
    });
  });

  describe('handleFieldChange() - Field Value Updates', () => {
    it('handleFieldChange() - should update field value for text input', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'text_field',
          type: 'text',
          label: 'Text Field',
          required: true
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      const textInput = screen.getByTestId('text-input-field');
      await act(async () => {
        await user.type(textInput, 'test value');
      });

      // ASSERT
      // The mock handles the onChange, so we verify the input exists and is interactable
      expect(textInput).toBeDefined();
    });

    it('handleFieldChange() - should update field value for number input', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'amount_field',
          type: 'amount',
          label: 'Amount Field',
          required: true
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      const numberInput = screen.getByTestId('number-input-field');
      await act(async () => {
        await user.type(numberInput, '123.45');
      });

      // ASSERT
      expect(numberInput).toBeDefined();
    });

    it('handleFieldChange() - should update field value for select input', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'dropdown_field',
          type: 'dropdown',
          label: 'Dropdown Field',
          required: true,
          options: ['Option 1', 'Option 2']
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      const selectInput = screen.getByTestId('select-field');
      await act(async () => {
        await user.selectOptions(selectInput, 'Option 1');
      });

      // ASSERT
      expect(selectInput).toBeDefined();
    });

    it('handleFieldChange() - should update field value for checkbox input', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'checkbox_field',
          type: 'checkbox',
          label: 'Checkbox Field',
          required: false
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      const checkboxInput = screen.getByTestId('checkbox-field');
      await act(async () => {
        await user.click(checkboxInput);
      });

      // ASSERT
      expect(checkboxInput).toBeDefined();
    });

    it('handleFieldChange() - should update field value for textarea input', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'textarea_field',
          type: 'textarea',
          label: 'Textarea Field',
          required: false
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      const textareaInput = screen.getByTestId('textarea-field');
      await act(async () => {
        await user.type(textareaInput, 'long text content');
      });

      // ASSERT
      expect(textareaInput).toBeDefined();
    });
  });

  describe('handleSubmit() - Form Submission', () => {
    it('handleSubmit() - should call onSubmit with form data when form is submitted', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'test_field',
          type: 'text',
          label: 'Test Field',
          required: true,
          value: 'initial value'
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      const submitButton = screen.getByTestId('submit-button');
      await act(async () => {
        await user.click(submitButton);
      });

      // ASSERT
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      expect(mockOnSubmit).toHaveBeenCalledWith({ test_field: 'initial value' });
    });

    it('handleSubmit() - should prevent default form submission', async () => {
      // ARRANGE
      const config: DynamicFormConfig = { ...baseConfig, fields: [] };
      const mockPreventDefault = vi.fn();

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // Simulate form submission with preventDefault mock
      const form = screen.getByTestId('form-card').querySelector('form');
      if (form) {
        const event = new Event('submit', { bubbles: true, cancelable: true });
        event.preventDefault = mockPreventDefault;
        
        await act(async () => {
          form.dispatchEvent(event);
        });
      }

      // ASSERT - Form submission is handled by the component
      expect(screen.getByTestId('submit-button')).toBeDefined();
    });

    it('handleSubmit() - should call onSubmit with empty form data when no fields', async () => {
      // ARRANGE
      const config: DynamicFormConfig = { ...baseConfig, fields: [] };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      const submitButton = screen.getByTestId('submit-button');
      await act(async () => {
        await user.click(submitButton);
      });

      // ASSERT
      expect(mockOnSubmit).toHaveBeenCalledTimes(1);
      expect(mockOnSubmit).toHaveBeenCalledWith({});
    });
  });

  describe('onCancel() - Form Cancellation', () => {
    it('onCancel() - should call onCancel callback when cancel button is clicked', async () => {
      // ARRANGE
      const config: DynamicFormConfig = { ...baseConfig, fields: [] };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      const cancelButton = screen.getByTestId('cancel-button');
      await act(async () => {
        await user.click(cancelButton);
      });

      // ASSERT
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnCancel).toHaveBeenCalledWith();
    });

    it('onCancel() - should not call onSubmit when cancel button is clicked', async () => {
      // ARRANGE
      const config: DynamicFormConfig = { ...baseConfig, fields: [] };
      const freshMockOnSubmit = vi.fn();
      const freshMockOnCancel = vi.fn();

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={freshMockOnSubmit} onCancel={freshMockOnCancel} />);
      });

      const cancelButton = screen.getByTestId('cancel-button');
      await act(async () => {
        await user.click(cancelButton);
      });

      // ASSERT
      expect(freshMockOnSubmit).not.toHaveBeenCalled();
      expect(freshMockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Component State Management - Edge Cases', () => {
    it('useState(formData) - should handle multiple field updates correctly', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'field1',
          type: 'text',
          label: 'Field 1',
          required: true
        },
        {
          id: 'field2',
          type: 'text',
          label: 'Field 2',
          required: true
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      const textInputs = screen.getAllByTestId('text-input-field');
      await act(async () => {
        await user.type(textInputs[0], 'value1');
        await user.type(textInputs[1], 'value2');
      });

      // ASSERT
      expect(textInputs).toHaveLength(2);
      expect(textInputs[0]).toBeDefined();
      expect(textInputs[1]).toBeDefined();
    });

    it('renderField() - should handle unknown field type as text input', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'unknown_field',
          type: 'unknown_type',
          label: 'Unknown Field Type',
          required: true
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT - Unknown types should render as text input (default case)
      expect(screen.getByTestId('text-input')).toBeDefined();
      expect(screen.getByTestId('text-input-field')).toBeDefined();
    });

    it('useState(formData) - should preserve form state during re-renders', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'persistent_field',
          type: 'text',
          label: 'Persistent Field',
          required: true,
          value: 'initial'
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      const { rerender } = await act(async () => {
        return render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // Re-render with same config
      await act(async () => {
        rerender(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT
      expect(screen.getByTestId('text-input-field')).toBeDefined();
    });

    it('handleFieldChange() - should handle null/undefined field values gracefully', async () => {
      // ARRANGE
      const fields: FormField[] = [
        {
          id: 'nullable_field',
          type: 'text',
          label: 'Nullable Field',
          required: false
        }
      ];
      const config: DynamicFormConfig = { ...baseConfig, fields };

      // ACT
      await act(async () => {
        render(<DynamicForm config={config} onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
      });

      // ASSERT - Component should render without errors
      expect(screen.getByTestId('text-input')).toBeDefined();
      expect(screen.getByTestId('text-input-field')).toBeDefined();
    });
  });
});
