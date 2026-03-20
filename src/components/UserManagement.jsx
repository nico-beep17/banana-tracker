import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import './UserManagement.css';

const UserManagement = ({ userProfile }) => {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [updatingId, setUpdatingId] = useState(null);

    const roles = [
        'Pending',
        'Guest',
        'Admin / Developer',
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
        'Hub Operations In-Charge'
    ];

    useEffect(() => {
        fetchProfiles();
    }, []);

    const fetchProfiles = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setProfiles(data || []);
        } catch (error) {
            console.error('Error fetching users:', error);
            setErrorMsg('Failed to load user profiles from the database.');
        } finally {
            setLoading(false);
        }
    };

    const handleRoleChange = async (profileId, newRole) => {
        try {
            setUpdatingId(profileId);
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole, last_modified: new Date().toISOString() })
                .eq('id', profileId);

            if (error) throw error;

            // Optimistically update UI
            setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role: newRole } : p));
        } catch (error) {
            console.error('Error updating role:', error);
            alert(`Failed to update role: ${error.message}`);
        } finally {
            setTimeout(() => setUpdatingId(null), 1500); // Keep success check visible shortly
        }
    };

    if (userProfile?.role !== 'Admin / Developer') {
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
                <p>Manage employee operational access and assigned software features.</p>
            </header>

            {errorMsg && (
                <div style={{ padding: '1rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    {errorMsg}
                </div>
            )}

            <div className="users-table-container animation-fade-in">
                {loading ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        Loading profiles...
                    </div>
                ) : profiles.length === 0 ? (
                    <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                        No user profiles found. They will appear here when users sign in.
                    </div>
                ) : (
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>Personnel / Employee</th>
                                <th>Assigned Operational Role</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {profiles.map(profile => {
                                const initialChar = profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'U';
                                const isAdmin = profile.role === 'Admin / Developer';
                                const isPending = profile.role === 'Pending' || profile.role === 'Guest';
                                
                                return (
                                    <tr key={profile.id}>
                                        <td>
                                            <div className="user-identity">
                                                <div className="user-identity-avatar">
                                                    {profile.avatar_url ? (
                                                        <img src={profile.avatar_url} alt="avatar" />
                                                    ) : initialChar}
                                                </div>
                                                <div className="user-identity-details">
                                                    <strong>{profile.full_name || 'Unnamed Employee'}</strong>
                                                    <span>{profile.id.substring(0, 13)}...</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td style={{ width: '40%' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                <select
                                                    className={`role-select ${isAdmin ? 'role-admin' : ''} ${isPending ? 'role-pending' : ''}`}
                                                    value={profile.role || 'Guest'}
                                                    onChange={(e) => handleRoleChange(profile.id, e.target.value)}
                                                    disabled={updatingId === profile.id}
                                                >
                                                    {roles.map(role => (
                                                        <option key={role} value={role}>{role}</option>
                                                    ))}
                                                </select>
                                                
                                                <div className={`save-status ${updatingId === profile.id ? 'visible' : ''}`}>
                                                    <CheckCircle2 size={16} />
                                                    <span>Saved</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            {isPending ? (
                                                <span className="status-badge empty" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>Needs Role</span>
                                            ) : isAdmin ? (
                                                <span className="status-badge sealed" style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>Administrator</span>
                                            ) : (
                                                <span className="status-badge full" style={{ background: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}>Active Access</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default UserManagement;
