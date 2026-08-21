import { MasterSelect } from './MasterSelect';

type Props = {
  label?: string;
  value: string;
  onChange: (id: string, name: string) => void;
  required?: boolean;
  disabled?: boolean;
  apiBase?: string;
};

/** Interaction type with search, add, edit, delete (super admin). */
export function InteractionTypePicker({
  label = 'Interaction type',
  value,
  onChange,
  required,
  disabled,
  apiBase,
}: Props) {
  return (
    <MasterSelect
      masterType="interaction_type"
      label={label}
      value={value}
      onChange={onChange}
      required={required}
      disabled={disabled}
      apiBase={apiBase}
      allowAdd
    />
  );
}
