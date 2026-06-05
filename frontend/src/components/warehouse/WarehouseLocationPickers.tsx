import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { WMS_API } from './warehouse-api';

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
};

export const WMS_LOCATION_API: WarehouseLocationApi = {
  warehousesUrl: `${WMS_API}/warehouses`,
  locationsUrl: (id) => `${WMS_API}/warehouses/${id}/locations`,
};

export const PRODUCTS_LOCATION_API: WarehouseLocationApi = {
  warehousesUrl: '/morbeez-staff/api/v1/products/warehouse-options/warehouses',
  locationsUrl: (id) => `/morbeez-staff/api/v1/products/warehouse-options/${id}/locations`,
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
};

export function WarehouseLocationPickers({
  value,
  onChange,
  api: apiConfig = WMS_LOCATION_API,
  disabled,
  className = 'warehouse-location-grid',
  showHint = true,
}: Props) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingWh, setLoadingWh] = useState(true);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoadingWh(true);
    api<{ ok: boolean; warehouses: Warehouse[] }>(apiConfig.warehousesUrl)
      .then((d) => {
        if (!cancelled) setWarehouses(d.warehouses ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load warehouses');
      })
      .finally(() => {
        if (!cancelled) setLoadingWh(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiConfig.warehousesUrl]);

  useEffect(() => {
    if (!value.warehouseId) {
      setLocations([]);
      return;
    }
    let cancelled = false;
    setLoadingLoc(true);
    setError('');
    api<{ ok: boolean; locations: Location[] }>(apiConfig.locationsUrl(value.warehouseId))
      .then((d) => {
        if (!cancelled) setLocations(d.locations ?? []);
      })
      .catch((e) => {
        if (!cancelled) {
          setLocations([]);
          setError(e instanceof Error ? e.message : 'Could not load rack locations');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingLoc(false);
      });
    return () => {
      cancelled = true;
    };
  }, [value.warehouseId, apiConfig]);

  const racks = useMemo(() => {
    const set = new Set<string>();
    for (const loc of locations) {
      if (loc.rack?.trim()) set.add(loc.rack.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [locations]);

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

  function onWarehouseChange(warehouseId: string) {
    const wh = warehouses.find((w) => w.id === warehouseId);
    onChange({
      warehouseId,
      warehouseName: wh?.name ?? '',
      rackId: '',
      rackRow: '',
      locationId: '',
    });
  }

  function onRackChange(rackId: string) {
    onChange({ ...value, rackId, rackRow: '', locationId: '' });
  }

  function onRowChange(rackRow: string) {
    const match = rows.find((r) => r.label === rackRow);
    onChange({ ...value, rackRow, locationId: match?.loc.id ?? '' });
  }

  return (
    <div className={className}>
      {showHint ? (
        <p className="warehouse-location-hint">
          Select warehouse, then rack and row — loaded live from your WMS layout.
        </p>
      ) : null}
      {error ? <p className="warehouse-location-error">{error}</p> : null}
      <label className="warehouse-location-field">
        <span>Warehouse</span>
        <select
          value={value.warehouseId}
          disabled={disabled || loadingWh}
          onChange={(e) => onWarehouseChange(e.target.value)}
        >
          <option value="">{loadingWh ? 'Loading…' : 'Select warehouse'}</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
              {w.code ? ` (${w.code})` : ''}
            </option>
          ))}
        </select>
      </label>
      <label className="warehouse-location-field">
        <span>Rack ID</span>
        <select
          value={value.rackId}
          disabled={disabled || !value.warehouseId || loadingLoc}
          onChange={(e) => onRackChange(e.target.value)}
        >
          <option value="">
            {!value.warehouseId
              ? 'Select warehouse first'
              : loadingLoc
                ? 'Loading…'
                : racks.length
                  ? 'Select rack'
                  : 'No racks configured'}
          </option>
          {racks.map((rack) => (
            <option key={rack} value={rack}>
              {rack}
            </option>
          ))}
        </select>
      </label>
      <label className="warehouse-location-field">
        <span>Rack row</span>
        <select
          value={value.rackRow}
          disabled={disabled || !value.rackId || loadingLoc}
          onChange={(e) => onRowChange(e.target.value)}
        >
          <option value="">
            {!value.rackId
              ? 'Select rack first'
              : rows.length
                ? 'Select row'
                : 'No rows for this rack'}
          </option>
          {rows.map(({ label }) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {value.locationId ? (
        <p className="warehouse-location-code">
          Location:{' '}
          {locations.find((l) => l.id === value.locationId)?.location_code ?? value.locationId}
        </p>
      ) : null}
    </div>
  );
}
