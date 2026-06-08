import { Modal } from '../Modal';
import { PurchaseOrderForm } from '../warehouse/PurchaseOrderForm';

type Props = {
  canWrite: boolean;
  onClose: () => void;
  onReceivePo: (purchaseOrderId: string) => void;
};

export function InventoryPurchaseOrderModal({ canWrite, onClose, onReceivePo }: Props) {
  return (
    <Modal
      title="Purchase order"
      wide
      onClose={onClose}
      footer={
        <button type="button" className="commerce-inventory__filter-btn" onClick={onClose}>
          Close
        </button>
      }
    >
      <p className="commerce-inventory-add__hint">
        Create a purchase order, then receive stock via GRN. Open POs can jump straight into receive.
      </p>
      <PurchaseOrderForm canWrite={canWrite} onReceivePo={onReceivePo} />
    </Modal>
  );
}
