type Tab<T extends string> = { id: T; label: string };

type Props<T extends string> = {
  tabs: ReadonlyArray<Tab<T>>;
  active: T;
  onChange: (id: T) => void;
};

export function CommercePromoTabs<T extends string>({ tabs, active, onChange }: Props<T>) {
  return (
    <div className="commerce-promo__tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={active === t.id}
          className={`commerce-promo__tab ${active === t.id ? 'commerce-promo__tab--active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
