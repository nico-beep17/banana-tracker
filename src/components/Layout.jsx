import React, { useState, useEffect } from 'react';
import './Layout.css';

const Layout = ({ children, activeTab, onTabChange, userProfile, onLogout, notifications = [] }) => {
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
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

    return (
        <div className="layout" onClick={() => isNotificationOpen && setIsNotificationOpen(false)}>
            {/* Mobile Sidebar Overlay */}
            {isMobileSidebarOpen && (
                <div className="mobile-overlay" onClick={() => setIsMobileSidebarOpen(false)} />
            )}

            {/* Sidebar */}
            <aside className={`sidebar ${isMobileSidebarOpen ? 'sidebar-mobile-open' : ''}`}>
                <div className="sidebar-header">
                    <div className="logo">
                        <span className="logo-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🍌</span>
                        <h2 className="logo-text" style={{ fontSize: '1.2rem' }}>LAVC Operations</h2>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <ul className="nav-list">
                        <li className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => onTabChange('dashboard')}>
                            <span className="nav-icon">📊</span>
                            <span className="nav-text">Dashboard</span>
                        </li>

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Hub Receiver' || userProfile?.role === 'Production Manager' || userProfile?.role === 'Quality Manager') && (
                            <li className={`nav-item ${activeTab === 'log-arrival' ? 'active' : ''}`} onClick={() => onTabChange('log-arrival')}>
                                <span className="nav-icon">📝</span>
                                <span className="nav-text">Log Arrival</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Quality Manager' || userProfile?.role === 'Quality Supervisor') && (
                            <li className={`nav-item ${activeTab === 'sampling' ? 'active' : ''}`} onClick={() => onTabChange('sampling')}>
                                <span className="nav-icon">🔬</span>
                                <span className="nav-text">Daily Sampling</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Production Manager' || userProfile?.role === 'Production Supervisor') && (
                            <li className={`nav-item ${activeTab === 'farms' ? 'active' : ''}`} onClick={() => onTabChange('farms')}>
                                <span className="nav-icon">🌿</span>
                                <span className="nav-text">Farms & Growers</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Hub Operations In-Charge' || userProfile?.role === 'Shipping Documentation Supervisor' || userProfile?.role === 'Logistics Supervisor' || userProfile?.role === 'Hub Receiver') && (
                            <li className={`nav-item ${activeTab === 'new-container' || activeTab === 'containers-list' || activeTab === 'edit-container' ? 'active' : ''}`} onClick={() => onTabChange('containers-list')}>
                                <span className="nav-icon">🚢</span>
                                <span className="nav-text">Container Hub</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Hub Operations In-Charge' || userProfile?.role === 'Production Manager') && (
                            <li className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`} onClick={() => onTabChange('inventory')}>
                                <span className="nav-icon">📦</span>
                                <span className="nav-text">Materials Inventory</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Hub Operations In-Charge' || userProfile?.role === 'Shipping Documentation Supervisor' || userProfile?.role === 'Logistics Supervisor') && (
                            <li className={`nav-item ${activeTab === 'shipment-tracker' ? 'active' : ''}`} onClick={() => onTabChange('shipment-tracker')}>
                                <span className="nav-icon">🌍</span>
                                <span className="nav-text">Shipment Tracker</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Production Manager' || userProfile?.role === 'Quality Manager' || userProfile?.role === 'Accounting Staff') && (
                            <li className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => onTabChange('reports')}>
                                <span className="nav-icon">📈</span>
                                <span className="nav-text">Reports</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Accounting Staff' || userProfile?.role === 'Accounting Manager') && (
                            <li className={`nav-item ${activeTab === 'accounting' ? 'active' : ''}`} onClick={() => onTabChange('accounting')}>
                                <span className="nav-icon">🧾</span>
                                <span className="nav-text">Accounting & Billing</span>
                            </li>
                        )}

                        {(userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Accounting Manager' || userProfile?.role === 'HR Manager') && (
                            <li className={`nav-item ${activeTab === 'payroll' ? 'active' : ''}`} onClick={() => onTabChange('payroll')}>
                                <span className="nav-icon">👥</span>
                                <span className="nav-text">Payroll & HR</span>
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
                            <button onClick={onLogout} title="Sign Out" style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem' }}>
                                ⎋
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
                        <div style={{ position: 'relative' }}>
                            <button
                                className="icon-btn"
                                onClick={(e) => { e.stopPropagation(); setIsNotificationOpen(!isNotificationOpen); }}
                            >
                                🔔
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
                                                <div className="notification-icon">{n.icon || 'ℹ️'}</div>
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
                        <button className="icon-btn">⚙️</button>
                    </div>
                </header>

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
                    <span className="mobile-nav-icon">📊</span>
                    <span className="mobile-nav-label">Home</span>
                </button>
                <button
                    className={`mobile-nav-btn ${activeTab === 'log-arrival' ? 'active' : ''}`}
                    onClick={() => handleMobileTabChange('log-arrival')}
                >
                    <span className="mobile-nav-icon">📝</span>
                    <span className="mobile-nav-label">Log</span>
                </button>
                <button
                    className={`mobile-nav-btn ${activeTab === 'containers-list' || activeTab === 'new-container' ? 'active' : ''}`}
                    onClick={() => handleMobileTabChange('containers-list')}
                >
                    <span className="mobile-nav-icon">🚢</span>
                    <span className="mobile-nav-label">Containers</span>
                </button>
                <button
                    className={`mobile-nav-btn ${activeTab === 'reports' ? 'active' : ''}`}
                    onClick={() => handleMobileTabChange('reports')}
                >
                    <span className="mobile-nav-icon">📈</span>
                    <span className="mobile-nav-label">Reports</span>
                </button>
                <button
                    className="mobile-nav-btn"
                    onClick={() => setIsMobileSidebarOpen(true)}
                >
                    <span className="mobile-nav-icon">☰</span>
                    <span className="mobile-nav-label">More</span>
                </button>
            </nav>
        </div>
    );
};

export default Layout;
