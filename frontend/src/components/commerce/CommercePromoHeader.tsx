type Props = {
  title: string;
  subtitle?: string;
  createLabel?: string;
  onCreate?: () => void;
  canWrite?: boolean;
};

export function CommercePromoHeader({ title, subtitle, createLabel, onCreate, canWrite }: Props) {
  return (
    <header className="commerce-promo__header">
      <div>
        <h2 className="commerce-promo__title">{title}</h2>
        {subtitle ? <p className="commerce-promo__subtitle">{subtitle}</p> : null}
      </div>
      {canWrite && createLabel && onCreate ? (
        <button type="button" className="commerce-promo__btn-primary" onClick={onCreate}>
          {createLabel}
        </button>
      ) : null}
    </header>
  );
}
