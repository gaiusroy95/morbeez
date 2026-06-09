import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { WarehouseFulfillmentPanel } from './WarehouseFulfillmentPanel';
import { WarehouseEmployeeBatchPanel } from './WarehouseEmployeeBatchPanel';

export type FulfillmentView = 'pick' | 'assign';

const VIEWS: Array<{ id: FulfillmentView; label: string }> = [
  { id: 'pick', label: 'Pick & pack' },
  { id: 'assign', label: 'Assign & print labels' },
];

export function WarehouseFulfillmentHub({
  canWrite,
  focusOrderId,
}: {
  canWrite: boolean;
  focusOrderId?: string | null;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: FulfillmentView =
    searchParams.get('fulfillmentView') === 'assign' ? 'assign' : 'pick';

  const setView = useCallback(
    (next: FulfillmentView) => {
      const params = new URLSearchParams(searchParams);
      if (next === 'pick') params.delete('fulfillmentView');
      else params.set('fulfillmentView', next);
      setSearchParams(params, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  return (
    <div className="wh-fulfillment-hub">
      <nav className="wh-fulfillment-subtabs" aria-label="Fulfillment views">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            className={`wh-fulfillment-subtab${view === v.id ? ' wh-fulfillment-subtab--active' : ''}`}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </nav>
      {view === 'assign' ? (
        <WarehouseEmployeeBatchPanel canWrite={canWrite} />
      ) : (
        <WarehouseFulfillmentPanel canWrite={canWrite} focusOrderId={focusOrderId} />
      )}
    </div>
  );
}
