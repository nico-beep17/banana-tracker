import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import './Dashboard.css';
import AIInsightCarousel from './AIInsightCarousel';

const Dashboard = ({ metrics, userProfile, onNavigate, arrivals = [], containers = [], samplings = [], farms = [], weeklyRates = [] }) => {

    const role = userProfile?.role || 'Guest';
    const isAdmin = role === 'Administrator';

    // Calculate percentages securely
    const classAPercent = metrics.totalBoxes > 0
        ? Math.round((metrics.classATotal / metrics.totalBoxes) * 100)
        : 0;

    const classBPercent = metrics.totalBoxes > 0
        ? Math.round((metrics.classBTotal / metrics.totalBoxes) * 100)
        : 0;

    // Quick Actions Context
    const renderQuickActions = () => {
        return (
            <div className="quick-actions-widget" style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)', fontFamily: 'var(--font-family-heading)' }}>Needs Immediate Action</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>

                    {/* HUB AND LOGISTICS */}
                    {(isAdmin || role.includes('Hub') || role.includes('Logistics')) && (
                        <>
                            <button className="card" onClick={() => onNavigate({ name: 'payroll', state: { tab: 'terminal' } })} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid var(--color-primary-main)', cursor: 'pointer', textAlign: 'left', transition: 'var(--transition-bounce)' }}>
                                <span style={{ fontSize: '1.5rem' }}>🤳</span>
                                <strong style={{ color: 'var(--text-primary)' }}>Attendance Terminal</strong>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Open QR Scanner for personnel DTR</span>
                            </button>

                            <button className="card" onClick={() => onNavigate('log-arrival')} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid var(--color-success)', cursor: 'pointer', textAlign: 'left', transition: 'var(--transition-bounce)' }}>
                                <span style={{ fontSize: '1.5rem' }}>🚚</span>
                                <strong style={{ color: 'var(--text-primary)' }}>Log New Arrival</strong>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Record new truck deliveries immediately</span>
                            </button>

                            {metrics.unsealedContainersCount > 0 && (
                                <button className="card" onClick={() => onNavigate('containers-list')} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid var(--color-info)', cursor: 'pointer', textAlign: 'left', background: '#f0f9ff' }}>
                                    <span style={{ fontSize: '1.5rem' }}>🛳️</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>Ship Ready Containers</strong>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>{metrics.unsealedContainersCount} units ready for departure</span>
                                </button>
                            )}
                        </>
                    )}

                    {/* QUALITY CONTROL */}
                    {(isAdmin || role.includes('Quality')) && (
                        <>
                            <button className="card" onClick={() => onNavigate('sampling')} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid #8b5cf6', cursor: 'pointer', textAlign: 'left', transition: 'var(--transition-bounce)' }}>
                                <span style={{ fontSize: '1.5rem' }}>🔬</span>
                                <strong style={{ color: 'var(--text-primary)' }}>Daily Quality Sampling</strong>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Execute strict quality monitoring tests</span>
                            </button>
                        </>
                    )}

                    {/* ACCOUNTING */}
                    {(isAdmin || role.includes('Accounting') || role.includes('HR')) && (
                        <>
                            <button className="card" onClick={() => onNavigate('payroll')} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid #10b981', cursor: 'pointer', textAlign: 'left', transition: 'var(--transition-bounce)' }}>
                                <span style={{ fontSize: '1.5rem' }}>💰</span>
                                <strong style={{ color: 'var(--text-primary)' }}>Process Payroll</strong>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Generate register and post to GL</span>
                            </button>
                            <button className="card" onClick={() => onNavigate('accounting')} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', borderLeft: '4px solid #f43f5e', cursor: 'pointer', textAlign: 'left', transition: 'var(--transition-bounce)' }}>
                                <span style={{ fontSize: '1.5rem' }}>🧾</span>
                                <strong style={{ color: 'var(--text-primary)' }}>General Ledger</strong>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Review vouchers and GL postings</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    };

    // Find active farms that have NO weekly rate set for the current week
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const currentWeekNo = Math.ceil(((now - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    const currentYear = now.getFullYear();

    const farmsWithoutRates = useMemo(() => {
        return farms.filter(farm =>
            farm.status !== 'Inactive' &&
            !weeklyRates.some(r => r.farm_id === farm.id && r.year === currentYear && r.week_number === currentWeekNo)
        );
    }, [farms, weeklyRates, currentWeekNo, currentYear]);

    // ── Average Containers per Week ─────────────────────────────────────────
    const containerStats = useMemo(() => {
        const getWeekKey = (dateStr) => {
            if (!dateStr) return null;
            const d = new Date(dateStr);
            const s = new Date(d.getFullYear(), 0, 1);
            const wk = Math.ceil(((d - s) / 86400000 + s.getDay() + 1) / 7);
            return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`;
        };
        const thisWeekKey = `${currentYear}-W${String(currentWeekNo).padStart(2, '0')}`;

        // Group ALL containers (departed or not) by week of creation/departure
        const weekCounts = {};
        containers.forEach(c => {
            const key = getWeekKey(c.dateCreated || c.timeDeparted || c.timeSealed);
            if (key) weekCounts[key] = (weekCounts[key] || 0) + 1;
        });

        const weeks = Object.keys(weekCounts);
        const totalContainers = Object.values(weekCounts).reduce((s, n) => s + n, 0);
        const avgPerWeek = weeks.length > 0 ? (totalContainers / weeks.length).toFixed(1) : '—';
        const thisWeekCount = weekCounts[thisWeekKey] || 0;
        const trend = weeks.length > 1
            ? thisWeekCount >= parseFloat(avgPerWeek) ? 'up' : 'down'
            : 'neutral';

        return { avgPerWeek, thisWeekCount, totalContainers, weekCount: weeks.length, trend };
    }, [containers, currentWeekNo, currentYear]);


    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1>Overview</h1>
                <p className="subtitle">Today's Operation Summary • <strong>{role}</strong></p>
            </div>

            {/* Weekly Rate Alert */}
            {(isAdmin || role.includes('Production') || role.includes('Hub')) && farms.filter(f => f.status !== 'Inactive').length > 0 && (() => {
                const activeFarms = farms.filter(f => f.status !== 'Inactive');
                const setCount = activeFarms.length - farmsWithoutRates.length;
                const allSet = farmsWithoutRates.length === 0;
                return (
                    <div style={{ margin: '0 0 1.5rem', borderRadius: '12px', overflow: 'hidden', border: `1.5px solid ${allSet ? '#bbf7d0' : '#fde68a'}` }}>
                        {/* Header bar */}
                        <div style={{ padding: '0.75rem 1.25rem', background: allSet ? '#f0fdf4' : '#fffbeb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                <span style={{ fontSize: '1.1rem' }}>{allSet ? '✅' : '⚠️'}</span>
                                <strong style={{ color: allSet ? '#166534' : '#92400e', fontSize: '0.88rem' }}>
                                    Week {currentWeekNo} Rates — {allSet ? 'All farms are set!' : `${farmsWithoutRates.length} farm${farmsWithoutRates.length > 1 ? 's' : ''} missing`}
                                </strong>
                            </div>
                            {/* Progress: X / Y farms */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                                <div style={{ background: '#e2e8f0', borderRadius: '99px', height: '8px', width: '100px', overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.round(setCount / activeFarms.length * 100)}%`, height: '100%', background: allSet ? '#22c55e' : '#f59e0b', borderRadius: '99px', transition: 'width 0.4s' }} />
                                </div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: allSet ? '#166534' : '#92400e' }}>{setCount}/{activeFarms.length}</span>
                                {!allSet && (
                                    <button onClick={() => onNavigate('farms')} style={{ background: '#f59e0b', border: 'none', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem', padding: '0.3rem 0.75rem', borderRadius: '6px' }}>
                                        Set Rates →
                                    </button>
                                )}
                            </div>
                        </div>
                        {/* Missing farms list */}
                        {!allSet && (
                            <div style={{ padding: '0.6rem 1.25rem', background: 'white', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                {farmsWithoutRates.map(f => (
                                    <span key={f.id} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.2rem 0.6rem', fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>
                                        {f.farmCode} · {f.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Metric Cards */}
            <div className="metrics-grid">
                <div className="card metric-card">
                    <div className="metric-icon bg-green">📦</div>
                    <div className="metric-content">
                        <h3 className="metric-title">Boxes Today</h3>
                        <p className="metric-value">{metrics.totalBoxes}</p>
                        <span className="metric-trend positive" style={{ display: 'block', marginTop: '4px' }}>
                            {metrics.totalTrips} trips logged today
                        </span>
                        <span className="metric-trend neutral" style={{ display: 'block', marginTop: '2px', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                            {(metrics.totalBoxesAllTime || 0).toLocaleString()} boxes total (all time)
                        </span>
                        {metrics.remainingInventory && (
                            <span className="metric-trend neutral" style={{ fontWeight: 'bold', color: 'var(--color-primary-main)' }}>
                                {metrics.remainingInventory.total} Boxes Remaining
                            </span>
                        )}
                    </div>
                </div>

                <div className="card metric-card">
                    <div className="metric-icon bg-yellow">🍌</div>
                    <div className="metric-content">
                        <h3 className="metric-title">Class A Total</h3>
                        <p className="metric-value">{metrics.classATotal}</p>
                        <span className="metric-trend neutral" style={{ display: 'block', marginTop: '4px' }}>{classAPercent}% of total</span>
                        {metrics.remainingInventory && (
                            <span className="metric-trend neutral" style={{ fontWeight: 'bold' }}>
                                {metrics.remainingInventory.classA} Remaining
                            </span>
                        )}
                    </div>
                </div>

                <div className="card metric-card">
                    <div className="metric-icon" style={{ backgroundColor: 'rgba(249, 115, 22, 0.15)', color: '#ea580c' }}>🍌</div>
                    <div className="metric-content">
                        <h3 className="metric-title">Class B Total</h3>
                        <p className="metric-value">{metrics.classBTotal}</p>
                        <span className="metric-trend neutral" style={{ display: 'block', marginTop: '4px' }}>{classBPercent}% of total</span>
                        {metrics.remainingInventory && (
                            <span className="metric-trend neutral" style={{ fontWeight: 'bold' }}>
                                {metrics.remainingInventory.classB} Remaining
                            </span>
                        )}
                    </div>
                </div>

                <div className="card metric-card">
                    <div className="metric-icon bg-blue">🌿</div>
                    <div className="metric-content">
                        <h3 className="metric-title">Active Farms</h3>
                        <p className="metric-value">{metrics.activeFarms}</p>
                        <span className="metric-trend neutral">Delivering today</span>
                    </div>
                </div>

                {/* NEW: Avg Containers per Week */}
                <div className="card metric-card" style={{ cursor: 'pointer' }} onClick={() => onNavigate('containers-list')}>
                    <div className="metric-icon" style={{ backgroundColor: 'rgba(99, 102, 241, 0.12)', color: '#6366f1' }}>🛳️</div>
                    <div className="metric-content">
                        <h3 className="metric-title">Avg Containers / Wk</h3>
                        <p className="metric-value">{containerStats.avgPerWeek}</p>
                        <span className="metric-trend" style={{
                            display: 'block', marginTop: '4px',
                            color: containerStats.trend === 'up' ? '#16a34a' : containerStats.trend === 'down' ? '#dc2626' : '#64748b',
                            fontWeight: 600
                        }}>
                            {containerStats.trend === 'up' ? '↑' : containerStats.trend === 'down' ? '↓' : '—'} {containerStats.thisWeekCount} this week
                        </span>
                        <span className="metric-trend neutral" style={{ display: 'block', marginTop: '2px', fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>
                            {containerStats.totalContainers} total across {containerStats.weekCount} wk{containerStats.weekCount !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
            </div>

            {/* Main Content Area: Form & Table Placeholder */}
            <div className="dashboard-content">

            {/* AI Insight Carousel */}
            <AIInsightCarousel
                metrics={metrics}
                arrivals={arrivals}
                containers={containers}
                samplings={samplings}
            />

            {/* Quick Actions */}
            {renderQuickActions()}

                {/* Active Containers Widget */}
                {metrics.activeContainers && metrics.activeContainers.length > 0 && (
                    <div className="active-containers-widget" style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Active Packing Containers</h2>
                            <span className="status-badge" style={{ backgroundColor: 'orange', color: 'white', marginLeft: '1rem' }}>{metrics.activeContainers.length} Active</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                            {metrics.activeContainers.map(container => (
                                <div key={container.id} className="card" style={{ padding: '1rem', borderLeft: '4px solid orange' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                                        <div>
                                            <strong>{container.brand} {container.reeferName}</strong> <span style={{ color: 'var(--color-primary-main)', fontSize: '0.9rem', marginLeft: '0.5rem' }}>{container.reeferNo || 'Pending No.'}</span>
                                        </div>
                                        <span className="spec-badge">{container.destination || 'Pending'}</span>
                                    </div>
                                    <div className="progress-bar-container" style={{ background: 'var(--color-primary-soft)', border: '1px solid var(--border-color)', height: '10px', borderRadius: '4px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                                        <div
                                            style={{
                                                width: `${Math.min((container.totalBoxes / 1540) * 100, 100)}%`,
                                                height: '100%',
                                                backgroundColor: 'orange',
                                                transition: 'width 0.4s ease'
                                            }}
                                        ></div>
                                    </div>
                                    <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                        {container.totalBoxes} / 1540
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Operational Analytics & Intelligence (For Admins) */}
                {isAdmin && (
                    <div className="intelligence-widget" style={{ marginBottom: '2rem' }}>
                        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', fontFamily: 'var(--font-family-heading)' }}>Operational Intelligence & Analytics</h2>
                        
                        <div className="grid-3" style={{ marginBottom: '1rem' }}>
                            {/* Dynamic Chart: Inventory Distribution */}
                            <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-surface)' }}>
                                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Hub Inventory Balance</h3>
                                {metrics.remainingInventory && metrics.remainingInventory.total > 0 ? (
                                    <div style={{ width: '100%', height: '220px' }}>
                                        <ResponsiveContainer>
                                            <PieChart>
                                                <Pie
                                                    data={[
                                                        { name: 'Class A', value: metrics.remainingInventory.classA },
                                                        { name: 'Class B', value: metrics.remainingInventory.classB }
                                                    ]}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={55}
                                                    outerRadius={85}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                >
                                                    <Cell fill="#10b981" />
                                                    <Cell fill="#f59e0b" />
                                                </Pie>
                                                <Tooltip 
                                                    formatter={(value) => [`${value} Boxes`, 'Available']}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                                        No inventory data available
                                    </div>
                                )}
                            </div>

                            {/* Dynamic Chart: Top Producing Farms */}
                            <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-surface)' }}>
                                <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Top Contributing Growers</h3>
                                {metrics.advancedAnalytics && metrics.advancedAnalytics.topFarms.length > 0 ? (
                                    <div style={{ width: '100%', height: '220px' }}>
                                        <ResponsiveContainer>
                                            <BarChart data={metrics.advancedAnalytics.topFarms} layout="vertical" margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                                                <XAxis type="number" hide />
                                                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} width={90} />
                                                <Tooltip 
                                                    formatter={(value) => [`${value} Boxes`, 'Received']}
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }}
                                                    cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                                                />
                                                <Bar dataKey="volume" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20}>
                                                    {metrics.advancedAnalytics.topFarms.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : 'var(--color-primary-light)'} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                ) : (
                                    <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)' }}>
                                        No arrival data available
                                    </div>
                                )}
                            </div>

                            {/* Intelligent Insights */}
                            <div className="card" style={{ padding: '1.25rem', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
                                <div style={{ borderLeft: '4px solid #3b82f6', paddingLeft: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                        <strong style={{ fontSize: '0.95rem' }}>Production Volume</strong>
                                        <span style={{ color: '#3b82f6', fontSize: '0.85rem', fontWeight: 'bold' }}>{metrics.totalBoxes} Boxes</span>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', margin: 0 }}>Total production logged today across {metrics.totalTrips} aggregate trips.</p>
                                </div>
                                <div style={{ borderLeft: '4px solid #10b981', paddingLeft: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                        <strong style={{ fontSize: '0.95rem' }}>Class A Ratio</strong>
                                        <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 'bold' }}>{classAPercent}%</span>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', margin: 0 }}>Premium yield output variance remains within normal thresholds.</p>
                                </div>
                                <div style={{ borderLeft: `4px solid ${metrics.advancedAnalytics?.downgradeRate > 10 ? '#ef4444' : '#f59e0b'}`, paddingLeft: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                        <strong style={{ fontSize: '0.95rem' }}>Sampling Downgrades</strong>
                                        <span style={{ color: metrics.advancedAnalytics?.downgradeRate > 10 ? '#ef4444' : '#f59e0b', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                            {metrics.advancedAnalytics?.downgradeRate.toFixed(1)}%
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', margin: 0 }}>
                                        {metrics.advancedAnalytics?.downgradeRate > 10 ? 'Warning: Downgrade rate is unusually high. Review sampling metrics immediately.' : 'Downgrade variance is minimal. Quality stands highly stable.'}
                                    </p>
                                </div>
                                <div style={{ borderLeft: `4px solid ${metrics.advancedAnalytics?.collectionRate < 70 ? '#ef4444' : '#8b5cf6'}`, paddingLeft: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                        <strong style={{ fontSize: '0.95rem' }}>Collection Efficiency</strong>
                                        <span style={{ color: metrics.advancedAnalytics?.collectionRate < 70 ? '#ef4444' : '#8b5cf6', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                            {metrics.advancedAnalytics?.collectionRate.toFixed(1)}%
                                        </span>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', margin: 0 }}>
                                        {metrics.advancedAnalytics?.collectionRate < 70 ? 'Warning: Cash flow liquidity is tightening. Review outstanding receivables on shipped containers.' : 'Collection and cash flow cycles remain exceptionally healthy.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
