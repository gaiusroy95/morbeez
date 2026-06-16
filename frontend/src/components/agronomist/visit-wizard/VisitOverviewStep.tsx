import {
  formatDate,
  type BlockHealthLevel,
  type CropPerformanceLevel,
  type PortalSoilReport,
  type SoilMoistureLevel,
  type VisitFarmContext,
} from '@morbeez/shared';
import { Panel } from '../../ui';

type AssessmentOption<T extends string> = {
  value: T;
  label: string;
  tone: 'good' | 'average' | 'bad';
};

type Props = {
  farmerName: string;
  blockName: string;
  cropType: string;
  dap?: number | null;
  stage?: string | null;
  agronomistName?: string | null;
  soilTest?: PortalSoilReport | null;
  farmContext?: VisitFarmContext | null;
  blockHealth: BlockHealthLevel | null;
  cropPerformance: CropPerformanceLevel | null;
  soilMoisture: SoilMoistureLevel | null;
  onBlockHealth: (v: BlockHealthLevel) => void;
  onCropPerformance: (v: CropPerformanceLevel) => void;
  onSoilMoisture: (v: SoilMoistureLevel) => void;
};

const BLOCK_HEALTH: AssessmentOption<BlockHealthLevel>[] = [
  { value: 'good', label: 'Good', tone: 'good' },
  { value: 'average', label: 'Average', tone: 'average' },
  { value: 'need_assistance', label: 'Needs attention', tone: 'bad' },
];

const CROP_PERF: AssessmentOption<CropPerformanceLevel>[] = [
  { value: 'above_expectation', label: 'Above expected', tone: 'good' },
  { value: 'as_expected', label: 'As expected', tone: 'average' },
  { value: 'below_expectation', label: 'Below expected', tone: 'bad' },
];

const SOIL_MOISTURE: AssessmentOption<SoilMoistureLevel>[] = [
  { value: 'dry', label: 'Dry', tone: 'bad' },
  { value: 'optimal', label: 'Optimal', tone: 'good' },
  { value: 'wet', label: 'Wet', tone: 'average' },
  { value: 'waterlogged', label: 'Waterlogged', tone: 'bad' },
];

function OverviewRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="vw-row">
      <span className="vw-row-label">{label}</span>
      {href ? (
        <a className="vw-row-link" href={href} target="_blank" rel="noreferrer">
          {value}
        </a>
      ) : (
        <span className="vw-row-value">{value}</span>
      )}
    </div>
  );
}

function soilMetricRows(soilTest: PortalSoilReport) {
  if (soilTest.metrics?.length) return soilTest.metrics.slice(0, 6);
  return soilTest.highlights.map((h, index) => {
    const [label, ...rest] = h.split(':');
    return { label: label?.trim() || `Value ${index + 1}`, value: rest.join(':').trim() || h };
  });
}

function SoilTestRows({ soilTest }: { soilTest: PortalSoilReport | null | undefined }) {
  if (!soilTest) {
    return (
      <>
        <OverviewRow label="Soil test date" value="—" />
        <OverviewRow label="Soil test status" value="None on file" />
      </>
    );
  }

  const metrics = soilMetricRows(soilTest);

  return (
    <>
      <OverviewRow label="Soil test date" value={soilTest.dateLabel} />
      <OverviewRow label="Soil test status" value={soilTest.healthLabel} />
      {soilTest.dapLabel ? <OverviewRow label="DAP at test" value={soilTest.dapLabel} /> : null}
      {metrics.length ? (
        metrics.map((metric) => (
          <OverviewRow key={`${metric.label}-${metric.value}`} label={metric.label} value={metric.value} />
        ))
      ) : (
        <OverviewRow label="Lab values" value="Report on file — no values entered" />
      )}
      {soilTest.pdfUrl ? (
        <OverviewRow label="Soil report" value="View PDF" href={soilTest.pdfUrl} />
      ) : null}
    </>
  );
}

function AssessmentChips<T extends string>({
  options,
  value,
  onChange,
  columns,
}: {
  options: AssessmentOption<T>[];
  value: T | null | undefined;
  onChange: (v: T) => void;
  columns?: 2 | 3;
}) {
  const gridClass = columns === 2 ? 'vw-assess-grid--2' : '';
  return (
    <div className={`vw-chip-row ${gridClass}`}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            className={[
              'vw-assess-chip',
              `vw-assess-chip--${o.tone}`,
              selected ? 'vw-assess-chip--selected' : '',
            ].join(' ')}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function VisitOverviewStep({
  farmerName,
  blockName,
  cropType,
  dap,
  stage,
  agronomistName,
  soilTest,
  farmContext,
  blockHealth,
  cropPerformance,
  soilMoisture,
  onBlockHealth,
  onCropPerformance,
  onSoilMoisture,
}: Props) {
  const assessmentsComplete = Boolean(blockHealth && cropPerformance && soilMoisture);
  const ctx = farmContext ?? null;

  return (
    <div className="vw-stack">
      <Panel title="Farm details">
        <OverviewRow label="Farmer" value={farmerName} />
        <OverviewRow label="Phone" value={ctx?.farmerPhone ?? '—'} />
        <OverviewRow label="Village" value={ctx?.village ?? '—'} />
        <OverviewRow label="District" value={ctx?.district ?? '—'} />
        <OverviewRow label="Block" value={blockName} />
        <OverviewRow label="Crop" value={cropType.replace(/_/g, ' ')} />
        <OverviewRow label="Variety" value={ctx?.varietyName ?? '—'} />
        <OverviewRow
          label="Area"
          value={
            ctx?.acreage != null ? `${ctx.acreage} ac` : ctx?.area?.trim() ? ctx.area : '—'
          }
        />
        <OverviewRow label="Irrigation" value={ctx?.irrigationType?.replace(/_/g, ' ') ?? '—'} />
        <OverviewRow label="Planting date" value={ctx?.plantingDate ?? '—'} />
        <OverviewRow label="Expected harvest" value={ctx?.expectedHarvestDate ?? '—'} />
      </Panel>

      <Panel title="Field assessment">
        <OverviewRow label="Visit date" value={formatDate(new Date().toISOString())} />
        <OverviewRow label="DAP" value={dap != null ? String(dap) : '—'} />
        <OverviewRow label="Stage" value={stage ?? '—'} />
        <OverviewRow label="Agronomist" value={agronomistName ?? '—'} />
        <SoilTestRows soilTest={soilTest} />
      </Panel>

      {ctx?.recentVisits?.length || ctx?.recentRecommendations?.length || ctx?.recentApplications?.length ? (
        <Panel title="Previous history">
          {ctx.recentVisits?.length ? (
            <>
              <p className="vw-history-heading">Recent visits</p>
              {ctx.recentVisits.map((v) => (
                <p key={v.id} className="vw-history-item">
                  {v.dateLabel} · {v.summary}
                </p>
              ))}
            </>
          ) : null}
          {ctx.recentRecommendations?.length ? (
            <>
              <p className="vw-history-heading">Recent recommendations</p>
              {ctx.recentRecommendations.map((r) => (
                <p key={r.id} className="vw-history-item">
                  {r.dateLabel} · {r.title} ({r.status})
                </p>
              ))}
            </>
          ) : null}
          {ctx.recentApplications?.length ? (
            <>
              <p className="vw-history-heading">Recent applications</p>
              {ctx.recentApplications.map((a) => (
                <p key={a.id} className="vw-history-item">
                  {a.dateLabel} · {a.label}
                </p>
              ))}
            </>
          ) : null}
        </Panel>
      ) : null}

      {!assessmentsComplete ? (
        <p className="vw-hint">
          Select block health, crop performance, and soil moisture. You can continue now and finish before submit.
        </p>
      ) : null}

      <Panel title="Block health">
        <AssessmentChips options={BLOCK_HEALTH} value={blockHealth} onChange={onBlockHealth} />
      </Panel>

      <Panel title="Crop performance">
        <AssessmentChips options={CROP_PERF} value={cropPerformance} onChange={onCropPerformance} />
      </Panel>

      <Panel title="Soil moisture">
        <AssessmentChips options={SOIL_MOISTURE} value={soilMoisture} onChange={onSoilMoisture} columns={2} />
      </Panel>
    </div>
  );
}
