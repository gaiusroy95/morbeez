import { Link, useSearchParams } from 'react-router-dom';
import { Btn } from '../../components/ui';
import { paths, toPath } from '../../lib/routes';
import '../../styles/visit-wizard.css';

export function VisitSuccessPage() {
  const [searchParams] = useSearchParams();

  const farmerName = String(searchParams.get('farmerName') ?? 'Farmer');
  const blockName = String(searchParams.get('blockName') ?? 'Block');
  const findingId = searchParams.get('findingId') ?? '';
  const recommendationAdded = searchParams.get('recommendationAdded');

  return (
    <div className="vw-success-page">
      <div className="vw-success-icon" aria-hidden>
        ✓
      </div>
      <h1 className="vw-success-title">Visit submitted successfully!</h1>
      <p className="vw-success-message">
        Thank you for visiting {farmerName} at {blockName}. Your data helps improve advisory for farmers.
      </p>
      {recommendationAdded ? (
        <p className="vw-hint" style={{ color: '#166534' }}>
          {recommendationAdded} recommendation(s) saved with this visit.
        </p>
      ) : null}
      {findingId ? (
        <p className="vw-hint" style={{ color: '#15803d', fontWeight: 600 }}>
          Visit ID: {findingId.slice(0, 8)}… · Synced
        </p>
      ) : null}

      <div className="vw-success-actions">
        <Link to={toPath(paths.agronomist)}>
          <Btn variant="primary" className="w-full">
            Back to agronomist
          </Btn>
        </Link>
        {findingId ? (
          <Link to={toPath(paths.agronomistVisitDetail.replace(':findingId', findingId))}>
            <Btn variant="secondary" className="w-full">
              Review finding
            </Btn>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
