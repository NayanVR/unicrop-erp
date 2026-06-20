import {
    destroy as policyDestroy,
    store as policyStore,
    update as policyUpdate,
} from '@/routes/policies';
import { router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ModalPortal } from '@/components/modal-portal';

type Policy = {
    id: number;
    name: string;
    slug: string;
    permissions: string[];
    is_system: boolean;
};

type PageProps = {
    policies: Policy[];
    permissionKeys: string[];
    flash?: { success?: string; error?: string };
};

const defaultForm = { name: '', permissions: [] as string[] };

export default function PoliciesIndex() {
    const { policies, permissionKeys, flash } = usePage<PageProps>().props;
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Policy | null>(null);

    const { data, setData, post, patch, processing, reset, errors } = useForm(defaultForm);

    const openAdd = () => {
        reset();
        setEditing(null);
        setShowModal(true);
    };

    const openEdit = (p: Policy) => {
        setEditing(p);
        setData({ name: p.name, permissions: [...p.permissions] });
        setShowModal(true);
    };

    const togglePermission = (key: string) => {
        setData('permissions', data.permissions.includes(key)
            ? data.permissions.filter((p) => p !== key)
            : [...data.permissions, key]);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editing) {
            patch(policyUpdate(editing.id).url, { onSuccess: () => { setShowModal(false); reset(); } });
        } else {
            post(policyStore().url, { onSuccess: () => { setShowModal(false); reset(); } });
        }
    };

    const deletePolicy = (p: Policy) => {
        if (!confirm(`Delete policy "${p.name}"?`)) return;
        router.delete(policyDestroy(p.id).url);
    };

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Policies</h1>
                <button className="btn-primary" onClick={openAdd}>+ Add Policy</button>
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error && <div className="alert-error">{flash.error}</div>}

            <div className="card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Permissions</th>
                            <th>Type</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {policies.length === 0 && (
                            <tr><td colSpan={4} className="empty-row">No policies found.</td></tr>
                        )}
                        {policies.map((p) => (
                            <tr key={p.id}>
                                <td className="font-medium">{p.name}</td>
                                <td>{p.permissions.length} permission{p.permissions.length === 1 ? '' : 's'}</td>
                                <td>
                                    <span className={`badge ${p.is_system ? 'badge-gray' : 'badge-teal'}`}>
                                        {p.is_system ? 'System' : 'Custom'}
                                    </span>
                                </td>
                                <td className="action-cell">
                                    {!p.is_system && (
                                        <>
                                            <button className="btn-icon" onClick={() => openEdit(p)} title="Edit">✏️</button>
                                            <button className="btn-icon btn-danger-icon" onClick={() => deletePolicy(p)} title="Delete">🗑️</button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <ModalPortal>
                <div className="modal-overlay open" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editing ? 'Edit Policy' : 'Add Policy'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={submit} className="modal-form">
                            <div className="form-group">
                                <label>Name *</label>
                                <input value={data.name} onChange={(e) => setData('name', e.target.value)} required />
                                {errors.name && <span className="field-error">{errors.name}</span>}
                            </div>
                            <div className="form-group">
                                <label>Permissions</label>
                                <div className="checkbox-grid">
                                    {permissionKeys.map((key) => (
                                        <label key={key} className="checkbox-item">
                                            <input
                                                type="checkbox"
                                                checked={data.permissions.includes(key)}
                                                onChange={() => togglePermission(key)}
                                            />
                                            {key}
                                        </label>
                                    ))}
                                </div>
                                {errors.permissions && <span className="field-error">{errors.permissions}</span>}
                            </div>
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={processing}>
                                    {processing ? 'Saving…' : editing ? 'Update' : 'Add Policy'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
                </ModalPortal>
            )}
        </>
    );
}
