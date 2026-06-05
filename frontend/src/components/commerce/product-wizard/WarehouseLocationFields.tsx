import {
  PRODUCTS_LOCATION_API,
  WarehouseLocationPickers,
  type WarehouseLocationValue,
} from '../../warehouse/WarehouseLocationPickers';

export type { WarehouseLocationValue };

type Props = {
  value: WarehouseLocationValue;
  onChange: (next: WarehouseLocationValue) => void;
};

export function WarehouseLocationFields({ value, onChange }: Props) {
  return (
    <section className="pw-subsection">
      <h3>Warehouse location</h3>
      <WarehouseLocationPickers
        value={value}
        onChange={onChange}
        api={PRODUCTS_LOCATION_API}
        className="warehouse-location-grid warehouse-location-grid--wizard"
      />
    </section>
  );
}
