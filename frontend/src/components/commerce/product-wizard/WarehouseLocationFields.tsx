import {
  PRODUCTS_LOCATION_API,
  WarehouseLocationPickers,
  type WarehouseLocationValue,
} from '../../warehouse/WarehouseLocationPickers';

export type { WarehouseLocationValue };

type Props = {
  value: WarehouseLocationValue;
  onChange: (next: WarehouseLocationValue) => void;
  allowManage?: boolean;
  disabled?: boolean;
};

export function WarehouseLocationFields({
  value,
  onChange,
  allowManage = true,
  disabled = false,
}: Props) {
  return (
    <section className="pw-subsection">
      <h3>Warehouse location</h3>
      <WarehouseLocationPickers
        value={value}
        onChange={onChange}
        api={PRODUCTS_LOCATION_API}
        allowManage={allowManage}
        disabled={disabled}
        className="warehouse-location-grid warehouse-location-grid--wizard"
      />
    </section>
  );
}
