import { useFlashCountdown } from '../../hooks/useFlashCountdown';

type Props = {
  status: string;
  endsAt: string;
};

export function FlashSaleStatusCell({ status, endsAt }: Props) {
  const isLive = status === 'live';
  const countdown = useFlashCountdown(endsAt, isLive);

  const pillClass =
    status === 'live'
      ? 'commerce-promo__status-pill commerce-promo__status-pill--live'
      : status === 'upcoming'
        ? 'commerce-promo__status-pill commerce-promo__status-pill--upcoming'
        : 'commerce-promo__status-pill commerce-promo__status-pill--expired';

  const label =
    status === 'live' ? 'Live' : status === 'upcoming' ? 'Upcoming' : 'Completed';

  return (
    <div className="commerce-promo__flash-status">
      <span className={pillClass}>{label}</span>
      {isLive && countdown ? (
        <span className="commerce-promo__countdown">
          <span className="commerce-promo__countdown-icon" aria-hidden>
            ⏱
          </span>
          {countdown}
        </span>
      ) : null}
    </div>
  );
}
