import { MasterSelect } from '../telecaller/MasterSelect';
import { WMS_API } from './warehouse-api';

type Props = {
  value: string;
  /** Saved courier name when master id is unknown (legacy / loaded from order). */
  displayValue?: string;
  onChange: (id: string, name: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

/** Searchable manual logistics courier picker with add / edit / delete (super admin). */
export function ManualCourierPicker({
  value,
  displayValue,
  onChange,
  disabled,
  required,
  className,
}: Props) {
  return (
    <MasterSelect
      masterType="manual_courier"
      label="Logistics / Courier name"
      value={value}
      displayValue={displayValue}
      apiBase={`${WMS_API}/masters`}
      required={required}
      disabled={disabled}
      className={className ?? 'pp-manual-courier-picker'}
      onChange={onChange}
    />
  );
}
