import {
    destroy as companyDestroy,
    store as companyStore,
    update as companyUpdate,
} from '@/routes/companies';
import { router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { ModalPortal } from '@/components/modal-portal';

type Company = {
    id: number;
    name: string;
    slug: string;
    is_active: boolean;
    users_count: number;
};

type PageProps = {
    companies: Company[];
    flash?: { success?: string; error?: string };
};

const defaultForm = { name: '', slug: '', is_active: true };

export default function CompaniesIndex() {
    const { companies, flash } = usePage<PageProps>().props;
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Company | null>(null);

    const { data, setData, post, patch, processing, reset, errors } = useForm(defaultForm);

    const openAdd = () => {
        reset();
        setEditing(null);
        setShowModal(true);
    };

    const openEdit = (c: Company) => {
        setEditing(c);
        setData({ name: c.name, slug: c.slug, is_active: c.is_active });
        setShowModal(true);
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editing) {
            patch(companyUpdate(editing.id).url, { onSuccess: () => { setShowModal(false); reset(); } });
        } else {
            post(companyStore().url, { onSuccess: () => { setShowModal(false); reset(); } });
        }
    };

    const deleteCompany = (c: Company) => {
        if (!confirm(`Delete company "${c.name}"? This cannot be undone.`)) return;
        router.delete(companyDestroy(c.id).url);
    };

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Companies</h1>
                <button className="btn-primary" onClick={openAdd}>+ Add Company</button>
            </div>

            {flash?.success && <div className="alert-success">{flash.success}</div>}
            {flash?.error && <div className="alert-error">{flash.error}</div>}

            <div className="card">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Slug</th>
                            <th>Users</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {companies.length === 0 && (
                            <tr><td colSpan={5} className="empty-row">No companies found.</td></tr>
                        )}
                        {companies.map((c) => (
                            <tr key={c.id}>
                                <td className="font-medium">{c.name}</td>
                                <td><code>{c.slug}</code></td>
                                <td>{c.users_count}</td>
                                <td>
                                    <span className={`badge ${c.is_active ? 'badge-teal' : 'badge-gray'}`}>
                                        {c.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="action-cell">
                                    <button className="btn-icon" onClick={() => openEdit(c)} title="Edit">✏️</button>
                                    <button className="btn-icon btn-danger-icon" onClick={() => deleteCompany(c)} title="Delete">🗑️</button>
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
                            <h2>{editing ? 'Edit Company' : 'Add Company'}</h2>
                            <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={submit} className="modal-form">
                            <div className="form-group">
                                <label>Name *</label>
                                <input value={data.name} onChange={(e) => setData('name', e.target.value)} required />
                                {errors.name && <span className="field-error">{errors.name}</span>}
                            </div>
                            <div className="form-group">
                                <label>Slug</label>
                                <input value={data.slug} onChange={(e) => setData('slug', e.target.value)} placeholder="auto-generated from name if left blank" />
                                {errors.slug && <span className="field-error">{errors.slug}</span>}
                            </div>
                            {editing && (
                                <div className="form-group">
                                    <label>
                                        <input type="checkbox" checked={data.is_active} onChange={(e) => setData('is_active', e.target.checked)} /> Active
                                    </label>
                                </div>
                            )}
                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn-primary" disabled={processing}>
                                    {processing ? 'Saving…' : editing ? 'Update' : 'Add Company'}
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
