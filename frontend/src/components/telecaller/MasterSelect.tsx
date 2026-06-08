import { DynamicMasterPicker } from '../DynamicMasterPicker';

type Props = {
  masterType: string;
  label: string;
  value: string;
  onChange: (id: string, name: string) => void;
  parentId?: string | null;
  allowAdd?: boolean;
  className?: string;
  apiBase?: string;
  displayValue?: string;
  required?: boolean;
  disabled?: boolean;
};

export function MasterSelect({
  masterType,
  label,
  value,
  onChange,
  parentId,
  allowAdd = true,
  className,
  apiBase,
  displayValue,
  required,
  disabled,
}: Props) {
  return (
    <DynamicMasterPicker
      masterType={masterType}
      parentId={parentId}
      label={label}
      value={value}
      displayValue={displayValue}
      allowManage={allowAdd}
      apiBase={apiBase}
      className={className}
      required={required}
      disabled={disabled}
      cropValueSlug={masterType === 'crop'}
      onChange={(id, item) => onChange(id, item?.name ?? '')}
      onMarketKeyChange={
        masterType === 'market'
          ? (key, item) => onChange(item?.id ?? key, item?.name ?? key)
          : undefined
      }
    />
  );
}
