import { useState } from 'react';
import { DynamicMasterPicker } from '../DynamicMasterPicker';
import { useCrmMasters } from '../../lib/useCrmMasters';
import { Field, Modal, inputClass } from '../Modal';

type Props = {
  masterType: string;
  label: string;
  value: string;
  onChange: (id: string, name: string) => void;
  parentId?: string | null;
  allowAdd?: boolean;
  className?: string;
  apiBase?: string;
};

export function MasterSelect({
  masterType,
  label,
  value,
  onChange,
  parentId,
  allowAdd = true,
  className = inputClass,
  apiBase,
}: Props) {
  if (masterType === 'crop' || masterType === 'market' || masterType === 'pest' || masterType === 'disease') {
    return (
      <DynamicMasterPicker
        masterType={masterType as 'crop' | 'market' | 'pest' | 'disease'}
        label={label}
        value={value}
        allowManage={allowAdd}
        apiBase={apiBase}
        className={className}
        onChange={(id, item) => onChange(id, item?.name ?? '')}
      />
    );
  }

  return (
    <ClassicMasterSelect
      masterType={masterType}
      label={label}
      value={value}
      onChange={onChange}
      parentId={parentId}
      allowAdd={allowAdd}
      className={className}
      apiBase={apiBase}
    />
  );
}

function ClassicMasterSelect({
  masterType,
  label,
  value,
  onChange,
  parentId,
  allowAdd = true,
  className = inputClass,
  apiBase,
}: Props) {
  const { items, loading, createMaster } = useCrmMasters(masterType, parentId, { apiBase });
  const [adding, setAdding] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');

  async function handleAdd(name: string) {
    if (!name.trim()) return;
    setAdding(true);
    try {
      const item = await createMaster(name.trim());
      onChange(item.id, item.name);
    } finally {
      setAdding(false);
    }
  }

  return (
    <label className="block text-sm">
      <span className="text-slate-600">{label}</span>
      <div className="mt-1 flex gap-2">
        <select
          className={`${className} flex-1`}
          value={value}
          disabled={loading || adding}
          onChange={(e) => {
            const id = e.target.value;
            if (id === '__add__') {
              setShowAddModal(true);
              setNewName('');
              return;
            }
            const item = items.find((i) => i.id === id);
            onChange(id, item?.name ?? '');
          }}
        >
          <option value="">— Select —</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.name}
            </option>
          ))}
          {allowAdd ? <option value="__add__">+ Add new…</option> : null}
        </select>
      </div>
      {showAddModal ? (
        <Modal
          title={`Add new ${label.toLowerCase()}`}
          onClose={() => setShowAddModal(false)}
          onSave={() =>
            handleAdd(newName).then(() => {
              setShowAddModal(false);
              setNewName('');
            })
          }
          saveLabel="Add"
          saving={adding}
        >
          <Field label={label}>
            <input
              className={inputClass}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={`Enter ${label.toLowerCase()}`}
            />
          </Field>
        </Modal>
      ) : null}
    </label>
  );
}
