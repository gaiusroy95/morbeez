type Props = {
  label: string;
  values: number[];
  unit?: string;
};

export function MiniTrendChart({ label, values, unit = '' }: Props) {
  if (!values.length) return <p className="muted text-sm">{label}: no data</p>;
  const max = Math.max(...values, 1);
  return (
    <div className="mb-4">
      <p className="text-sm font-semibold mb-1">{label}</p>
      <div className="flex items-end gap-1 h-16">
        {values.map((v, i) => (
          <div
            key={i}
            className="bg-emerald-600 rounded-t min-w-[12px] flex-1"
            style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
            title={`${v}${unit}`}
          />
        ))}
      </div>
      <p className="text-xs muted mt-1">
        Latest: {values[values.length - 1]}
        {unit}
      </p>
    </div>
  );
}
