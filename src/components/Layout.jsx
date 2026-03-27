import React, { useState, useEffect, useRef, useMemo } from 'react';
import { RefreshCw, Bell, Settings, LayoutDashboard, ClipboardEdit, TestTubes, Leaf, Handshake, Ship, Package, Globe, LineChart, Calculator, Users, LogOut, UserCog } from 'lucide-react';
import offlineSync from '../utils/offlineSync';
import './Layout.css';

const Layout = ({ children, activeTab, onTabChange, userProfile, onLogout, notifications = [], onRefresh, arrivals = [], farms = [], samplings = [] }) => {
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const searchRef = useRef(null);
    const unreadCount = notifications.filter(n => !n.read).length;

    const [offlineStatus, setOfflineStatus] = useState({
        syncing: false,
        pendingCount: offlineSync ? offlineSync.pendingCount : 0,
        isOnline: navigator.onLine
    });

    useEffect(() => {
        if (!offlineSync) return;
        const unsubscribe = offlineSync.subscribe((status) => {
            setOfflineStatus(prev => ({ ...prev, ...status }));
        });

        const handleOnline = () => setOfflineStatus(prev => ({ ...prev, isOnline: true }));
        const handleOffline = () => setOfflineStatus(prev => ({ ...prev, isOnline: false }));

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            unsubscribe();
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const role = userProfile?.role || 'Guest';
    const isAdmin = role === 'Administrator' || role === 'Admin / Developer';

    // canAccess: Admins bypass everything. Otherwise check allowed_modules if set, else fall back to role.
    const canAccess = (moduleKey) => {
        if (isAdmin) return true;
        if (Array.isArray(userProfile?.allowed_modules) && userProfile.allowed_modules.length > 0) {
            return userProfile.allowed_modules.includes(moduleKey);
        }
        // Role-based fallback (mirrors DEFAULT_ACCESS in UserManagement)
        const roleDefaults = {
            'Hub Receiver': ['dashboard', 'log-arrival', 'containers-list', 'sampling'],
            'Production Manager': ['dashboard', 'log-arrival', 'farms', 'sampling', 'reports', 'containers-list', 'inventory'],
            'Production Supervisor': ['dashboard', 'log-arrival', 'farms', 'sampling'],
            'Quality Manager': ['dashboard', 'sampling', 'reports'],
            'Quality Supervisor': ['dashboard', 'sampling'],
            'Accounting Manager': ['dashboard', 'consignees', 'accounting', 'payroll', 'reports'],
            'Accounting Staff': ['dashboard', 'consignees', 'accounting', 'reports'],
            'HR Manager': ['dashboard', 'payroll'],
            'Logistics Supervisor': ['dashboard', 'containers-list', 'shipment-tracker'],
            'Shipping Documentation Supervisor': ['dashboard', 'consignees', 'containers-list', 'shipment-tracker'],
            'Hub Operations In-Charge': ['dashboard', 'containers-list', 'inventory', 'shipment-tracker'],
            'Guest': ['dashboard'],
            'Pending': [],
        };
        return (roleDefaults[role] || []).includes(moduleKey);
    };

    // Close mobile sidebar when tab changes
    useEffect(() => {
        setIsMobileSidebarOpen(false);
    }, [activeTab]);

    // Prevent body scroll when mobile sidebar is open
    useEffect(() => {
        if (isMobileSidebarOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isMobileSidebarOpen]);

    const handleMobileTabChange = (tab) => {
        onTabChange(tab);
        setIsMobileSidebarOpen(false);
    };

    const handleRefresh = async () => {
        if (isSyncing || !onRefresh) return;
        setIsSyncing(true);
        try {
            await onRefresh();
        } catch (e) {
            console.error('Sync failed:', e);
        } finally {
            setTimeout(() => setIsSyncing(false), 600);
        }
    };

    // Global search results
    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (q.length < 2) return [];
        const results = [];
        farms.filter(f =>
            f.name?.toLowerCase().includes(q) || f.farmCode?.toLowerCase().includes(q) || f.location?.toLowerCase().includes(q)
        ).slice(0, 4).forEach(f => results.push({ type: 'Farm', icon: '🌿', tab: 'farms', title: f.name, sub: `${f.farmCode} · ${f.location || ''}`, color: '#16a34a', bg: '#f0fdf4' }));
        const seen = new Set();
        arrivals.filter(a =>
            a.deliveryReceipt?.toLowerCase().includes(q) || a.farmCode?.toLowerCase().includes(q) ||
            a.farmName?.toLowerCase().includes(q) || a.batchId?.toLowerCase().includes(q) || a.plateNumber?.toLowerCase().includes(q)
        ).forEach(a => {
            const key = a.batchId || a.id;
            if (seen.has(key) || results.filter(r => r.type === 'Arrival').length >= 4) return;
            seen.add(key);
            results.push({ type: 'Arrival', icon: '📦', tab: 'log-arrival', title: `DR ${a.deliveryReceipt || '—'} · ${a.farmName || a.farmCode}`, sub: `${a.dateOfPacking ? new Date(a.dateOfPacking).toLocaleDateString() : ''} · ${a.approval_status || 'PENDING'}`, color: '#3b82f6', bg: '#eff6ff' });
        });
        samplings.filter(s =>
            s.farmName?.toLowerCase().includes(q) || s.farmCode?.toLowerCase().includes(q) || s.inspector?.toLowerCase().includes(q)
        ).slice(0, 3).forEach(s => results.push({ type: 'Sampling', icon: '🔬', tab: 'sampling', title: `${s.farmName || s.farmCode} — ${s.overallDecision || '?'}`, sub: `${s.date ? new Date(s.date).toLocaleDateString() : ''} · ${s.inspector || ''}`, color: '#8b5cf6', bg: '#f5f3ff' }));
        return results.slice(0, 10);
    }, [searchQuery, farms, arrivals, samplings]);

    useEffect(() => {
        const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="layout" onClick={() => { 
            if (isNotificationOpen) setIsNotificationOpen(false); 
            if (isSettingsOpen) setIsSettingsOpen(false); 
        }}>
            {/* Mobile Sidebar Overlay */}
            {isMobileSidebarOpen && (
                <div className="mobile-overlay" onClick={() => setIsMobileSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`sidebar ${isMobileSidebarOpen ? 'sidebar-mobile-open' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo">
                        <span className="logo-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&#x1F34C;</span>
                        <h2 className="logo-text" style={{ fontSize: '1.2rem' }}>LAVC Operations</h2>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <ul className="nav-list">
                        <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => onTabChange('dashboard')}>
                            <span className="nav-icon"><LayoutDashboard size={20} /></span>
                            <span className="nav-text">Dashboard</span>
                        </li>

                        {canAccess('log-arrival') && (
                            <li className={`nav-item ${activeTab === 'log-arrival' ? 'active' : ''}`} onClick={() => onTabChange('log-arrival')}>
                                <span className="nav-icon"><ClipboardEdit size={20} /></span>
                                <span className="nav-text">Log Arrival</span>
                            </li>
                        )}

                        {canAccess('sampling') && (
                            <li className={`nav-item ${activeTab === 'sampling' ? 'active' : ''}`} onClick={() => onTabChange('sampling')}>
                                <span className="nav-icon"><TestTubes size={20} /></span>
                                <span className="nav-text">Daily Sampling</span>
                            </li>
                        )}

                        {canAccess('farms') && (
                            <li className={`nav-item ${activeTab === 'farms' ? 'active' : ''}`} onClick={() => onTabChange('farms')}>
                                <span className="nav-icon"><Leaf size={20} /></span>
                                <span className="nav-text">Farms &amp; Growers</span>
                            </li>
                        )}

                        {canAccess('consignees') && (
                            <li className={`nav-item ${activeTab === 'consignees' ? 'active' : ''}`} onClick={() => onTabChange('consignees')}>
                                <span className="nav-icon"><Handshake size={20} /></span>
                                <span className="nav-text">Consignees</span>
                            </li>
                        )}

                        {canAccess('containers-list') && (
                            <li className={`nav-item ${activeTab === 'new-container' || activeTab === 'containers-list' || activeTab === 'edit-container' ? 'active' : ''}`} onClick={() => onTabChange('containers-list')}>
                                <span className="nav-icon"><Ship size={20} /></span>
                                <span className="nav-text">Container Hub</span>
                            </li>
                        )}

                        {canAccess('inventory') && (
                            <li className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => onTabChange('inventory')}>
                                <span className="nav-icon"><Package size={20} /></span>
                                <span className="nav-text">Materials Inventory</span>
                            </li>
                        )}

                        {canAccess('shipment-tracker') && (
                            <li className={`nav-item ${activeTab === 'shipment-tracker' ? 'active' : ''}`} onClick={() => onTabChange('shipment-tracker')}>
                                <span className="nav-icon"><Globe size={20} /></span>
                                <span className="nav-text">Shipment Tracker</span>
                            </li>
                        )}

                        {canAccess('reports') && (
                            <li className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => onTabChange('reports')}>
                                <span className="nav-icon"><LineChart size={20} /></span>
                                <span className="nav-text">Reports</span>
                            </li>
                        )}

                        {canAccess('accounting') && (
                            <li className={`nav-item ${activeTab === 'accounting' ? 'active' : ''}`} onClick={() => onTabChange('accounting')}>
                                <span className="nav-icon"><Calculator size={20} /></span>
                                <span className="nav-text">Accounting &amp; Billing</span>
                            </li>
                        )}

                        {canAccess('payroll') && (
                            <li className={`nav-item ${activeTab === 'payroll' ? 'active' : ''}`} onClick={() => onTabChange('payroll')}>
                                <span className="nav-icon"><Users size={20} /></span>
                                <span className="nav-text">Payroll &amp; HR</span>
                            </li>
                        )}

                        {isAdmin && (
                            <li className={`nav-item ${activeTab === 'user-management' ? 'active' : ''}`} onClick={() => onTabChange('user-management')}>
                                <span className="nav-icon"><UserCog size={20} /></span>
                                <span className="nav-text">Users &amp; Roles</span>
                            </li>
                        )}
                    </ul>
                </nav>

                <div className="sidebar-footer">
                    {userProfile ? (
                        <div className="user-profile">
                            <div className="avatar">
                                {userProfile.full_name ? userProfile.full_name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="user-info">
                                <span className="user-name">{userProfile.full_name || 'User'}</span>
                                <span className="user-role">{userProfile.role || 'Guest'}</span>
                            </div>
                            <button onClick={onLogout} title="Sign Out" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', display: 'flex' }}>
                                <LogOut size={20} />
                            </button>
                        </div>
                    ) : (
                        <div className="user-profile">
                            <div className="avatar">G</div>
                            <div className="user-info">
                                <span className="user-name">Guest Player</span>
                                <span className="user-role">Not authenticated</span>
                            </div>
                        </div>
                    )}
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="main-content">
                <header className="top-header">
                    <button
                        className="mobile-hamburger"
                        onClick={(e) => { e.stopPropagation(); setIsMobileSidebarOpen(!isMobileSidebarOpen); }}
                        aria-label="Toggle navigation"
                    >
                        <span className={`hamburger-line ${isMobileSidebarOpen ? 'open' : ''}`}></span>
                        <span className={`hamburger-line ${isMobileSidebarOpen ? 'open' : ''}`}></span>
                        <span className={`hamburger-line ${isMobileSidebarOpen ? 'open' : ''}`}></span>
                    </button>
                    <div className="header-search" ref={searchRef} style={{ position: 'relative' }}>
                        <input
                            type="text"
                            className="input-field"
                            placeholder="Search farms, arrivals, samplings…"
                            value={searchQuery}
                            onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                            onFocus={() => setSearchOpen(true)}
                            onKeyDown={e => e.key === 'Escape' && setSearchOpen(false)}
                            style={{ paddingLeft: '2rem' }}
                        />
                        <span style={{ position: 'absolute', left: '0.6rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.9rem', pointerEvents: 'none' }}>🔍</span>
                        {searchOpen && searchQuery.trim().length >= 2 && (
                            <div style={{
                                position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
                                background: 'white', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                                border: '1px solid #e2e8f0', zIndex: 9999, overflow: 'hidden', minWidth: '320px'
                            }}>
                                {searchResults.length === 0 ? (
                                    <div style={{ padding: '1.25rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>No results for "{searchQuery}"</div>
                                ) : (
                                    <div>
                                        {searchResults.map((r, i) => (
                                            <button
                                                key={i}
                                                onClick={() => { onTabChange(r.tab); setSearchQuery(''); setSearchOpen(false); }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                                                    width: '100%', padding: '0.65rem 1rem', border: 'none',
                                                    background: 'white', cursor: 'pointer', textAlign: 'left',
                                                    borderBottom: i < searchResults.length - 1 ? '1px solid #f1f5f9' : 'none',
                                                    transition: 'background 0.1s'
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = r.bg}
                                                onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                            >
                                                <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{r.icon}</span>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</div>
                                                    <div style={{ fontSize: '0.73rem', color: '#64748b' }}>{r.sub}</div>
                                                </div>
                                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: r.color, background: r.bg, padding: '0.15rem 0.45rem', borderRadius: '4px', flexShrink: 0 }}>{r.type}</span>
                                            </button>
                                        ))}
                                        <div style={{ padding: '0.5rem 1rem', background: '#f8fafc', fontSize: '0.72rem', color: '#94a3b8', borderTop: '1px solid #e2e8f0' }}>
                                            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} · Press Esc to close
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="header-actions">
                        {/* Offline / Sync Queue Badge */}
                        {(!offlineStatus.isOnline || offlineStatus.pendingCount > 0) && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.5rem',
                                background: offlineStatus.isOnline ? '#fffbeb' : '#fef2f2',
                                border: `1px solid ${offlineStatus.isOnline ? '#fde68a' : '#fecaca'}`,
                                padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700',
                                color: offlineStatus.isOnline ? '#92400e' : '#b91c1c'
                            }}>
                                <span style={{ animation: offlineStatus.syncing ? 'spin 1s linear infinite' : 'none' }}>
                                    {offlineStatus.syncing ? '↻' : (offlineStatus.isOnline ? '↑' : '⚠')}
                                </span>
                                {!offlineStatus.isOnline ? 'Offline' : 'Pending Sync'}
                                {offlineStatus.pendingCount > 0 && (
                                    <span style={{
                                        background: offlineStatus.isOnline ? '#d97706' : '#ef4444',
                                        color: 'white', padding: '0.1rem 0.4rem', borderRadius: '10px', fontSize: '0.65rem'
                                    }}>
                                        {offlineStatus.pendingCount}
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Sync / Refresh Button */}
                        <button
                            className="icon-btn"
                            onClick={handleRefresh}
                            title="Sync latest data"
                            style={{ position: 'relative' }}
                        >
                            <span style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                animation: isSyncing ? 'spin 1.2s linear infinite' : 'none',
                            }}>
                                <RefreshCw size={20} className={isSyncing ? "text-primary" : ""} />
                            </span>
                        </button>

                        <div style={{ position: 'relative' }}>
                            <button
                                className="icon-btn"
                                onClick={(e) => { e.stopPropagation(); setIsNotificationOpen(!isNotificationOpen); }}
                            >
                                <Bell size={20} />
                                {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
                            </button>
                            {isNotificationOpen && (
                                <div className="notifications-dropdown" onClick={(e) => e.stopPropagation()}>
                                    <div className="notifications-header">
                                        <h3>Notifications Overview</h3>
                                    </div>
                                    <div className="notifications-list">
                                        {notifications.length > 0 ? notifications.map(n => (
                                            <div key={n.id} className={`notification-item ${n.read ? 'read' : 'unread'}`}>
                                                <div className="notification-icon">{n.icon || '\u2139\uFE0F'}</div>
                                                <div className="notification-content">
                                                    <strong>{n.title}</strong>
                                                    <p>{n.message}</p>
                                                    <span className="notification-time">{n.time ? new Date(n.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</span>
                                                </div>
                                            </div>
                                        )) : (
                                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-tertiary)' }}>No recent operations logged</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div style={{ position: 'relative' }}>
                            <button
                                className="icon-btn"
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    setIsSettingsOpen(!isSettingsOpen); 
                                    setIsNotificationOpen(false); 
                                }}
                            >
                                <Settings size={20} />
                            </button>
                            {isSettingsOpen && (
                                <div className="notifications-dropdown" onClick={(e) => e.stopPropagation()}>
                                    <div className="notifications-header">
                                        <h3>System Settings</h3>
                                    </div>
                                    <div className="notifications-list" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Skeuomorphic Mode</span>
                                            <div style={{ background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)', width: '44px', height: '24px', borderRadius: '12px', position: 'relative', cursor: 'pointer' }}>
                                                <div style={{ width: '20px', height: '20px', background: 'linear-gradient(180deg, #ffffff 0%, #e2e8f0 100%)', borderRadius: '50%', position: 'absolute', right: '2px', top: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,1)' }}></div>
                                            </div>
                                        </div>
                                        <hr style={{ border: 'none', borderTop: '1px solid #cbd5e1' }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>AI Copilot Logging</span>
                                            <div style={{ background: 'linear-gradient(180deg, #10b981 0%, #059669 100%)', boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)', width: '44px', height: '24px', borderRadius: '12px', position: 'relative', cursor: 'pointer' }}>
                                                <div style={{ width: '20px', height: '20px', background: 'linear-gradient(180deg, #ffffff 0%, #e2e8f0 100%)', borderRadius: '50%', position: 'absolute', right: '2px', top: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,1)' }}></div>
                                            </div>
                                        </div>
                                        <hr style={{ border: 'none', borderTop: '1px solid #cbd5e1' }} />
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>App Version</span>
                                            <span style={{ color: 'var(--color-primary-main)', fontWeight: 800, fontSize: '0.9rem', padding: '0.25rem 0.5rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>v1.4.0 (Live)</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Sync Banner */}
                {isSyncing && (
                    <div style={{
                        background: 'linear-gradient(90deg, #10b981, #059669)',
                        color: '#fff',
                        textAlign: 'center',
                        padding: '0.4rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        letterSpacing: '0.05em',
                        animation: 'fadeIn 0.2s ease'
                    }}>
                        &#x27F3; Syncing latest data from all team members...
                    </div>
                )}

                {/* Page Content */}
                <div className="page-container">
                    {children}
                </div>
            </main>

            {/* Mobile Bottom Navigation */}
            <nav className="mobile-bottom-nav">
                <button
                    className={`mobile-nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
                    onClick={() => handleMobileTabChange('dashboard')}
                >
                    <span className="mobile-nav-icon">&#x1F4CA;</span>
                    <span className="mobile-nav-label">Home</span>
                </button>
                <button
                    className={`mobile-nav-btn ${activeTab === 'log-arrival' ? 'active' : ''}`}
                    onClick={() => handleMobileTabChange('log-arrival')}
                >
                    <span className="mobile-nav-icon">&#x1F4DD;</span>
                    <span className="mobile-nav-label">Log</span>
                </button>
                <button
                    className={`mobile-nav-btn ${activeTab === 'sampling' ? 'active' : ''}`}
                    onClick={() => handleMobileTabChange('sampling')}
                >
                    <span className="mobile-nav-icon">&#x1F52C;</span>
                    <span className="mobile-nav-label">Sampling</span>
                </button>
                <button
                    className={`mobile-nav-btn ${activeTab === 'containers-list' || activeTab === 'new-container' ? 'active' : ''}`}
                    onClick={() => handleMobileTabChange('containers-list')}
                >
                    <span className="mobile-nav-icon">&#x1F6A2;</span>
                    <span className="mobile-nav-label">Containers</span>
                </button>
                <button
                    className="mobile-nav-btn"
                    onClick={() => setIsMobileSidebarOpen(true)}
                >
                    <span className="mobile-nav-icon">&#x2630;</span>
                    <span className="mobile-nav-label">More</span>
                </button>
            </nav>
        </div>
    );
};

export default Layout;
