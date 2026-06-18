import type { VisitIssueDraft } from './types';

type Props = {
  issues: VisitIssueDraft[];
  onChange: (issues: VisitIssueDraft[]) => void;
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const base64 = result.includes(',') ? result.split(',')[1]! : result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function VisitAdditionalPhotosStep({ issues, onChange }: Props) {
  const requests = issues.flatMap((issue) =>
    (issue.photoRequests ?? []).map((req) => ({ issue, req }))
  );

  if (!requests.length) {
    return <p className="vw-hint">No additional photos requested. Continue to final diagnosis.</p>;
  }

  async function attach(issueLocalId: string, photoType: string, file: File) {
    const dataBase64 = await readFileAsBase64(file);
    onChange(
      issues.map((issue) =>
        issue.localId === issueLocalId
          ? {
              ...issue,
              photos: [
                ...(issue.photos ?? []),
                {
                  filename: file.name,
                  mimeType: file.type || 'image/jpeg',
                  dataBase64,
                  photoType,
                },
              ],
            }
          : issue
      )
    );
  }

  return (
    <div className="vw-stack">
      <p className="vw-hint">Upload photos requested during follow-up Q&A.</p>
      {requests.map(({ issue, req }) => {
        const attached = (issue.photos ?? []).filter((p) => p.photoType === req.photoType).length;
        const inputId = `photo-${issue.localId}-${req.photoType}`;
        return (
          <div key={inputId} className="vw-issue-card">
            <div className="vw-issue-title">{req.label}</div>
            <div className="vw-issue-obs">{req.reason ?? `For issue: ${issue.issueName}`}</div>
            {attached > 0 ? <div className="vw-hint">{attached} photo(s) attached</div> : null}
            <label className="vw-btn vw-btn-secondary" htmlFor={inputId}>
              Upload photo
            </label>
            <input
              id={inputId}
              type="file"
              accept="image/*"
              capture="environment"
              className="vw-sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void attach(issue.localId, req.photoType, file);
                e.target.value = '';
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
