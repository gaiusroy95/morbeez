import { Link } from 'react-router-dom';
import { paths, toPath } from '../../lib/routes';
import { Panel } from '../ui';
import { GrnReceiveForm } from './GrnReceiveForm';

export function WarehouseInboundPanel({ canWrite }: { canWrite: boolean }) {
  return (
    <div className="warehouse-inbound">
      <p className="commerce-hub-warehouse-bridge muted">
        Purchase orders and GRN are also available on{' '}
        <Link to={toPath(`${paths.commerce}?tab=inventory`)} className="commerce-warehouse-link">
          Commerce → Inventory
        </Link>
        .
      </p>
      <Panel
        title="Goods received (GRN)"
        description="Purchase → landed cost → weighted average → safe price recalculation."
      >
        <GrnReceiveForm canWrite={canWrite} />
      </Panel>
    </div>
  );
}
