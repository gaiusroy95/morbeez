import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { agronomistClient } from '@morbeez/shared';
import { PageShell, Input, Btn } from '../../components/ui';
import { paths, toPath } from '../../lib/routes';

type FarmerRow = {
  farmerId: string;
  farmerName: string;
  district?: string | null;
  village?: string | null;
  cropType?: string | null;
};

export function AgronomistFarmersPage() {
  const [crop, setCrop] = useState('');
  const [village, setVillage] = useState('');
  const [rows, setRows] = useState<FarmerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function search() {
    setLoading(true);
    setError('');
    try {
      const farmers = await agronomistClient.listFarmers({
        limit: 50,
        crop: crop.trim() || undefined,
        village: village.trim() || undefined,
      });
      setRows(
        farmers.map((f) => ({
          farmerId: f.id,
          farmerName: f.name,
          district: f.district,
          village: f.village,
          cropType: f.primaryCrop,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void search();
  }, []);

  return (
    <PageShell title="Farmer search">
      <div className="flex gap-2 mb-4 flex-wrap">
        <Input value={crop} onChange={(e) => setCrop(e.target.value)} placeholder="Crop (e.g. ginger)" />
        <Input value={village} onChange={(e) => setVillage(e.target.value)} placeholder="Village" />
        <Btn onClick={() => void search()} disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </Btn>
      </div>
      {error ? <p className="text-red-600">{error}</p> : null}
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Farmer</th>
            <th>District</th>
            <th>Village</th>
            <th>Crop</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.farmerId}>
              <td>{r.farmerName}</td>
              <td>{r.district ?? '—'}</td>
              <td>{r.village ?? '—'}</td>
              <td>{r.cropType ?? '—'}</td>
              <td>
                <Link to={toPath(paths.farmer360.replace(':farmerId', r.farmerId))}>360</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && !loading ? <p className="muted">No farmers match filters.</p> : null}
    </PageShell>
  );
}
