import { DynamicMasterPicker, type DynamicMasterPickerType } from '../DynamicMasterPicker';

const DEFAULT_MASTERS_API = '/morbeez-staff/api/v1/crm/masters';

type Props = {
  masterType: DynamicMasterPickerType;
  label: string;
  value: string;
  onChange: (id: string, name: string) => void;
  parentId?: string | null;
  displayValue?: string;
  placeholder?: string;
  required?: boolean;
  allowManage?: boolean;
  disabled?: boolean;
  className?: string;
  apiBase?: string;
  /** When masterType is crop, value may be a crop slug instead of master id. */
  cropValueSlug?: boolean;
};

/**
 * Searchable dropdown backed by crm_masters with add / edit / delete (super admin).
 */
export function MasterDropdown({
  masterType,
  label,
  value,
  onChange,
  parentId,
  displayValue,
  placeholder,
  required,
  allowManage = true,
  disabled,
  className,
  apiBase = DEFAULT_MASTERS_API,
  cropValueSlug,
}: Props) {
  return (
    <DynamicMasterPicker
      masterType={masterType}
      parentId={parentId}
      label={label}
      value={value}
      displayValue={displayValue}
      placeholder={placeholder}
      required={required}
      allowManage={allowManage && !disabled}
      disabled={disabled}
      className={className}
      apiBase={apiBase}
      cropValueSlug={cropValueSlug}
      onChange={(id, item) => onChange(id, item?.name ?? '')}
      onMarketKeyChange={
        masterType === 'market'
          ? (key, item) => onChange(item?.id ?? key, item?.name ?? key)
          : undefined
      }
    />
  );
}
