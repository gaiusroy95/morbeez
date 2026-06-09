import { Link } from 'react-router-dom';
import { paths, toPath } from '../../lib/routes';
import { Panel } from '../ui';
import { InventoryFulfillmentView } from '../inventory/InventoryFulfillmentView';

export function WarehouseStockPanel({ canWrite }: { canWrite: boolean }) {
  return (
    <Panel
      title="Fulfillment stock"
      description="Pickable quantities for warehouse — synced from Commerce inventory. Manage batches and inbound stock in Commerce."
      actions={
        <Link
          to={toPath(`${paths.commerce}?tab=inventory&invView=fulfillment`)}
          className="commerce-warehouse-link text-sm"
        >
          Open Commerce → Inventory
        </Link>
      }
    >
      <InventoryFulfillmentView canWrite={canWrite} />
    </Panel>
  );
}
