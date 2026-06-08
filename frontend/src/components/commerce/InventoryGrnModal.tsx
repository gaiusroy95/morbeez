import { Modal } from '../Modal';
import { GrnReceiveForm } from '../warehouse/GrnReceiveForm';

type Props = {
  canWrite: boolean;
  purchaseOrderId?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function InventoryGrnModal({ canWrite, purchaseOrderId, onClose, onSaved }: Props) {
  return (
    <Modal
      title={purchaseOrderId ? 'Receive GRN (from PO)' : 'Receive GRN'}
      wide
      onClose={onClose}
      footer={
        <button type="button" className="commerce-inventory__filter-btn" onClick={onClose}>
          Close
        </button>
      }
    >
      <GrnReceiveForm
        canWrite={canWrite}
        purchaseOrderId={purchaseOrderId}
        onSuccess={() => {
          onSaved();
        }}
      />
    </Modal>
  );
}
