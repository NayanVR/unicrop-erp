import { destroy, store, update } from '@/routes/users';
import type { Role, User } from '@/types';
import { Head, useForm } from '@inertiajs/react';
import { useState } from 'react';

type Props = {
    pageTitle: string;
    users: User[];
    roles: Role[];
    companies: { id: number; name: string }[];
};

type UserFormData = {
    name: string;
    email: string;
    password: string;
    roles: number[];
    status: 'active' | 'inactive';
    phone: string;
    notes: string;
    permissions: string[];
    modules: string[];
    company_access: string[];
    cost_access: boolean;
};

const stagePermissions = [
    { id: 'processing', label: 'Processing' },
    { id: 'filling', label: 'Filling' },
    { id: 'labeling', label: 'Labeling' },
    { id: 'ready', label: 'Mark Ready' },
    { id: 'dispatched', label: 'Dispatch' },
    { id: 'confirm', label: 'Confirm Orders' },
];

const bomPermissions = [
    { id: 'bom_delete', label: 'Delete BOM & Run History' },
];

const moduleAccess = [
    { id: 'factory', label: 'Production Orders' },
    { id: 'bom', label: 'Bill of Materials' },
    { id: 'bottle-filling', label: 'Filling' },
    { id: 'box-labels', label: 'Box Labels' },
    { id: 'prod-history', label: 'Production History' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'finished-goods', label: 'Finished Goods' },
];

const userStatusLabel = (isActive?: boolean) =>
    isActive ? 'Active' : 'Inactive';

export default function UsersIndex({ users, roles, companies }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [revealedPwd, setRevealedPwd] = useState<Set<number>>(new Set());
    const togglePwd = (id: number) => setRevealedPwd((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

    const form = useForm<UserFormData>({
        name: '',
        email: '',
        password: '',
        roles: [],
        status: 'active',
        phone: '',
        notes: '',
        permissions: [],
        modules: [],
        company_access: [],
        cost_access: false,
    });

    const resetForm = () => {
        form.reset();
        form.clearErrors();
        setEditingUser(null);
    };

    const openNewUserModal = () => {
        resetForm();
        setModalOpen(true);
    };

    const openEditUserModal = (user: User) => {
        form.setData({
            name: user.name ?? '',
            email: user.email ?? '',
            password: '',
            roles: user.roles?.map((role) => role.id) ?? [],
            status: user.is_active ? 'active' : 'inactive',
            phone: (user.phone as string) ?? '',
            notes: (user.notes as string) ?? '',
            permissions: (user.permissions as string[]) ?? [],
            modules: (user.modules as string[]) ?? [],
            company_access: (user.company_access as string[]) ?? [],
            cost_access: Boolean(user.cost_access),
        });
        form.clearErrors();
        setEditingUser(user);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        resetForm();
    };

    const toggleArrayValue = (
        field: keyof UserFormData,
        value: string | number,
    ) => {
        const current = form.data[field] as Array<string | number>;
        if (current.includes(value)) {
            form.setData(
                field,
                current.filter((item) => item !== value),
            );
            return;
        }

        form.setData(field, [...current, value]);
    };

    const saveUser = () => {
        if (editingUser) {
            form.patch(update(editingUser.id), {
                preserveScroll: true,
                onSuccess: closeModal,
            });
            return;
        }

        form.post(store(), {
            preserveScroll: true,
            onSuccess: closeModal,
        });
    };

    const deleteUser = (user: User) => {
        if (!confirm(`Delete ${user.name}? This cannot be undone.`)) {
            return;
        }

        form.delete(destroy(user.id), {
            preserveScroll: true,
        });
    };

    const toggleUserStatus = (user: User) => {
        form.patch(update(user.id), {
            preserveScroll: true,
            data: {
                name: user.name,
                email: user.email,
                password: '',
                roles: user.roles?.map((role) => role.id) ?? [],
                status: user.is_active ? 'inactive' : 'active',
                phone: (user.phone as string) ?? '',
                notes: (user.notes as string) ?? '',
                permissions: (user.permissions as string[]) ?? [],
                modules: (user.modules as string[]) ?? [],
                company_access: (user.company_access as string[]) ?? [],
                cost_access: Boolean(user.cost_access),
            },
        });
    };

    return (
        <>
            <Head title="User Management" />
            <div id="view-users" className="view active">
                <div className="page-header">
                    <div className="page-header-left">
                        <h1>User Management</h1>
                        <p>Create and manage portal users</p>
                    </div>
                    <button className="btn primary" onClick={openNewUserModal}>
                        ＋ Add New User
                    </button>
                </div>

                <div className="users-grid">
                    {users.length === 0 ? (
                        <div className="empty-state">
                            <div className="icon">👥</div>
                            <p>No users yet.</p>
                        </div>
                    ) : (
                        users.map((user) => (
                            <div key={user.id} className="user-card">
                                <div className="user-card-top">
                                    <div className="user-card-avatar">
                                        {user.name
                                            .split(' ')
                                            .map((part) => part[0])
                                            .join('')
                                            .slice(0, 2)
                                            .toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="user-card-name">
                                            {user.name}
                                        </div>
                                        <div className="user-card-email">
                                            {user.email}
                                        </div>
                                        <div className="user-status">
                                            <span
                                                className={`user-status-dot ${
                                                    user.is_active
                                                        ? 'active'
                                                        : 'inactive'
                                                }`}
                                            />
                                            {userStatusLabel(user.is_active)}
                                            {user.roles?.length ? (
                                                <span
                                                    style={{
                                                        marginLeft: '8px',
                                                    }}
                                                >
                                                    ·{' '}
                                                    {user.roles
                                                        .map(
                                                            (role) => role.name,
                                                        )
                                                        .join(', ')}
                                                </span>
                                            ) : null}
                                        </div>
                                        {user.password_plain && (
                                            <div style={{ marginTop: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ color: 'var(--tx-muted)' }}>Password:</span>
                                                <span style={{ fontFamily: 'monospace', letterSpacing: '.5px' }}>
                                                    {revealedPwd.has(user.id) ? user.password_plain : '••••••••'}
                                                </span>
                                                <button
                                                    onClick={() => togglePwd(user.id)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', fontSize: 12, color: 'var(--tx-muted)' }}
                                                >
                                                    {revealedPwd.has(user.id) ? '🙈' : '👁'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="user-card-actions">
                                    <button
                                        className="btn sm"
                                        onClick={() => openEditUserModal(user)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        className="btn sm"
                                        onClick={() => toggleUserStatus(user)}
                                    >
                                        {user.is_active
                                            ? 'Deactivate'
                                            : 'Activate'}
                                    </button>
                                    <button
                                        className="btn danger-xs"
                                        onClick={() => deleteUser(user)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className={`modal-overlay${modalOpen ? ' open' : ''}`}>
                <div
                    className="modal"
                    style={{
                        maxWidth: '600px',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <div className="modal-header">
                        <h2>{editingUser ? 'Edit User' : 'Add New User'}</h2>
                        <button className="modal-close" onClick={closeModal}>
                            ✕
                        </button>
                    </div>
                    <div
                        className="modal-body"
                        style={{ overflowY: 'auto', flex: 1 }}
                    >
                        {form.hasErrors && (
                            <div
                                className="form-msg error"
                                style={{ marginBottom: '10px' }}
                            >
                                Please fix the highlighted fields.
                            </div>
                        )}
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Full Name *</label>
                                <input
                                    type="text"
                                    className={form.errors.name ? 'error' : ''}
                                    value={form.data.name}
                                    onChange={(event) =>
                                        form.setData('name', event.target.value)
                                    }
                                    placeholder="e.g. Amit Shah"
                                />
                                {form.errors.name && <span className="field-error">{form.errors.name}</span>}
                            </div>
                            <div className="form-group">
                                <label>Email *</label>
                                <input
                                    type="email"
                                    className={form.errors.email ? 'error' : ''}
                                    value={form.data.email}
                                    onChange={(event) =>
                                        form.setData(
                                            'email',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="user@example.com"
                                />
                                {form.errors.email && <span className="field-error">{form.errors.email}</span>}
                            </div>
                            <div className="form-group">
                                <label>Password {editingUser ? '' : '*'}</label>
                                <input
                                    type="password"
                                    className={form.errors.password ? 'error' : ''}
                                    value={form.data.password}
                                    onChange={(event) =>
                                        form.setData(
                                            'password',
                                            event.target.value,
                                        )
                                    }
                                    placeholder={
                                        editingUser
                                            ? 'Leave blank to keep'
                                            : 'Set password'
                                    }
                                />
                                {form.errors.password && <span className="field-error">{form.errors.password}</span>}
                            </div>
                            <div
                                className="form-group"
                                style={{ gridColumn: '1/-1' }}
                            >
                                <label>Role(s) *</label>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '8px',
                                        marginTop: '6px',
                                        ...(form.errors.roles ? { padding: '8px', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)' } : {}),
                                    }}
                                >
                                    {roles.map((role) => (
                                        <label
                                            key={role.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                                padding: '8px 10px',
                                                background: 'var(--bg-paper)',
                                                border: '1px solid var(--border)',
                                                borderRadius:
                                                    'var(--radius-sm)',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                value={role.id}
                                                checked={form.data.roles.includes(
                                                    role.id,
                                                )}
                                                onChange={() =>
                                                    toggleArrayValue(
                                                        'roles',
                                                        role.id,
                                                    )
                                                }
                                                style={{ width: 'auto' }}
                                            />
                                            {role.name}
                                        </label>
                                    ))}
                                </div>
                                {form.errors.roles && <span className="field-error">{form.errors.roles}</span>}
                            </div>
                            <div className="form-group">
                                <label>Phone</label>
                                <input
                                    type="tel"
                                    className={form.errors.phone ? 'error' : ''}
                                    value={form.data.phone}
                                    onChange={(event) =>
                                        form.setData(
                                            'phone',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="Contact number"
                                />
                                {form.errors.phone && <span className="field-error">{form.errors.phone}</span>}
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    className={form.errors.status ? 'error' : ''}
                                    value={form.data.status}
                                    onChange={(event) =>
                                        form.setData(
                                            'status',
                                            event.target.value as
                                                | 'active'
                                                | 'inactive',
                                        )
                                    }
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                                {form.errors.status && <span className="field-error">{form.errors.status}</span>}
                            </div>
                        </div>

                        <div
                            className="form-group"
                            style={{ marginTop: '12px' }}
                        >
                            <label>Notes</label>
                            <textarea
                                value={form.data.notes}
                                onChange={(event) =>
                                    form.setData('notes', event.target.value)
                                }
                                placeholder="Any notes about this user"
                            />
                        </div>

                        <div
                            style={{
                                marginTop: '14px',
                                padding: '14px',
                                background: 'var(--bg-paper)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                            }}
                        >
                            <div
                                style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '.6px',
                                    color: 'var(--tx-muted)',
                                    marginBottom: '10px',
                                }}
                            >
                                🏢 Company Access
                            </div>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '7px',
                                }}
                            >
                                {companies.length === 0 ? (
                                    <span
                                        style={{
                                            fontSize: '12px',
                                            color: 'var(--tx-faint)',
                                        }}
                                    >
                                        No companies yet.
                                    </span>
                                ) : (
                                    companies.map((company) => (
                                        <label
                                            key={company.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                fontSize: '13px',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            <input
                                                type="checkbox"
                                                style={{ width: 'auto' }}
                                                checked={form.data.company_access.includes(
                                                    company.name,
                                                )}
                                                onChange={() =>
                                                    toggleArrayValue(
                                                        'company_access',
                                                        company.name,
                                                    )
                                                }
                                            />
                                            {company.name}
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        <div
                            style={{
                                marginTop: '14px',
                                padding: '14px',
                                background: 'var(--bg-paper)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                            }}
                        >
                            <div
                                style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '.6px',
                                    color: 'var(--tx-muted)',
                                    marginBottom: '8px',
                                }}
                            >
                                ⚙️ Production Stage Access
                            </div>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '7px',
                                    marginBottom: '14px',
                                }}
                            >
                                {stagePermissions.map((perm) => (
                                    <label
                                        key={perm.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            style={{ width: 'auto' }}
                                            checked={form.data.permissions.includes(
                                                perm.id,
                                            )}
                                            onChange={() =>
                                                toggleArrayValue(
                                                    'permissions',
                                                    perm.id,
                                                )
                                            }
                                        />
                                        {perm.label}
                                    </label>
                                ))}
                            </div>

                            {/* BOM Permissions */}
                            <div style={{ marginTop: '12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--tx-muted)', marginBottom: 6 }}>BOM Permissions</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 12px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 'var(--radius-sm)' }}>
                                {bomPermissions.map((perm) => (
                                    <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            style={{ width: 'auto' }}
                                            checked={form.data.permissions.includes(perm.id)}
                                            onChange={() => toggleArrayValue('permissions', perm.id)}
                                        />
                                        {perm.label}
                                    </label>
                                ))}
                            </div>

                            <div
                                style={{
                                    marginTop: '12px',
                                    padding: '10px 12px',
                                    background: '#fef3c7',
                                    border: '1px solid #fde68a',
                                    borderRadius: 'var(--radius-sm)',
                                }}
                            >
                                <label
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        fontSize: '13px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        color: '#92400e',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        style={{ width: 'auto' }}
                                        checked={form.data.cost_access}
                                        onChange={(event) =>
                                            form.setData(
                                                'cost_access',
                                                event.target.checked,
                                            )
                                        }
                                    />
                                    💰 Cost & Value Access
                                </label>
                                <div
                                    style={{
                                        fontSize: '11px',
                                        color: '#92400e',
                                        marginTop: '3px',
                                        paddingLeft: '22px',
                                    }}
                                >
                                    Factory Manager level - sees cost values.
                                </div>
                            </div>
                        </div>

                        <div
                            style={{
                                marginTop: '14px',
                                padding: '14px',
                                background: 'var(--bg-paper)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-sm)',
                            }}
                        >
                            <div
                                style={{
                                    fontSize: '11px',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    letterSpacing: '.6px',
                                    color: 'var(--tx-muted)',
                                    marginBottom: '8px',
                                }}
                            >
                                📦 Module Access
                            </div>
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '7px',
                                }}
                            >
                                {moduleAccess.map((module) => (
                                    <label
                                        key={module.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            fontSize: '13px',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            style={{ width: 'auto' }}
                                            checked={form.data.modules.includes(
                                                module.id,
                                            )}
                                            onChange={() =>
                                                toggleArrayValue(
                                                    'modules',
                                                    module.id,
                                                )
                                            }
                                        />
                                        {module.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn" onClick={closeModal}>
                            Cancel
                        </button>
                        <button
                            className="btn primary"
                            onClick={saveUser}
                            disabled={form.processing}
                        >
                            Save User
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
