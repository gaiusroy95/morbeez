import { useMemo } from 'react';
import { api } from '../../../lib/api';
import { DynamicSelect, type DynamicSelectOption } from '../../ui/DynamicSelect';
import {
  activityEnumFromCategory,
  type FieldActivityType,
} from './field-activity-utils';

type Props = {
  label?: string;
  types: FieldActivityType[];
  value: string;
  cropType?: string | null;
  apiBase: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  onChange: (type: FieldActivityType | null) => void;
  onTypeCreated?: (type: FieldActivityType) => void;
  onTypesChange?: (types: FieldActivityType[]) => void;
};

function mutateApiBase(apiBase: string): string {
  const leadMatch = apiBase.match(/\/leads\/[^/]+$/);
  if (leadMatch) {
    return apiBase.replace(/\/leads\/[^/]+$/, '');
  }
  return apiBase;
}

function mapTypeToOption(type: FieldActivityType): DynamicSelectOption {
  const crop = type.crop ? ` · ${type.crop}` : '';
  return {
    key: type.id,
    value: type.id,
    label: `${type.activity_name}${crop}`,
  };
}

function findType(types: FieldActivityType[], id: string): FieldActivityType | undefined {
  return types.find((t) => t.id === id);
}

/** Field activity type picker with search, add, edit, delete (super admin). */
export function FieldActivityTypePicker({
  label = 'Activity Type',
  types,
  value,
  cropType,
  apiBase,
  required,
  disabled,
  placeholder = 'Select activity type…',
  onChange,
  onTypeCreated,
  onTypesChange,
}: Props) {
  const options = useMemo(() => types.map(mapTypeToOption), [types]);
  const selected = findType(types, value);
  const opsBase = mutateApiBase(apiBase);

  async function createType(name: string) {
    const res = await api<{ ok: boolean; type: FieldActivityType }>(
      `${apiBase}/field-activity-types`,
      {
        method: 'POST',
        body: JSON.stringify({
          activityName: name,
          crop: cropType?.trim().toLowerCase() || null,
        }),
      }
    );
    onTypeCreated?.(res.type);
    onTypesChange?.([...types, res.type]);
    onChange(res.type);
  }

  async function updateType(
    option: DynamicSelectOption,
    fields: Record<string, string>,
    confirmPassword: string
  ) {
    const name = fields.label?.trim();
    if (!name) return;
    const patchUrl = apiBase.includes('/leads/')
      ? `${apiBase}/field-activity-types/${option.value}`
      : `${opsBase}/field-activity-types/${option.value}`;
    const res = await api<{ ok: boolean; type: FieldActivityType }>(patchUrl, {
      method: 'PATCH',
      body: JSON.stringify({ activityName: name, confirmPassword }),
    });
    const next = types.map((t) => (t.id === option.value ? res.type : t));
    onTypesChange?.(next);
    if (value === option.value) onChange(res.type);
  }

  async function removeType(option: DynamicSelectOption, confirmPassword: string) {
    const deleteUrl = apiBase.includes('/leads/')
      ? `${apiBase}/field-activity-types/${option.value}`
      : `${opsBase}/field-activity-types/${option.value}`;
    await api(deleteUrl, {
      method: 'DELETE',
      body: JSON.stringify({ confirmPassword }),
    });
    const next = types.filter((t) => t.id !== option.value);
    onTypesChange?.(next);
    if (value === option.value) onChange(null);
  }

  return (
    <DynamicSelect
      label={label}
      placeholder={placeholder}
      value={value}
      displayValue={selected?.activity_name}
      options={options}
      disabled={disabled}
      allowManage={!disabled}
      addFields={[{ name: 'label', placeholder: 'Activity name' }]}
      editFields={[{ name: 'label', placeholder: 'Activity name' }]}
      onChange={(id) => onChange(id ? findType(types, id) ?? null : null)}
      onAdd={async (fields) => {
        const name = fields.label?.trim();
        if (!name) return;
        await createType(name);
      }}
      onUpdate={updateType}
      onDelete={removeType}
    />
  );
}

export function formPatchFromActivityType(
  type: FieldActivityType,
  prev: { followUpRequired: boolean; activityDate: string; followUpDate: string }
) {
  return {
    activityTypeId: type.id,
    activityLabel: type.activity_name,
    activityType: activityEnumFromCategory(type.category),
    followUpDate:
      prev.followUpRequired && type.followup_default_days != null && prev.activityDate
        ? (() => {
            const due = new Date(`${prev.activityDate}T00:00:00.000Z`);
            due.setUTCDate(due.getUTCDate() + type.followup_default_days!);
            return due.toISOString().slice(0, 10);
          })()
        : prev.followUpDate,
  };
}
