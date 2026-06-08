import { useMemo } from 'react';
import { DynamicMasterPicker, type DynamicMasterPickerType } from '../../DynamicMasterPicker';
import { useCrmMasters } from '../../../lib/useCrmMasters';

const MASTERS_API = '/morbeez-staff/api/v1/crm/masters';

type Props = {
  masterType: DynamicMasterPickerType;
  label: string;
  /** Stored display name (e.g. "Ginger") */
  value: string;
  onChange: (name: string) => void;
  required?: boolean;
  allowManage?: boolean;
  disabled?: boolean;
};

function resolveMasterId(name: string, items: { id: string; name: string }[]): string {
  const trimmed = name.trim();
  if (!trimmed) return '';
  const key = trimmed.toLowerCase();
  return items.find((item) => item.name.trim().toLowerCase() === key)?.id ?? '';
}

export function WizardMasterPicker({
  masterType,
  label,
  value,
  onChange,
  required,
  allowManage = true,
  disabled,
}: Props) {
  const { items } = useCrmMasters(masterType, null, { apiBase: MASTERS_API });
  const masterId = useMemo(() => resolveMasterId(value, items), [value, items]);
  const displayValue = masterId ? undefined : value.trim() || undefined;

  return (
    <DynamicMasterPicker
      masterType={masterType}
      label={label}
      value={masterId}
      displayValue={displayValue}
      required={required}
      allowManage={allowManage && !disabled}
      disabled={disabled}
      apiBase={MASTERS_API}
      onChange={(_id, item) => onChange(item?.name ?? '')}
    />
  );
}
