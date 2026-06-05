import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  buildWarehouseOrderUrl,
  type WarehouseDeepTab,
  warehouseTabForOmsStatus,
} from '../../lib/warehouse-links';

type Props = {
  orderId: string;
  omsStatus?: string | null;
  tab?: WarehouseDeepTab;
  label?: string;
  /** Inline text link in tables */
  compact?: boolean;
  className?: string;
};

export function WarehouseOrderLink({
  orderId,
  omsStatus,
  tab,
  label,
  compact = false,
  className = '',
}: Props) {
  const { can } = useAuth();
  if (!can('warehouse', 'read')) return null;

  const href = buildWarehouseOrderUrl(orderId, {
    tab: tab ?? warehouseTabForOmsStatus(omsStatus),
    omsStatus,
  });
  const text = label ?? (compact ? 'WMS' : 'Open in Warehouse');

  return (
    <Link
      to={href}
      className={`commerce-warehouse-link${compact ? ' commerce-warehouse-link--compact' : ''} ${className}`.trim()}
      onClick={(e) => e.stopPropagation()}
    >
      {text}
    </Link>
  );
}
