import { PageHeader, Panel, Btn } from '../../components/ui';

const reports = [
  { title: 'Monthly Sales Summary', description: 'Overview of partner sales performance for the current month.' },
  { title: 'KPI Performance Report', description: 'Detailed KPI metrics and scoring breakdown by partner.' },
  { title: 'Commission & Earnings Report', description: 'Commission calculations and earnings summary.' },
  { title: 'Farmer Acquisition Report', description: 'New farmer registrations attributed to each partner.' },
  { title: 'Payout Reconciliation', description: 'Payout history and reconciliation details.' },
  { title: 'Activity & Engagement Report', description: 'Partner activity levels and engagement metrics.' },
];

export function PartnerReportsPage({ canWrite }: { canWrite: boolean }) {
  return (
    <div>
      <PageHeader title="Partner Reports" />
      <Panel title="Available Reports">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reports.map(r => (
            <div key={r.title} className="border rounded p-4">
              <h3 className="font-semibold mb-2">{r.title}</h3>
              <p className="text-sm text-gray-600 mb-4">{r.description}</p>
              <Btn disabled>Generate</Btn>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
