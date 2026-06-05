export type BulkMarginReviewStatus = 'pending' | 'approved' | 'rejected' | null | undefined;

export function bulkReviewLabel(status: BulkMarginReviewStatus): string | null {
  if (status === 'pending') return 'Pending owner approval';
  if (status === 'approved') return 'Approved — ready to send';
  if (status === 'rejected') return 'Margin review rejected';
  return null;
}

export function canSendQuoteWithBulkReview(status: BulkMarginReviewStatus): boolean {
  return status !== 'pending' && status !== 'rejected';
}

export function bulkReviewHint(status: BulkMarginReviewStatus): string | null {
  if (status === 'pending') {
    return 'Waiting for manager approval on bulk margin. You cannot send this quote yet.';
  }
  if (status === 'approved') {
    return 'Bulk margin approved. You can send this quote to the farmer.';
  }
  if (status === 'rejected') {
    return 'Manager rejected this bulk margin. Edit pricing and resubmit for approval.';
  }
  return null;
}

type Props = {
  status: BulkMarginReviewStatus;
  className?: string;
};

export function BulkMarginReviewBadge({ status, className = '' }: Props) {
  const label = bulkReviewLabel(status);
  if (!label) return null;
  const tone =
    status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'pending';
  return (
    <span className={`quote-bulk-review-badge quote-bulk-review-badge--${tone} ${className}`.trim()}>
      {label}
    </span>
  );
}
