import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Toaster, toast } from 'sonner';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Shield, ToggleLeft, ToggleRight } from 'lucide-react';
import './UserManagement.css';

// All available modules and what roles have access by default
const ALL_MODULES = [
    { key: 'dashboard',        label: 'Dashboard',               icon: '📊' },
    { key: 'log-arrival',      label: 'Log Arrival',             icon: '🚚' },
    { key: 'sampling',         label: 'Daily Sampling / QA',     icon: '🔬' },
    { key: 'farms',            label: 'Farms & Growers',         icon: '🌿' },
    { key: 'consignees',       label: 'Consignees / Buyers',     icon: '🤝' },
    { key: 'containers-list',  label: 'Container Hub',           icon: '🛳️' },
    { key: 'inventory',        label: 'Materials Inventory',     icon: '📦' },
    { key: 'shipment-tracker', label: 'Shipment Tracker',        icon: '🌍' },
    { key: 'shipping-docs',    label: 'Shipping Docs',           icon: '📄' },
    { key: 'reports',          label: 'Reports & Analytics',     icon: '📈' },
    { key: 'accounting',       label: 'Accounting & Billing',    icon: '🧾' },
    { key: 'payroll',          label: 'Payroll & HR',            icon: '💰' },
    { key: 'user-management',  label: 'Users & Roles (Admin)',   icon: '🛡️' },
];

// Granular action-level permissions
const ALL_ACTIONS = [
    { key: 'action:approve-arrival',   label: 'Approve Arrivals',        icon: '✅', group: 'Arrivals' },
    { key: 'action:delete-arrival',    label: 'Delete Arrivals',         icon: '🗑️', group: 'Arrivals' },
    { key: 'action:stuff-container',   label: 'Stuff Containers',        icon: '📥', group: 'Containers' },
    { key: 'action:seal-container',    label: 'Seal Containers',         icon: '🔒', group: 'Containers' },
    { key: 'action:depart-container',  label: 'Depart Containers',       icon: '🚛', group: 'Containers' },
    { key: 'action:edit-payload',      label: 'Edit Stuffed Payloads',   icon: '✏️', group: 'Containers' },
    { key: 'action:delete-payload',    label: 'Delete Stuffed Payloads', icon: '❌', group: 'Containers' },
    { key: 'action:register-container',label: 'Register New Containers', icon: '🆕', group: 'Containers' },
];

const ALL_ACTION_KEYS = ALL_ACTIONS.map(a => a.key);

const ROLES = [
    'Pending',
    'Guest',
    'Administrator',
    'Hub Receiver',
    'Production Manager',
    'Production Supervisor',
    'Quality Manager',
    'Quality Supervisor',
    'Accounting Manager',
    'Accounting Staff',
    'HR Manager',
    'Logistics Supervisor',
    'Shipping Documentation Supervisor',
    'Hub Operations In-Charge',
];

// Default module + action access per role
const DEFAULT_ACCESS = {
    'Administrator': [...ALL_MODULES.map(m => m.key), ...ALL_ACTION_KEYS],
    'Admin / Developer': [...ALL_MODULES.map(m => m.key), ...ALL_ACTION_KEYS],
    'Hub Receiver': ['dashboard', 'log-arrival', 'containers-list', 'sampling', 'action:stuff-container'],
    'Production Manager': ['dashboard', 'log-arrival', 'farms', 'sampling', 'reports', 'containers-list', 'inventory', 'action:approve-arrival', 'action:stuff-container', 'action:seal-container', 'action:depart-container', 'action:register-container', 'action:edit-payload', 'action:delete-payload'],
    'Production Supervisor': ['dashboard', 'log-arrival', 'farms', 'sampling', 'action:approve-arrival', 'action:stuff-container'],
    'Quality Manager': ['dashboard', 'sampling', 'reports'],
    'Quality Supervisor': ['dashboard', 'sampling'],
    'Accounting Manager': ['dashboard', 'consignees', 'accounting', 'payroll', 'reports'],
    'Accounting Staff': ['dashboard', 'consignees', 'accounting', 'reports'],
    'HR Manager': ['dashboard', 'payroll'],
    'Logistics Supervisor': ['dashboard', 'containers-list', 'shipment-tracker', 'action:seal-container', 'action:depart-container'],
    'Shipping Documentation Supervisor': ['dashboard', 'consignees', 'containers-list', 'shipment-tracker', 'shipping-docs'],
    'Hub Operations In-Charge': ['dashboard', 'containers-list', 'inventory', 'shipment-tracker', 'action:approve-arrival', 'action:stuff-container', 'action:seal-container', 'action:depart-container', 'action:register-container', 'action:edit-payload', 'action:delete-payload', 'action:delete-arrival'],
    'Guest': ['dashboard'],
    'Pending': [],
};

export default function UserManagement({ userProfile }) {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);
    const [expandedId, setExpandedId] = useState(null);
    const [savingPermId, setSavingPermId] = useState(null);
    // Local override: { [profileId]: Set of allowed module keys }
    const [localPerms, setLocalPerms] = useState({});

    useEffect(() => { fetchProfiles(); }, []);

    const fetchProfiles = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            setProfiles(data || []);

            // Seed localPerms from saved allowed_modules or role defaults
            const perms = {};
            (data || []).forEach(p => {
                if (Array.isArray(p.allowed_modules) && p.allowed_modules.length > 0) {
                    perms[p.id] = new Set(p.allowed_modules);
                } else {
                    perms[p.id] = new Set(DEFAULT_ACCESS[p.role] || []);
                }
            });
            setLocalPerms(perms);
        } catch (err) {
            setErrorMsg('Failed to load user profiles.');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (profileId, newRole) => {
        try {
            setUpdatingId(profileId);
            const defaultMods = DEFAULT_ACCESS[newRole] || [];
            const { error, data } = await supabase
                .from('profiles')
                .update({ role: newRole, allowed_modules: defaultMods })
                .eq('id', profileId)
                .select();
            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error("Updating another user's role is blocked by Supabase RLS policies. Run the 'fix_profiles_rls.sql' script in your Supabase SQL Editor.");
            }
            setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role: newRole, allowed_modules: defaultMods } : p));
            setLocalPerms(prev => ({ ...prev, [profileId]: new Set(defaultMods) }));
        } catch (err) {
            toast.error(`Failed to update role: ${err.message}`);
        } finally {
            setTimeout(() => setUpdatingId(null), 1500);
        }
    };

    const toggleModule = (profileId, moduleKey) => {
        setLocalPerms(prev => {
            const current = new Set(prev[profileId] || []);
            if (current.has(moduleKey)) current.delete(moduleKey);
            else current.add(moduleKey);
            return { ...prev, [profileId]: current };
        });
    };

    const savePermissions = async (profileId) => {
        try {
            setSavingPermId(profileId);
            const mods = Array.from(localPerms[profileId] || []);
            const { error, data } = await supabase
                .from('profiles')
                .update({ allowed_modules: mods })
                .eq('id', profileId)
                .select();
            if (error) throw error;
            if (!data || data.length === 0) {
                throw new Error("Updating another user's modules is blocked by Supabase RLS policies. Run the 'fix_profiles_rls.sql' script in your Supabase SQL Editor.");
            }
            setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, allowed_modules: mods } : p));
        } catch (err) {
            toast.error(`Failed to save permissions: ${err.message}`);
        } finally {
            setTimeout(() => setSavingPermId(null), 1500);
        }
    };

    if (userProfile?.role !== 'Administrator' && userProfile?.role !== 'Admin / Developer') {
        return (
            <div className="placeholder-state">
                <AlertCircle size={48} color="#ef4444" />
                <h3>Access Restricted</h3>
                <p>Only Administrators can access User & Role Management.</p>
            </div>
        );
    }

    return (
        <div className="user-management-page">
            <header className="user-management-header">
                <h2>Users & Roles</h2>
                <p>Assign roles and customize per-user module access permissions.</p>
            </header>

            {errorMsg && (
                <div style={{ padding: '1rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    {errorMsg}
                </div>
            )}

            <div className="animation-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {loading ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>Loading profiles...</div>
                ) : profiles.length === 0 ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>No user profiles found.</div>
                ) : profiles.map(profile => {
                    const isExpanded = expandedId === profile.id;
                    const isAdmin = profile.role === 'Administrator' || profile.role === 'Admin / Developer';
                    const isPending = profile.role === 'Pending' || profile.role === 'Guest';
                    const perms = localPerms[profile.id] || new Set();
                    const isSaving = savingPermId === profile.id;
                    const isUpdating = updatingId === profile.id;

                    return (
                        <div key={profile.id} className="card" style={{ overflow: 'hidden', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            {/* User Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem', flexWrap: 'wrap' }}>
                                {/* Avatar */}
                                <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: isAdmin ? 'linear-gradient(135deg, #7c3aed, #8b5cf6)' : 'linear-gradient(135deg, #10b981, #059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '1rem', flexShrink: 0, overflow: 'hidden' }}>
                                    {profile.avatar_url
                                        ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        : (profile.full_name?.charAt(0).toUpperCase() || 'U')}
                                </div>

                                {/* Name & Email */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <strong style={{ display: 'block', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{profile.full_name || 'Unnamed Employee'}</strong>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{profile.id.substring(0, 18)}…</span>
                                </div>

                                {/* Role Select */}
                                <select
                                    className={`role-select ${isAdmin ? 'role-admin' : ''} ${isPending ? 'role-pending' : ''}`}
                                    value={profile.role || 'Guest'}
                                    onChange={e => handleRoleChange(profile.id, e.target.value)}
                                    disabled={isUpdating}
                                    style={{ minWidth: '180px' }}
                                >
                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>

                                {/* Status Badge */}
                                {isPending
                                    ? <span className="status-badge empty" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', flexShrink: 0 }}>Needs Role</span>
                                    : isAdmin
                                    ? <span className="status-badge sealed" style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', flexShrink: 0 }}>Administrator</span>
                                    : <span className="status-badge full" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', flexShrink: 0 }}>Active</span>}

                                {isUpdating && <CheckCircle2 size={18} color="#10b981" />}

                                {/* Expand Toggle */}
                                {!isAdmin && (
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : profile.id)}
                                        style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.3rem 0.6rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', flexShrink: 0 }}
                                    >
                                        <Shield size={14} />
                                        Modules
                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                )}
                            </div>

                            {/* Module Permissions Panel */}
                            {isExpanded && !isAdmin && (
                                <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
                                    {/* MODULE ACCESS */}
                                    <p style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <span>📂</span> Module Access
                                    </p>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '0.7rem' }}>
                                        Toggle which pages this user can see in the sidebar.
                                    </p>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '1.25rem' }}>
                                        {ALL_MODULES.map(mod => {
                                            const allowed = perms.has(mod.key);
                                            return (
                                                <button
                                                    key={mod.key}
                                                    onClick={() => toggleModule(profile.id, mod.key)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                        padding: '0.55rem 0.85rem', borderRadius: '10px', cursor: 'pointer',
                                                        border: `1px solid ${allowed ? '#10b981' : 'var(--border-color)'}`,
                                                        background: allowed ? 'rgba(16,185,129,0.08)' : 'var(--bg-card)',
                                                        color: allowed ? '#065f46' : 'var(--text-secondary)',
                                                        fontSize: '0.83rem', fontWeight: '500',
                                                        transition: 'all 0.15s ease', textAlign: 'left',
                                                    }}
                                                >
                                                    <span>{mod.icon}</span>
                                                    <span style={{ flex: 1 }}>{mod.label}</span>
                                                    {allowed
                                                        ? <ToggleRight size={18} color="#10b981" />
                                                        : <ToggleLeft size={18} color="#94a3b8" />}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* ACTION PERMISSIONS */}
                                    <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                        <p style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7c3aed', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            <span>⚡</span> Action Permissions
                                        </p>
                                        <p style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)', marginBottom: '0.7rem' }}>
                                            Control which specific operations this user can perform within modules.
                                        </p>
                                        {/* Group actions by group */}
                                        {['Arrivals', 'Containers'].map(group => (
                                            <div key={group} style={{ marginBottom: '0.75rem' }}>
                                                <p style={{ fontSize: '0.7rem', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{group}</p>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '0.4rem' }}>
                                                    {ALL_ACTIONS.filter(a => a.group === group).map(action => {
                                                        const allowed = perms.has(action.key);
                                                        return (
                                                            <button
                                                                key={action.key}
                                                                onClick={() => toggleModule(profile.id, action.key)}
                                                                style={{
                                                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                                                    padding: '0.5rem 0.8rem', borderRadius: '10px', cursor: 'pointer',
                                                                    border: `1px solid ${allowed ? '#7c3aed' : 'var(--border-color)'}`,
                                                                    background: allowed ? 'rgba(124,58,237,0.08)' : 'var(--bg-card)',
                                                                    color: allowed ? '#5b21b6' : 'var(--text-secondary)',
                                                                    fontSize: '0.8rem', fontWeight: '500',
                                                                    transition: 'all 0.15s ease', textAlign: 'left',
                                                                }}
                                                            >
                                                                <span>{action.icon}</span>
                                                                <span style={{ flex: 1 }}>{action.label}</span>
                                                                {allowed
                                                                    ? <ToggleRight size={18} color="#7c3aed" />
                                                                    : <ToggleLeft size={18} color="#94a3b8" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                                        <button
                                            onClick={() => setExpandedId(null)}
                                            style={{ padding: '0.45rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={() => savePermissions(profile.id)}
                                            disabled={isSaving}
                                            style={{ padding: '0.45rem 1.25rem', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                        >
                                            {isSaving ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> Saving…</> : <><CheckCircle2 size={15} /> Save Permissions</>}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
