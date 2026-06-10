import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useSuperAdminConfirm } from '../../hooks/useSuperAdminConfirm';
import {
  Alert,
  Btn,
  DataTable,
  EmptyState,
  HubTabs,
  Loading,
  Panel,
  StaticSelect,
  TableWrap,
  TBody,
  THead,
  Td,
  Th,
  inputClass,
} from '../ui';
import { WMS_API } from './warehouse-api';

type AdminTab = 'categories' | 'boxes' | 'rules' | 'settings';

type PackagingCategory = {
  id: string;
  name: string;
  description: string | null;
  priority: number;
  active: boolean;
};

type ShippingBox = {
  id: string;
  code: string;
  name: string;
  lengthCm: number;
  breadthCm: number;
  heightCm: number;
  maxWeightKg: number;
  packagingType: string | null;
  active: boolean;
};

type PackageRule = {
  id: string;
  packagingCategoryId: string;
  packagingCategoryName: string;
  minWeightKg: number;
  maxWeightKg: number;
  preferredBoxId: string;
  preferredBoxCode: string;
  preferredBoxName: string;
  priority: number;
  active: boolean;
};

type PackagingSetting = {
  key: string;
  value: unknown;
  description: string | null;
};

const ADMIN_TABS: Array<{ id: AdminTab; label: string }> = [
  { id: 'categories', label: 'Categories' },
  { id: 'boxes', label: 'Box types' },
  { id: 'rules', label: 'Package rules' },
  { id: 'settings', label: 'Weight settings' },
];

export function WarehousePackagingPanel({ canWrite }: { canWrite: boolean }) {
  const [tab, setTab] = useState<AdminTab>('categories');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [categories, setCategories] = useState<PackagingCategory[]>([]);
  const [boxes, setBoxes] = useState<ShippingBox[]>([]);
  const [rules, setRules] = useState<PackageRule[]>([]);
  const [settings, setSettings] = useState<PackagingSetting[]>([]);
  const { requestConfirm, confirmModal } = useSuperAdminConfirm();

  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catPriority, setCatPriority] = useState('100');

  const [boxCode, setBoxCode] = useState('');
  const [boxName, setBoxName] = useState('');
  const [boxL, setBoxL] = useState('');
  const [boxW, setBoxW] = useState('');
  const [boxH, setBoxH] = useState('');
  const [boxMaxW, setBoxMaxW] = useState('');
  const [boxType, setBoxType] = useState('standard');

  const [ruleCategoryId, setRuleCategoryId] = useState('');
  const [ruleMin, setRuleMin] = useState('0');
  const [ruleMax, setRuleMax] = useState('');
  const [ruleBoxId, setRuleBoxId] = useState('');
  const [rulePriority, setRulePriority] = useState('100');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [c, b, r, s] = await Promise.all([
        api<{ ok: boolean; categories: PackagingCategory[] }>(`${WMS_API}/packaging/categories`),
        api<{ ok: boolean; boxes: ShippingBox[] }>(`${WMS_API}/shipping-boxes`),
        api<{ ok: boolean; rules: PackageRule[] }>(`${WMS_API}/packaging/rules`),
        api<{ ok: boolean; settings: PackagingSetting[] }>(`${WMS_API}/packaging/settings`),
      ]);
      setCategories(c.categories ?? []);
      setBoxes(b.boxes ?? []);
      setRules(r.rules ?? []);
      setSettings(s.settings ?? []);
      if (!ruleCategoryId && c.categories?.[0]) setRuleCategoryId(c.categories[0].id);
      if (!ruleBoxId && b.boxes?.[0]) setRuleBoxId(b.boxes[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load packaging data');
    } finally {
      setLoading(false);
    }
  }, [ruleBoxId, ruleCategoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCategory() {
    if (!catName.trim()) return;
    await api(`${WMS_API}/packaging/categories`, {
      method: 'POST',
      body: JSON.stringify({
        name: catName.trim(),
        description: catDesc.trim() || undefined,
        priority: Number(catPriority) || 100,
      }),
    });
    setCatName('');
    setCatDesc('');
    setSuccess('Category created');
    await load();
  }

  function toggleCategory(row: PackagingCategory) {
    if (!canWrite) return;
    requestConfirm(row.active ? 'hide' : 'unhide', row.name, async (confirmPassword) => {
      await api(`${WMS_API}/packaging/categories/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !row.active, confirmPassword }),
      });
      setSuccess(row.active ? 'Category deactivated' : 'Category activated');
      await load();
    });
  }

  async function createBox() {
    if (!boxCode.trim() || !boxName.trim() || !boxL || !boxW || !boxH || !boxMaxW) return;
    await api(`${WMS_API}/shipping-boxes`, {
      method: 'POST',
      body: JSON.stringify({
        code: boxCode.trim(),
        name: boxName.trim(),
        lengthCm: Number(boxL),
        breadthCm: Number(boxW),
        heightCm: Number(boxH),
        maxWeightKg: Number(boxMaxW),
        packagingType: boxType,
        liquidFriendly: boxType === 'liquid_safe',
      }),
    });
    setBoxCode('');
    setBoxName('');
    setSuccess('Box type created');
    await load();
  }

  function toggleBox(row: ShippingBox) {
    if (!canWrite) return;
    requestConfirm(row.active ? 'hide' : 'unhide', row.code, async (confirmPassword) => {
      await api(`${WMS_API}/shipping-boxes/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !row.active, confirmPassword }),
      });
      setSuccess(row.active ? 'Box deactivated' : 'Box activated');
      await load();
    });
  }

  async function createRule() {
    if (!ruleCategoryId || !ruleBoxId || !ruleMax) return;
    await api(`${WMS_API}/packaging/rules`, {
      method: 'POST',
      body: JSON.stringify({
        packagingCategoryId: ruleCategoryId,
        minWeightKg: Number(ruleMin) || 0,
        maxWeightKg: Number(ruleMax),
        preferredBoxId: ruleBoxId,
        priority: Number(rulePriority) || 100,
      }),
    });
    setRuleMax('');
    setSuccess('Package rule created');
    await load();
  }

  function toggleRule(row: PackageRule) {
    if (!canWrite) return;
    const label = `${row.packagingCategoryName} ${row.minWeightKg}–${row.maxWeightKg}kg`;
    requestConfirm(row.active ? 'hide' : 'unhide', label, async (confirmPassword) => {
      await api(`${WMS_API}/packaging/rules/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !row.active, confirmPassword }),
      });
      setSuccess(row.active ? 'Rule deactivated' : 'Rule activated');
      await load();
    });
  }

  function saveSetting(key: string, raw: string) {
    if (!canWrite) return;
    requestConfirm('edit', key, async (confirmPassword) => {
      const num = Number(raw);
      const value = Number.isFinite(num) ? num : raw;
      await api(`${WMS_API}/packaging/settings/${encodeURIComponent(key)}`, {
        method: 'PATCH',
        body: JSON.stringify({ value, confirmPassword }),
      });
      setSuccess(`Setting ${key} updated`);
      await load();
    });
  }

  if (loading) return <Loading label="Loading packaging admin…" />;

  return (
    <div className="warehouse-packaging-admin">
      {confirmModal}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {success ? <Alert tone="success">{success}</Alert> : null}
      <p className="muted warehouse-packaging-intro">
        Dynamic packaging intelligence — categories, box types, and weight rules drive the package
        engine. No code changes needed when operations evolve.
      </p>
      <HubTabs tabs={ADMIN_TABS} active={tab} onChange={setTab} />

      {tab === 'categories' ? (
        <Panel title="Packaging categories">
          {canWrite ? (
            <div className="warehouse-packaging-form">
              <input className={inputClass} placeholder="Category name" value={catName} onChange={(e) => setCatName(e.target.value)} />
              <input className={inputClass} placeholder="Description" value={catDesc} onChange={(e) => setCatDesc(e.target.value)} />
              <input className={inputClass} placeholder="Priority" value={catPriority} onChange={(e) => setCatPriority(e.target.value)} inputMode="numeric" />
              <Btn size="sm" onClick={() => void createCategory()}>Add category</Btn>
            </div>
          ) : null}
          {categories.length === 0 ? <EmptyState>No categories configured.</EmptyState> : null}
          {categories.length > 0 ? (
            <TableWrap>
              <DataTable>
                <THead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Priority</Th>
                    <Th>Description</Th>
                    <Th>Active</Th>
                  </tr>
                </THead>
                <TBody>
                  {categories.map((r) => (
                    <tr key={r.id}>
                      <Td>{r.name}</Td>
                      <Td>{r.priority}</Td>
                      <Td>{r.description ?? '—'}</Td>
                      <Td>
                        {canWrite ? (
                          <Btn size="sm" variant="ghost" onClick={() => toggleCategory(r)}>
                            {r.active ? 'Yes' : 'No'}
                          </Btn>
                        ) : (
                          r.active ? 'Yes' : 'No'
                        )}
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </DataTable>
            </TableWrap>
          ) : null}
        </Panel>
      ) : null}

      {tab === 'boxes' ? (
        <Panel title="Box types">
          {canWrite ? (
            <div className="warehouse-packaging-form warehouse-packaging-form--grid">
              <input className={inputClass} placeholder="Code (S1)" value={boxCode} onChange={(e) => setBoxCode(e.target.value)} />
              <input className={inputClass} placeholder="Box name" value={boxName} onChange={(e) => setBoxName(e.target.value)} />
              <input className={inputClass} placeholder="L cm" value={boxL} onChange={(e) => setBoxL(e.target.value)} inputMode="decimal" />
              <input className={inputClass} placeholder="W cm" value={boxW} onChange={(e) => setBoxW(e.target.value)} inputMode="decimal" />
              <input className={inputClass} placeholder="H cm" value={boxH} onChange={(e) => setBoxH(e.target.value)} inputMode="decimal" />
              <input className={inputClass} placeholder="Max kg" value={boxMaxW} onChange={(e) => setBoxMaxW(e.target.value)} inputMode="decimal" />
              <StaticSelect
                value={boxType}
                onChange={setBoxType}
                options={[
                  { value: 'standard', label: 'Standard' },
                  { value: 'liquid_safe', label: 'Liquid safe' },
                  { value: 'fragile', label: 'Fragile' },
                ]}
              />
              <Btn size="sm" onClick={() => void createBox()}>Add box</Btn>
            </div>
          ) : null}
          {boxes.length === 0 ? <EmptyState>No box types configured.</EmptyState> : null}
          {boxes.length > 0 ? (
            <TableWrap>
              <DataTable>
                <THead>
                  <tr>
                    <Th>Code</Th>
                    <Th>Name</Th>
                    <Th>L×W×H (cm)</Th>
                    <Th>Max kg</Th>
                    <Th>Type</Th>
                    <Th>Active</Th>
                  </tr>
                </THead>
                <TBody>
                  {boxes.map((r) => (
                    <tr key={r.id}>
                      <Td className="mono">{r.code}</Td>
                      <Td>{r.name}</Td>
                      <Td>{r.lengthCm}×{r.breadthCm}×{r.heightCm}</Td>
                      <Td>{r.maxWeightKg}</Td>
                      <Td>{r.packagingType ?? '—'}</Td>
                      <Td>
                        {canWrite ? (
                          <Btn size="sm" variant="ghost" onClick={() => toggleBox(r)}>
                            {r.active ? 'Yes' : 'No'}
                          </Btn>
                        ) : (
                          r.active ? 'Yes' : 'No'
                        )}
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </DataTable>
            </TableWrap>
          ) : null}
        </Panel>
      ) : null}

      {tab === 'rules' ? (
        <Panel title="Package rules">
          {canWrite ? (
            <div className="warehouse-packaging-form warehouse-packaging-form--grid">
              <StaticSelect
                value={ruleCategoryId}
                onChange={setRuleCategoryId}
                options={categories.filter((c) => c.active).map((c) => ({ value: c.id, label: c.name }))}
              />
              <input className={inputClass} placeholder="Min kg" value={ruleMin} onChange={(e) => setRuleMin(e.target.value)} inputMode="decimal" />
              <input className={inputClass} placeholder="Max kg" value={ruleMax} onChange={(e) => setRuleMax(e.target.value)} inputMode="decimal" />
              <StaticSelect
                value={ruleBoxId}
                onChange={setRuleBoxId}
                options={boxes.filter((b) => b.active).map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }))}
              />
              <input className={inputClass} placeholder="Priority" value={rulePriority} onChange={(e) => setRulePriority(e.target.value)} inputMode="numeric" />
              <Btn size="sm" onClick={() => void createRule()}>Add rule</Btn>
            </div>
          ) : null}
          {rules.length === 0 ? <EmptyState>No package rules configured.</EmptyState> : null}
          {rules.length > 0 ? (
            <TableWrap>
              <DataTable>
                <THead>
                  <tr>
                    <Th>Category</Th>
                    <Th>Weight (kg)</Th>
                    <Th>Suggested box</Th>
                    <Th>Priority</Th>
                    <Th>Active</Th>
                  </tr>
                </THead>
                <TBody>
                  {rules.map((r) => (
                    <tr key={r.id}>
                      <Td>{r.packagingCategoryName}</Td>
                      <Td>{r.minWeightKg} – {r.maxWeightKg}</Td>
                      <Td>{r.preferredBoxCode} ({r.preferredBoxName})</Td>
                      <Td>{r.priority}</Td>
                      <Td>
                        {canWrite ? (
                          <Btn size="sm" variant="ghost" onClick={() => toggleRule(r)}>
                            {r.active ? 'Yes' : 'No'}
                          </Btn>
                        ) : (
                          r.active ? 'Yes' : 'No'
                        )}
                      </Td>
                    </tr>
                  ))}
                </TBody>
              </DataTable>
            </TableWrap>
          ) : null}
        </Panel>
      ) : null}

      {tab === 'settings' ? (
        <Panel title="Weight & volumetric settings">
          {settings.length === 0 ? <EmptyState>No packaging settings.</EmptyState> : null}
          {settings.length > 0 ? (
            <TableWrap>
              <DataTable>
                <THead>
                  <tr>
                    <Th>Setting</Th>
                    <Th>Description</Th>
                    <Th>Value</Th>
                  </tr>
                </THead>
                <TBody>
                  {settings.map((r) => {
                    const val =
                      typeof r.value === 'number' || typeof r.value === 'string'
                        ? String(r.value)
                        : JSON.stringify(r.value);
                    return (
                      <tr key={r.key}>
                        <Td className="mono">{r.key}</Td>
                        <Td>{r.description ?? '—'}</Td>
                        <Td>
                          {canWrite ? (
                            <input
                              className={inputClass}
                              defaultValue={val}
                              onBlur={(e) => {
                                if (e.target.value !== val) saveSetting(r.key, e.target.value);
                              }}
                            />
                          ) : (
                            val
                          )}
                        </Td>
                      </tr>
                    );
                  })}
                </TBody>
              </DataTable>
            </TableWrap>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
