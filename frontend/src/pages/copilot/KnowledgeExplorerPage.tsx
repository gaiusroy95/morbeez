import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { PageShell, Input, Btn, Field } from '../../components/ui';

export function KnowledgeExplorerPage() {
  const [q, setQ] = useState('');
  const [nodes, setNodes] = useState<Array<Record<string, unknown>>>([]);
  const [nodeType, setNodeType] = useState('issue');
  const [label, setLabel] = useState('');
  const [cropType, setCropType] = useState('ginger');
  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const r = await api<{ ok: boolean; nodes: typeof nodes }>(
      `/morbeez-staff/api/v1/os/knowledge-graph/nodes?${params}`
    );
    setNodes(r.nodes ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function createNode() {
    if (!label.trim()) return;
    setMsg('');
    try {
      await api('/morbeez-staff/api/v1/os/knowledge-graph/nodes', {
        method: 'POST',
        body: JSON.stringify({ nodeType, label: label.trim(), cropType }),
      });
      setLabel('');
      setMsg('Node created.');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Create failed');
    }
  }

  async function saveEdit() {
    if (!editId || !editLabel.trim()) return;
    await api(`/morbeez-staff/api/v1/os/knowledge-graph/nodes/${editId}`, {
      method: 'PATCH',
      body: JSON.stringify({ label: editLabel.trim() }),
    });
    setEditId(null);
    setEditLabel('');
    await load();
  }

  async function removeNode(id: string) {
    if (!confirm('Delete this node?')) return;
    await api(`/morbeez-staff/api/v1/os/knowledge-graph/nodes/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <PageShell title="Knowledge explorer">
      <div className="flex gap-2 mb-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search nodes" />
        <Btn onClick={() => void load()}>Search</Btn>
      </div>
      <div className="rounded border p-3 mb-4 max-w-lg">
        <h3 className="font-semibold mb-2">Create node</h3>
        <Field label="Type">
          <Input value={nodeType} onChange={(e) => setNodeType(e.target.value)} />
        </Field>
        <Field label="Label">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} />
        </Field>
        <Field label="Crop">
          <Input value={cropType} onChange={(e) => setCropType(e.target.value)} />
        </Field>
        <Btn className="mt-2" onClick={() => void createNode()}>
          Create
        </Btn>
        {msg ? <p className="muted mt-2">{msg}</p> : null}
      </div>
      {editId ? (
        <div className="rounded border p-3 mb-4 max-w-lg">
          <Field label="Edit label">
            <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
          </Field>
          <Btn className="mt-2" onClick={() => void saveEdit()}>
            Save
          </Btn>
          <Btn className="mt-2 ml-2" variant="secondary" onClick={() => setEditId(null)}>
            Cancel
          </Btn>
        </div>
      ) : null}
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th>Type</th>
            <th>Label</th>
            <th>Crop</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => (
            <tr key={String(n.id)}>
              <td>{String(n.node_type)}</td>
              <td>{String(n.label)}</td>
              <td>{String(n.crop_type ?? '—')}</td>
              <td className="flex gap-2">
                <button
                  type="button"
                  className="text-sm underline"
                  onClick={() => {
                    setEditId(String(n.id));
                    setEditLabel(String(n.label));
                  }}
                >
                  Edit
                </button>
                <button type="button" className="text-sm underline text-red-600" onClick={() => void removeNode(String(n.id))}>
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
