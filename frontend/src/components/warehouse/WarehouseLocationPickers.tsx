import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { WMS_API } from './warehouse-api';
import { WmsDynamicSelect, type WmsSelectOption } from './WmsDynamicSelect';

export type WarehouseLocationValue = {
  warehouseId: string;
  warehouseName: string;
  rackId: string;
  rackRow: string;
  locationId: string;
};

export const emptyWarehouseLocation = (): WarehouseLocationValue => ({
  warehouseId: '',
  warehouseName: '',
  rackId: '',
  rackRow: '',
  locationId: '',
});

type Warehouse = { id: string; name: string; code?: string };
type Location = {
  id: string;
  rack: string;
  shelf: string | null;
  bin: string | null;
  zone?: string | null;
  location_code?: string | null;
};

export type WarehouseLocationApi = {
  warehousesUrl: string;
  locationsUrl: (warehouseId: string) => string;
  useWmsCrud?: boolean;
};

export const WMS_LOCATION_API: WarehouseLocationApi = {
  warehousesUrl: `${WMS_API}/warehouses`,
  locationsUrl: (id) => `${WMS_API}/warehouses/${id}/locations`,
  useWmsCrud: true,
};

export const PRODUCTS_LOCATION_API: WarehouseLocationApi = {
  warehousesUrl: '/morbeez-staff/api/v1/products/warehouse-options/warehouses',
  locationsUrl: (id) => `/morbeez-staff/api/v1/products/warehouse-options/${id}/locations`,
  useWmsCrud: false,
};

function rowLabel(loc: Location): string {
  if (loc.shelf?.trim()) return loc.shelf.trim();
  if (loc.bin?.trim()) return loc.bin.trim();
  return loc.location_code ?? '—';
}

type Props = {
  value: WarehouseLocationValue;
  onChange: (next: WarehouseLocationValue) => void;
  api?: WarehouseLocationApi;
  disabled?: boolean;
  className?: string;
  showHint?: boolean;
  allowManage?: boolean;
};

export function WarehouseLocationPickers({
  value,
  onChange,
  api: apiConfig = WMS_LOCATION_API,
  disabled,
  className = 'warehouse-location-grid',
  showHint = true,
  allowManage = true,
}: Props) {
  const canManage = allowManage && apiConfig.useWmsCrud !== false && !disabled;

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingWh, setLoadingWh] = useState(true);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [error, setError] = useState('');

  const loadWarehouses = useCallback(async () => {
    setLoadingWh(true);
    try {
      const d = await api<{ ok: boolean; warehouses: Warehouse[] }>(apiConfig.warehousesUrl);
      setWarehouses(d.warehouses ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load warehouses');
    } finally {
      setLoadingWh(false);
    }
  }, [apiConfig.warehousesUrl]);

  const loadLocations = useCallback(async () => {
    if (!value.warehouseId) {
      setLocations([]);
      return;
    }
    setLoadingLoc(true);
    setError('');
    try {
      const d = await api<{ ok: boolean; locations: Location[] }>(
        apiConfig.locationsUrl(value.warehouseId)
      );
      setLocations(d.locations ?? []);
    } catch (e) {
      setLocations([]);
      setError(e instanceof Error ? e.message : 'Could not load rack locations');
    } finally {
      setLoadingLoc(false);
    }
  }, [value.warehouseId, apiConfig]);

  useEffect(() => {
    void loadWarehouses();
  }, [loadWarehouses]);

  useEffect(() => {
    void loadLocations();
  }, [loadLocations]);

  const warehouseOptions: WmsSelectOption[] = useMemo(
    () =>
      warehouses.map((w) => ({
        key: w.id,
        value: w.id,
        label: w.code ? `${w.name} (${w.code})` : w.name,
      })),
    [warehouses]
  );

  const racks = useMemo(() => {
    const set = new Set<string>();
    for (const loc of locations) {
      if (loc.rack?.trim()) set.add(loc.rack.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [locations]);

  const rackOptions: WmsSelectOption[] = useMemo(
    () => racks.map((rack) => ({ key: rack, value: rack, label: rack })),
    [racks]
  );

  const rows = useMemo(() => {
    if (!value.rackId) return [];
    const filtered = locations.filter((l) => l.rack === value.rackId);
    const map = new Map<string, Location>();
    for (const loc of filtered) {
      const label = rowLabel(loc);
      if (!map.has(label)) map.set(label, loc);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([label, loc]) => ({ label, loc }));
  }, [locations, value.rackId]);

  const rowOptions: WmsSelectOption[] = useMemo(
    () =>
      rows.map(({ label, loc }) => ({
        key: loc.id,
        value: label,
        label,
      })),
    [rows]
  );

  const rowByLabel = useMemo(() => new Map(rows.map((r) => [r.label, r.loc])), [rows]);

  function onWarehouseSelect(warehouseId: string) {
    const wh = warehouses.find((w) => w.id === warehouseId);
    onChange({
      warehouseId,
      warehouseName: wh?.name ?? '',
      rackId: '',
      rackRow: '',
      locationId: '',
    });
  }

  function onRackSelect(rackId: string) {
    onChange({ ...value, rackId, rackRow: '', locationId: '' });
  }

  function onRowSelect(rackRow: string) {
    const match = rowByLabel.get(rackRow);
    onChange({ ...value, rackRow, locationId: match?.id ?? '' });
  }

  async function addWarehouse(fields: Record<string, string>) {
    const res = await api<{ ok: boolean; warehouse: Warehouse }>(`${WMS_API}/warehouses`, {
      method: 'POST',
      body: JSON.stringify({
        name: fields.name?.trim(),
        code: fields.code?.trim(),
      }),
    });
    await loadWarehouses();
    onWarehouseSelect(res.warehouse.id);
  }

  async function updateWarehouse(
    option: WmsSelectOption,
    fields: Record<string, string>,
    confirmPassword: string
  ) {
    await api(`${WMS_API}/warehouses/${option.value}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: fields.name?.trim(),
        code: fields.code?.trim(),
        confirmPassword,
      }),
    });
    await loadWarehouses();
    if (value.warehouseId === option.value) {
      const wh = warehouses.find((w) => w.id === option.value);
      onChange({
        ...value,
        warehouseName: fields.name?.trim() || wh?.name || value.warehouseName,
      });
    }
  }

  async function deleteWarehouse(option: WmsSelectOption, confirmPassword: string) {
    await api(`${WMS_API}/warehouses/${option.value}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmPassword }),
    });
    await loadWarehouses();
    if (value.warehouseId === option.value) {
      onChange(emptyWarehouseLocation());
    }
  }

  async function addRack(fields: Record<string, string>) {
    if (!value.warehouseId) throw new Error('Select a warehouse first');
    await api(`${WMS_API}/locations`, {
      method: 'POST',
      body: JSON.stringify({
        warehouseId: value.warehouseId,
        rack: fields.rack?.trim(),
        shelf: '1',
      }),
    });
    await loadLocations();
    onRackSelect(fields.rack?.trim() ?? '');
  }

  async function updateRack(
    option: WmsSelectOption,
    fields: Record<string, string>,
    confirmPassword: string
  ) {
    if (!value.warehouseId) return;
    await api(
      `${WMS_API}/warehouses/${value.warehouseId}/racks/${encodeURIComponent(option.value)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ newRack: fields.rack?.trim(), confirmPassword }),
      }
    );
    await loadLocations();
    if (value.rackId === option.value) {
      onChange({
        ...value,
        rackId: fields.rack?.trim() ?? value.rackId,
        rackRow: '',
        locationId: '',
      });
    }
  }

  async function deleteRack(option: WmsSelectOption, confirmPassword: string) {
    if (!value.warehouseId) return;
    await api(
      `${WMS_API}/warehouses/${value.warehouseId}/racks/${encodeURIComponent(option.value)}`,
      { method: 'DELETE', body: JSON.stringify({ confirmPassword }) }
    );
    await loadLocations();
    if (value.rackId === option.value) {
      onChange({ ...value, rackId: '', rackRow: '', locationId: '' });
    }
  }

  async function addRow(fields: Record<string, string>) {
    if (!value.warehouseId || !value.rackId) throw new Error('Select warehouse and rack first');
    const res = await api<{ ok: boolean; location: Location }>(`${WMS_API}/locations`, {
      method: 'POST',
      body: JSON.stringify({
        warehouseId: value.warehouseId,
        rack: value.rackId,
        shelf: fields.row?.trim(),
      }),
    });
    await loadLocations();
    onRowSelect(rowLabel(res.location));
  }

  async function updateRow(
    option: WmsSelectOption,
    fields: Record<string, string>,
    confirmPassword: string
  ) {
    const loc = rowByLabel.get(option.value);
    if (!loc) return;
    const res = await api<{ ok: boolean; location: Location }>(`${WMS_API}/locations/${loc.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ shelf: fields.row?.trim(), confirmPassword }),
    });
    await loadLocations();
    const nextLabel = rowLabel(res.location);
    if (value.rackRow === option.value) {
      onChange({ ...value, rackRow: nextLabel, locationId: res.location.id });
    }
  }

  async function deleteRow(option: WmsSelectOption, confirmPassword: string) {
    const loc = rowByLabel.get(option.value);
    if (!loc) return;
    await api(`${WMS_API}/locations/${loc.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmPassword }),
    });
    await loadLocations();
    if (value.rackRow === option.value) {
      onChange({ ...value, rackRow: '', locationId: '' });
    }
  }

  return (
    <div className={className}>
      {showHint ? (
        <p className="warehouse-location-hint">
          Search, add, edit, or remove warehouses, racks, and rows — layout syncs to WMS storage
          locations.
        </p>
      ) : null}
      {error ? <p className="warehouse-location-error">{error}</p> : null}

      <WmsDynamicSelect
        label="Warehouse"
        placeholder={loadingWh ? 'Loading…' : 'Select warehouse'}
        value={value.warehouseId}
        displayValue={value.warehouseName || undefined}
        options={warehouseOptions}
        disabled={disabled}
        loading={loadingWh}
        allowManage={canManage}
        addFields={[
          { name: 'name', placeholder: 'Warehouse name' },
          { name: 'code', placeholder: 'Code (e.g. WH-B)', narrow: true },
        ]}
        onSelect={onWarehouseSelect}
        onAdd={addWarehouse}
        onUpdate={canManage ? updateWarehouse : undefined}
        onDelete={canManage ? deleteWarehouse : undefined}
      />

      <WmsDynamicSelect
        label="Rack ID"
        placeholder={
          !value.warehouseId
            ? 'Select warehouse first'
            : loadingLoc
              ? 'Loading…'
              : rackOptions.length
                ? 'Select rack'
                : 'No racks — add below'
        }
        value={value.rackId}
        options={rackOptions}
        disabled={disabled || !value.warehouseId}
        loading={loadingLoc}
        allowManage={canManage && !!value.warehouseId}
        addFields={[{ name: 'rack', placeholder: 'Rack ID (e.g. R-01)' }]}
        editFields={[{ name: 'rack', placeholder: 'Rack ID' }]}
        onSelect={onRackSelect}
        onAdd={addRack}
        onUpdate={canManage ? updateRack : undefined}
        onDelete={canManage ? deleteRack : undefined}
      />

      <WmsDynamicSelect
        label="Rack row"
        placeholder={
          !value.rackId
            ? 'Select rack first'
            : rowOptions.length
              ? 'Select row'
              : 'No rows — add below'
        }
        value={value.rackRow}
        options={rowOptions}
        disabled={disabled || !value.rackId}
        loading={loadingLoc}
        allowManage={canManage && !!value.rackId}
        addFields={[{ name: 'row', placeholder: 'Row / shelf (e.g. 1)' }]}
        editFields={[{ name: 'row', placeholder: 'Row / shelf' }]}
        onSelect={onRowSelect}
        onAdd={addRow}
        onUpdate={canManage ? updateRow : undefined}
        onDelete={canManage ? deleteRow : undefined}
      />

      {value.locationId ? (
        <p className="warehouse-location-code">
          Location:{' '}
          {locations.find((l) => l.id === value.locationId)?.location_code ?? value.locationId}
        </p>
      ) : null}
    </div>
  );
}
