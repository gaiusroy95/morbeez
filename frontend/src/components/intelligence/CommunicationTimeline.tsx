export type TimelineEntry = {
  at: string;
  kind: string;
  summary: string;
};

type Props = {
  entries: TimelineEntry[];
  emptyLabel?: string;
};

export function CommunicationTimeline({ entries, emptyLabel = 'No communication events yet.' }: Props) {
  if (!entries.length) {
    return <p className="muted">{emptyLabel}</p>;
  }
  return (
    <ul className="visit-detail-list">
      {entries.map((t, i) => (
        <li key={`${t.at}-${i}`}>
          <strong>{t.kind}</strong> — {t.summary}
          <div className="muted">{new Date(t.at).toLocaleString()}</div>
        </li>
      ))}
    </ul>
  );
}
