'use client';

import {
  createContext,
  useContext,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { Icon, type IconName } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

/* ==========================================================================
   Field — label, control, hint and error, wired together.

   The label/hint/error ids are generated once and shared through context, so
   every control is correctly associated with its description and its error
   without each form having to remember to do it. An error also sets
   `aria-invalid`, so assistive tech hears the failure, not just sighted users.
   ========================================================================== */

interface FieldContextValue {
  controlId: string;
  describedBy?: string;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

function useFieldContext(): FieldContextValue | null {
  return useContext(FieldContext);
}

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  /** Right-aligned helper beside the label, e.g. "Optional" or a char count. */
  labelAccessory?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  hint,
  error,
  required = false,
  labelAccessory,
  children,
  className,
}: FieldProps) {
  const controlId = useId();
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');

  return (
    <FieldContext.Provider
      value={{ controlId, describedBy: describedBy || undefined, invalid: Boolean(error) }}
    >
      <div className={cn('flex flex-col gap-1.5', className)}>
        {label ? (
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={controlId} className="text-[0.8125rem] font-medium text-content-primary">
              {label}
              {required ? (
                <span className="ml-0.5 text-critical-600" aria-hidden>
                  *
                </span>
              ) : null}
            </label>
            {labelAccessory ? (
              <span className="text-xs text-content-tertiary">{labelAccessory}</span>
            ) : null}
          </div>
        ) : null}

        {children}

        {error ? (
          <p id={errorId} className="flex items-start gap-1.5 text-xs text-critical-600">
            <Icon name="alert-circle" size={14} className="mt-px" />
            <span>{error}</span>
          </p>
        ) : hint ? (
          <p id={hintId} className="text-xs text-content-tertiary">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/* ==========================================================================
   Control styling
   ========================================================================== */

const CONTROL_BASE =
  'w-full rounded-lg bg-surface-card text-sm text-content-primary transition-[box-shadow,background-color] duration-150 placeholder:text-content-tertiary ring-1 ring-border-default ring-inset hover:ring-border-strong focus:ring-2 focus:ring-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-content-tertiary';

const INVALID = 'ring-critical-400 hover:ring-critical-500 focus:ring-critical-500';

export type ControlSize = 'sm' | 'md' | 'lg';

const HEIGHTS: Record<ControlSize, string> = {
  sm: 'h-9 px-3',
  md: 'h-10 px-3.5',
  lg: 'h-12 px-4 text-[0.9375rem]',
};

/* ==========================================================================
   Input
   ========================================================================== */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: ControlSize;
  /** Leading icon inside the field. */
  icon?: IconName;
  /** Static text at the end of the field, e.g. a unit or currency code. */
  suffix?: ReactNode;
  invalid?: boolean;
}

export function Input({
  size = 'md',
  icon,
  suffix,
  invalid,
  className,
  id,
  ...props
}: InputProps) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <div className="relative flex items-center">
      {icon ? (
        <Icon
          name={icon}
          size={17}
          className="pointer-events-none absolute left-3 text-content-tertiary"
        />
      ) : null}
      <input
        id={id ?? field?.controlId}
        aria-describedby={field?.describedBy}
        aria-invalid={isInvalid || undefined}
        className={cn(
          CONTROL_BASE,
          HEIGHTS[size],
          icon && 'pl-10',
          Boolean(suffix) && 'pr-16',
          isInvalid && INVALID,
          className,
        )}
        {...props}
      />
      {suffix ? (
        <span className="pointer-events-none absolute right-3.5 text-xs font-medium text-content-tertiary">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   Password input — with a show/hide toggle
   ========================================================================== */

export function PasswordInput({ size = 'md', className, id, ...props }: InputProps) {
  const field = useFieldContext();
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative flex items-center">
      <Icon
        name="lock"
        size={17}
        className="pointer-events-none absolute left-3 text-content-tertiary"
      />
      <input
        id={id ?? field?.controlId}
        type={visible ? 'text' : 'password'}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
        className={cn(
          CONTROL_BASE,
          HEIGHTS[size],
          'pr-11 pl-10',
          field?.invalid && INVALID,
          className,
        )}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        // `aria-pressed` rather than a changing label, so the control's name
        // stays stable while its state is announced.
        aria-pressed={visible}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-1.5 inline-flex h-8 w-8 items-center justify-center rounded-md text-content-tertiary transition-colors hover:bg-ink-100 hover:text-content-secondary dark:hover:bg-surface-raised"
      >
        <Icon name={visible ? 'eye-off' : 'eye'} size={17} />
      </button>
    </div>
  );
}

/* ==========================================================================
   Textarea
   ========================================================================== */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, id, rows = 4, ...props }: TextareaProps) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <textarea
      id={id ?? field?.controlId}
      rows={rows}
      aria-describedby={field?.describedBy}
      aria-invalid={isInvalid || undefined}
      className={cn(
        CONTROL_BASE,
        'resize-y px-3.5 py-2.5 leading-relaxed',
        isInvalid && INVALID,
        className,
      )}
      {...props}
    />
  );
}

/* ==========================================================================
   Select — native, deliberately

   A native <select> gets platform-correct keyboard behaviour and the right
   picker on touch devices for free. The custom chevron keeps it on-brand.
   ========================================================================== */

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: ControlSize;
  invalid?: boolean;
  /** Convenience for simple lists; children win when both are given. */
  options?: Array<{ value: string | number; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export function Select({
  size = 'md',
  invalid,
  options,
  placeholder,
  className,
  children,
  id,
  ...props
}: SelectProps) {
  const field = useFieldContext();
  const isInvalid = invalid ?? field?.invalid ?? false;

  return (
    <div className="relative flex items-center">
      <select
        id={id ?? field?.controlId}
        aria-describedby={field?.describedBy}
        aria-invalid={isInvalid || undefined}
        className={cn(
          CONTROL_BASE,
          HEIGHTS[size],
          'cursor-pointer appearance-none pr-9',
          isInvalid && INVALID,
          className,
        )}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {children ??
          options?.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
      </select>
      <Icon
        name="chevron-down"
        size={16}
        className="pointer-events-none absolute right-3 text-content-tertiary"
      />
    </div>
  );
}

/* ==========================================================================
   Checkbox and Switch
   ========================================================================== */

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode;
  description?: string;
}

export function Checkbox({ label, description, className, id, ...props }: CheckboxProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;

  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <span className="relative flex h-5 items-center">
        <input
          id={controlId}
          type="checkbox"
          className="peer h-[1.125rem] w-[1.125rem] shrink-0 cursor-pointer appearance-none rounded-[0.3rem] bg-surface-card ring-1 ring-border-default ring-inset transition-colors checked:bg-brand-600 checked:ring-brand-600 hover:ring-border-strong checked:hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-surface-sunken"
          {...props}
        />
        <Icon
          name="check"
          size={13}
          strokeWidth={3}
          className="pointer-events-none absolute left-[0.1875rem] text-white opacity-0 transition-opacity peer-checked:opacity-100"
        />
      </span>
      {label || description ? (
        <span className="flex flex-col gap-0.5">
          {label ? (
            <label
              htmlFor={controlId}
              className="cursor-pointer text-[0.8125rem] leading-5 font-medium text-content-primary select-none"
            >
              {label}
            </label>
          ) : null}
          {description ? (
            <span className="text-xs text-content-tertiary">{description}</span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  id,
  className,
}: SwitchProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = `${controlId}-description`;

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      {label || description ? (
        <span className="flex flex-col gap-0.5">
          {label ? (
            <label
              htmlFor={controlId}
              className="cursor-pointer text-[0.8125rem] font-medium text-content-primary select-none"
            >
              {label}
            </label>
          ) : null}
          {description ? (
            <span id={descriptionId} className="text-xs text-content-tertiary">
              {description}
            </span>
          ) : null}
        </span>
      ) : null}
      <button
        id={controlId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? descriptionId : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-[1.375rem] w-[2.375rem] shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-brand-600' : 'bg-ink-300 dark:bg-ink-700',
        )}
      >
        <span
          className={cn(
            'inline-block h-[1.0625rem] w-[1.0625rem] rounded-full bg-white shadow-sm transition-transform duration-200',
            checked ? 'translate-x-[1.1875rem]' : 'translate-x-[0.1875rem]',
          )}
        />
      </button>
    </div>
  );
}

/* ==========================================================================
   Radio group — used for segmented choices like adjustment direction
   ========================================================================== */

export interface RadioGroupProps<T extends string> {
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; description?: string; icon?: IconName }>;
  className?: string;
}

export function RadioCardGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  className,
}: RadioGroupProps<T>) {
  return (
    <div role="radiogroup" className={cn('grid gap-2.5 sm:grid-cols-2', className)}>
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <label
            key={option.value}
            className={cn(
              'relative flex cursor-pointer items-start gap-3 rounded-xl p-3.5 ring-1 ring-inset transition-all duration-150',
              selected
                ? 'bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-950/50'
                : 'bg-surface-card ring-border-default hover:ring-border-strong',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.icon ? (
              <span
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                  selected
                    ? 'bg-brand-600 text-white'
                    : 'bg-ink-100 text-content-secondary dark:bg-surface-raised',
                )}
              >
                <Icon name={option.icon} size={17} />
              </span>
            ) : null}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[0.8125rem] font-semibold text-content-primary">
                {option.label}
              </span>
              {option.description ? (
                <span className="text-xs leading-relaxed text-content-tertiary">
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </div>
  );
}
