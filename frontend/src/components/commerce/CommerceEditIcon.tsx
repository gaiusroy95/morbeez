type Props = {
  label?: string;
  onClick: () => void;
};

export function CommerceEditIcon({ label = 'Edit', onClick }: Props) {
  return (
    <button type="button" className="commerce-promo__edit-btn" onClick={onClick} aria-label={label}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 20h4l10.5-10.5a2.12 2.12 0 0 0 0-3L14.5 2.5a2.12 2.12 0 0 0-3 0L4 10v4Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="m13.5 6.5 3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </button>
  );
}
