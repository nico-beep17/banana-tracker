import React, { useState, useEffect } from 'react';
import { RefreshCw, Bell, Settings, LayoutDashboard, ClipboardEdit, TestTubes, Leaf, Handshake, Ship, Package, Globe, LineChart, Calculator, Users, LogOut } from 'lucide-react';
import './Layout.css';

const Layout = ({ children, activeTab, onTabChange, userProfile, onLogout, notifications = [], onRefresh }) => {
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const unreadCount = notifications.filter(n => !n.read).length;

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

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Hub Receiver' || userProfile?.role === 'Production Manager' || userProfile?.role === 'Quality Manager') && (
                            <li className={`nav-item ${activeTab === 'log-arrival' ? 'active' : ''}`} onClick={() => onTabChange('log-arrival')}>
                                <span className="nav-icon"><ClipboardEdit size={20} /></span>
                                <span className="nav-text">Log Arrival</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Quality Manager' || userProfile?.role === 'Quality Supervisor') && (
                            <li className={`nav-item ${activeTab === 'sampling' ? 'active' : ''}`} onClick={() => onTabChange('sampling')}>
                                <span className="nav-icon"><TestTubes size={20} /></span>
                                <span className="nav-text">Daily Sampling</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Production Manager' || userProfile?.role === 'Production Supervisor') && (
                            <li className={`nav-item ${activeTab === 'farms' ? 'active' : ''}`} onClick={() => onTabChange('farms')}>
                                <span className="nav-icon"><Leaf size={20} /></span>
                                <span className="nav-text">Farms &amp; Growers</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Accounting Staff' || userProfile?.role === 'Accounting Manager' || userProfile?.role === 'Shipping Documentation Supervisor') && (
                            <li className={`nav-item ${activeTab === 'consignees' ? 'active' : ''}`} onClick={() => onTabChange('consignees')}>
                                <span className="nav-icon"><Handshake size={20} /></span>
                                <span className="nav-text">Consignees</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Hub Operations In-Charge' || userProfile?.role === 'Shipping Documentation Supervisor' || userProfile?.role === 'Logistics Supervisor' || userProfile?.role === 'Hub Receiver') && (
                            <li className={`nav-item ${activeTab === 'new-container' || activeTab === 'containers-list' || activeTab === 'edit-container' ? 'active' : ''}`} onClick={() => onTabChange('containers-list')}>
                                <span className="nav-icon"><Ship size={20} /></span>
                                <span className="nav-text">Container Hub</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Hub Operations In-Charge' || userProfile?.role === 'Production Manager') && (
                            <li className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => onTabChange('inventory')}>
                                <span className="nav-icon"><Package size={20} /></span>
                                <span className="nav-text">Materials Inventory</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Hub Operations In-Charge' || userProfile?.role === 'Shipping Documentation Supervisor' || userProfile?.role === 'Logistics Supervisor') && (
                            <li className={`nav-item ${activeTab === 'shipment-tracker' ? 'active' : ''}`} onClick={() => onTabChange('shipment-tracker')}>
                                <span className="nav-icon"><Globe size={20} /></span>
                                <span className="nav-text">Shipment Tracker</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Production Manager' || userProfile?.role === 'Quality Manager' || userProfile?.role === 'Accounting Staff') && (
                            <li className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => onTabChange('reports')}>
                                <span className="nav-icon"><LineChart size={20} /></span>
                                <span className="nav-text">Reports</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Accounting Staff' || userProfile?.role === 'Accounting Manager') && (
                            <li className={`nav-item ${activeTab === 'accounting' ? 'active' : ''}`} onClick={() => onTabChange('accounting')}>
                                <span className="nav-icon"><Calculator size={20} /></span>
                                <span className="nav-text">Accounting &amp; Billing</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Accounting Manager' || userProfile?.role === 'HR Manager') && (
                            <li className={`nav-item ${activeTab === 'payroll' ? 'active' : ''}`} onClick={() => onTabChange('payroll')}>
                                <span className="nav-icon"><Users size={20} /></span>
                                <span className="nav-text">Payroll &amp; HR</span>
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
                    <div className="header-search">
                        <input type="text" className="input-field" placeholder="Search arrivals, growers..." />
                    </div>
                    <div className="header-actions">
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
                    className={`mobile-nav-btn ${activeTab === 'containers-list' || activeTab === 'new-container' ? 'active' : ''}`}
                    onClick={() => handleMobileTabChange('containers-list')}
                >
                    <span className="mobile-nav-icon">&#x1F6A2;</span>
                    <span className="mobile-nav-label">Containers</span>
                </button>
                <button
                    className={`mobile-nav-btn ${activeTab === 'reports' ? 'active' : ''}`}
                    onClick={() => handleMobileTabChange('reports')}
                >
                    <span className="mobile-nav-icon">&#x1F4C8;</span>
                    <span className="mobile-nav-label">Reports</span>
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
