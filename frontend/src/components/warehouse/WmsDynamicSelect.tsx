import { DynamicSelect, type DynamicSelectField, type DynamicSelectOption } from '../ui/DynamicSelect';

export type WmsSelectOption = DynamicSelectOption;
export type WmsSelectField = DynamicSelectField;

type Props = {
  label: string;
  placeholder?: string;
  value: string;
  displayValue?: string;
  options: WmsSelectOption[];
  disabled?: boolean;
  loading?: boolean;
  allowManage?: boolean;
  addFields: WmsSelectField[];
  editFields?: WmsSelectField[];
  onSelect: (value: string, option: WmsSelectOption | null) => void;
  onAdd: (fields: Record<string, string>) => Promise<void>;
  onUpdate?: (
    option: WmsSelectOption,
    fields: Record<string, string>,
    confirmPassword: string
  ) => Promise<void>;
  onDelete?: (option: WmsSelectOption, confirmPassword: string) => Promise<void>;
};

export function WmsDynamicSelect(props: Props) {
  const { onSelect, ...rest } = props;
  return (
    <DynamicSelect
      {...rest}
      allowManage={props.allowManage ?? true}
      onChange={onSelect}
      onAdd={props.onAdd}
      onUpdate={props.onUpdate}
      onDelete={props.onDelete}
    />
  );
}
