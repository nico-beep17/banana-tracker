import React, { useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import './Reports.css';
import { useArrivalsQuery, useContainersQuery, useSamplingsQuery } from '../queries/hooks';

const COLORS = ['#14b8a6', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

// Use absolute URL on native APK — relative URLs don't resolve in a Capacitor WebView
const AI_API_URL = window.Capacitor && window.Capacitor.isNativePlatform()
    ? 'https://banana-tracker-five.vercel.app/api/ai-insight'
    : '/api/ai-insight';

const SECTION_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ef4444'];

/**
 * Parses GPT markdown-like text (with **Heading** sections) into
 * clean styled section cards.
 */
function AiInsightRenderer({ text }) {
    // Split on **Section Title** pattern
    const raw = text.trim();
    const sectionRegex = /\*\*(.+?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    const titles = [];
    const positions = [];

    // Find all **title** positions
    while ((match = sectionRegex.exec(raw)) !== null) {
        titles.push(match[1]);
        positions.push({ start: match.index, end: sectionRegex.lastIndex });
    }

    if (titles.length === 0) {
        // No sections found — just render clean paragraphs
        return (
            <div style={{ marginTop: '1.25rem' }}>
                {raw.split('\n\n').filter(Boolean).map((para, i) => (
                    <p key={i} style={{ lineHeight: '1.75', fontSize: '0.93rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
                        {para.replace(/^[-–]\s*/gm, '• ')}
                    </p>
                ))}
            </div>
        );
    }

    // Extract body text between section titles
    const sections = titles.map((title, i) => {
        const bodyStart = positions[i].end;
        const bodyEnd = i + 1 < positions.length ? positions[i + 1].start : raw.length;
        const body = raw.slice(bodyStart, bodyEnd).trim();
        return { title, body };
    });

    const ICONS = ['📊', '🔬', '💰', '✅', '⚡'];

    return (
        <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {sections.map((section, i) => {
                const color = SECTION_COLORS[i % SECTION_COLORS.length];
                const lines = section.body.split('\n').filter(Boolean);
                return (
                    <div key={i} style={{
                        padding: '1rem 1.25rem',
                        borderLeft: `4px solid ${color}`,
                        borderRadius: '10px',
                        background: `rgba(${hexToRgb(color)}, 0.05)`,
                        border: `1px solid rgba(${hexToRgb(color)}, 0.18)`,
                        borderLeftColor: color,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '1rem' }}>{ICONS[i] || '•'}</span>
                            <strong style={{ fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.06em', color }}>{section.title}</strong>
                        </div>
                        <div style={{ fontSize: '0.9rem', lineHeight: '1.75', color: 'var(--text-primary)' }}>
                            {lines.map((line, j) => {
                                const isBullet = /^[-–•]/.test(line.trim());
                                const cleaned = line.replace(/^[-–•]\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1');
                                return (
                                    <p key={j} style={{ margin: '0.2rem 0', paddingLeft: isBullet ? '1rem' : '0', position: 'relative' }}>
                                        {isBullet && <span style={{ position: 'absolute', left: 0, color }}>•</span>}
                                        {cleaned}
                                    </p>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
}

const Reports = () => {
    const { data: arrivals = [] } = useArrivalsQuery();
    const { data: containers = [] } = useContainersQuery();
    const { data: samplings = [] } = useSamplingsQuery();

    const [aiInsight, setAiInsight] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');

    const approvedArrivals = useMemo(() => arrivals.filter(arr => arr.approval_status === 'APPROVED'), [arrivals]);

    // 1. Boxes by Day Bar Chart
    const boxesByDay = useMemo(() => {
        const data = {};
        approvedArrivals.forEach(arr => {
            const date = arr.dateOfPacking || arr.dateTimeEncoded?.split('T')[0] || 'Unknown';
            if (!data[date]) data[date] = { date, classA: 0, classB: 0 };
            const isA = arr.typeId ? arr.typeId.startsWith('classA') : (arr.ccClass === 'A' || arr.ccClass === 'Class A' || arr.ccClass === 'SH' || arr.ccClass === 'A (Cluster)');
            if (isA) data[date].classA += (Number(arr.quantity) || 0);
            else data[date].classB += (Number(arr.quantity) || 0);
        });
        return Object.values(data).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [approvedArrivals]);

    // 2. Total Volume Class Distribution (Pie Chart)
    const classDistribution = useMemo(() => {
        let aTotal = 0, bTotal = 0;
        approvedArrivals.forEach(arr => {
            const isA = arr.typeId ? arr.typeId.startsWith('classA') : (arr.ccClass === 'A' || arr.ccClass === 'Class A' || arr.ccClass === 'SH' || arr.ccClass === 'A (Cluster)');
            if (isA) aTotal += (Number(arr.quantity) || 0);
            else bTotal += (Number(arr.quantity) || 0);
        });
        return [{ name: 'Class A', value: aTotal }, { name: 'Class B', value: bTotal }];
    }, [approvedArrivals]);

    // 3. Stuffed Containers Output
    const stuffedData = useMemo(() => {
        let sealed = 0, packing = 0;
        containers.forEach(c => {
            if (c.timeSealed) sealed++;
            else if (c.totalBoxes > 0) packing++;
        });
        return [{ name: 'Sealed', value: sealed }, { name: 'Currently Packing', value: packing }];
    }, [containers]);

    // 4. Sampling QA Analytics
    const qcAnalytics = useMemo(() => {
        let totalBoxes = 0, passed = 0, downgraded = 0, rejected = 0;
        const defectHands = {};
        const farmComparison = {};
        samplings.forEach(s => {
            if (!farmComparison[s.farmName]) {
                farmComparison[s.farmName] = { name: s.farmName, passed: 0, downgraded: 0, rejected: 0, total: 0 };
            }
            if (s.boxes && Array.isArray(s.boxes)) {
                s.boxes.forEach(b => {
                    totalBoxes++;
                    farmComparison[s.farmName].total++;
                    if (b.decision === 'PROCEED' || b.decision === 'Passed' || b.decision?.startsWith('A-')) {
                        passed++; farmComparison[s.farmName].passed++;
                    } else if (b.decision === 'DOWNGRADED' || b.decision?.startsWith('B-')) {
                        downgraded++; farmComparison[s.farmName].downgraded++;
                        const ht = b.handsType || 'Unknown';
                        defectHands[ht] = (defectHands[ht] || 0) + 1;
                    } else if (b.decision === 'REJECTED' || b.decision?.startsWith('C-')) {
                        rejected++; farmComparison[s.farmName].rejected++;
                        const ht = b.handsType || 'Unknown';
                        defectHands[ht] = (defectHands[ht] || 0) + 1;
                    }
                });
            }
        });
        return {
            totalBoxes, passed, downgraded, rejected,
            overallDecisions: [{ name: 'Passed', value: passed }, { name: 'Downgraded', value: downgraded }, { name: 'Rejected', value: rejected }],
            handsComposition: Object.keys(defectHands).map(k => ({ name: k, value: defectHands[k] })),
            farmStats: Object.values(farmComparison)
        };
    }, [samplings]);

    // AI Analytics Summary
    const handleGenerateAiInsight = async () => {
        setAiLoading(true);
        setAiError('');
        setAiInsight('');

        const totalBoxes = approvedArrivals.reduce((s, a) => s + (Number(a.quantity) || 0), 0);
        const totalContainers = containers.length;
        const totalRevenue = containers.reduce((s, c) => s + (Number(c.totalBoxes || 0) * (Number(c.agreed_rate) || 0)), 0);
        const collected = containers.reduce((s, c) => s + (Number(c.amount_paid_partial) || 0), 0);
        const collectionRate = totalRevenue > 0 ? ((collected / totalRevenue) * 100).toFixed(1) : 'N/A';
        const downgradeRate = qcAnalytics.totalBoxes > 0 ? ((qcAnalytics.downgraded / qcAnalytics.totalBoxes) * 100).toFixed(1) : '0';
        const topFarms = Object.fromEntries(
            approvedArrivals.reduce((acc, a) => {
                acc.set(a.farmName || 'Unknown', (acc.get(a.farmName || 'Unknown') || 0) + (Number(a.quantity) || 0));
                return acc;
            }, new Map())
        );
        const topFarmsStr = Object.entries(topFarms).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, vol]) => `${name}: ${vol} boxes`).join(', ');

        const prompt = `You are an operations analyst for LAVC, a banana exporting company. Based on the following operational data summary, provide a concise executive intelligence report (3–4 paragraphs) covering: (1) overall performance, (2) quality / QA risks, (3) financial collection status, and (4) specific, actionable recommendations.

Data Summary:
- Total Approved Arrivals: ${approvedArrivals.length} logs, ${totalBoxes.toLocaleString()} boxes
- Total Containers: ${totalContainers} (${stuffedData.find(d => d.name === 'Sealed')?.value || 0} sealed, ${stuffedData.find(d => d.name === 'Currently Packing')?.value || 0} packing)
- Estimated Total Revenue: PHP ${totalRevenue.toLocaleString()} | Collected: PHP ${collected.toLocaleString()} (${collectionRate}% collection rate)
- Quality Sampling: ${qcAnalytics.totalBoxes} boxes sampled | Passed: ${qcAnalytics.passed} | Downgraded: ${qcAnalytics.downgraded} | Rejected: ${qcAnalytics.rejected} (Downgrade rate: ${downgradeRate}%)
- Top Contributing Farms: ${topFarmsStr || 'No data yet'}
- Pending Arrivals awaiting approval: ${arrivals.filter(a => a.approval_status === 'PENDING').length}

Write in a professional, concise tone. Use bullet points only for the recommendations section.`;

        try {
            const response = await fetch(AI_API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt }),
            });

            const text = await response.text();
            let data;
            try { data = JSON.parse(text); }
            catch { throw new Error('Invalid response from AI server. Check API key in Vercel env vars.'); }

            if (!response.ok) throw new Error(data.error || `Server error ${response.status}`);

            setAiInsight(data.result);
        } catch (err) {
            setAiError(err.message);
        } finally {
            setAiLoading(false);
        }
    };

    return (
        <div className="reports-container animation-fade-in">
            <header className="page-header" style={{ marginBottom: '2rem' }}>
                <h2>Analytics &amp; Reports</h2>
                <p>Gain insights from recent packing and dispatching operations.</p>
            </header>

            {/* AI Analytics Panel */}
            <div className="card report-card" style={{ marginBottom: '2rem', borderTop: '4px solid #8b5cf6', background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(139, 92, 246, 0.04) 100%)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h3 style={{ margin: '0 0 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>✨</span> AI Operations Intelligence
                        </h3>
                        <p className="subtitle" style={{ margin: 0 }}>GPT-powered analysis of your current operational data.</p>
                    </div>
                    <button
                        className="btn-primary"
                        onClick={handleGenerateAiInsight}
                        disabled={aiLoading}
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', boxShadow: '0 4px 14px rgba(139, 92, 246, 0.35)', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}
                    >
                        {aiLoading ? (
                            <><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⟳</span> Analyzing…</>
                        ) : (
                            <><span>✨</span> Generate AI Insight</>
                        )}
                    </button>
                </div>

                {aiError && (
                    <div style={{ marginTop: '1.25rem', padding: '0.85rem 1rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: '#dc2626', fontSize: '0.88rem' }}>
                        ⚠️ {aiError}
                    </div>
                )}

                {aiInsight && (
                    <AiInsightRenderer text={aiInsight} />
                )}

                {!aiInsight && !aiError && !aiLoading && (
                    <div style={{ marginTop: '1.25rem', padding: '1.5rem', background: 'rgba(139, 92, 246, 0.04)', border: '1px dashed rgba(139, 92, 246, 0.25)', borderRadius: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Click "Generate AI Insight" to get an executive-level analysis of your current operational data.
                    </div>
                )}
            </div>

            <div className="grid-2">
                {/* Arrivals Volume Chart */}
                <div className="card report-card">
                    <h3>Daily Receiving Volume</h3>
                    <p className="subtitle">Total boxes logged per day, categorized by Class.</p>
                    <div className="chart-wrapper" style={{ height: 300, marginTop: '1.5rem' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={boxesByDay}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="classA" name="Class A" stackId="a" fill="#14b8a6" radius={[0, 0, 4, 4]} />
                                <Bar dataKey="classB" name="Class B" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Packing Status */}
                <div className="card report-card">
                    <h3>Active Fleet Status</h3>
                    <p className="subtitle">Ratio of containers fully sealed vs packing.</p>
                    <div className="chart-wrapper" style={{ height: 300, marginTop: '1.5rem' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={stuffedData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                                    {stuffedData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Quality Assurance Section */}
            <div className="card report-card" style={{ marginTop: '2rem', borderTop: '4px solid #f59e0b' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>Quality Assurance &amp; Sampling Analytics</h3>
                <div className="grid-3" style={{ marginBottom: '2rem' }}>
                    <div style={{ background: 'var(--bg-surface)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                        <h4 style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Total Boxes Sampled</h4>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0', color: 'var(--color-primary-dark)' }}>{qcAnalytics.totalBoxes}</p>
                    </div>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                        <h4 style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>Total Downgraded</h4>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0', color: '#b45309' }}>{qcAnalytics.downgraded}</p>
                    </div>
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                        <h4 style={{ margin: 0, color: '#991b1b', fontSize: '0.9rem' }}>Total Rejected</h4>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0', color: '#b91c1c' }}>{qcAnalytics.rejected}</p>
                    </div>
                </div>

                <div className="grid-2">
                    <div>
                        <h4 style={{ marginBottom: '1rem' }}>Overall Decision Breakdown</h4>
                        <div style={{ height: 250 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={qcAnalytics.overallDecisions} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                                        label={({ name, percent }) => percent > 0 ? `${name} ${(percent * 100).toFixed(1)}%` : ''}>
                                        <Cell fill="#10b981" />
                                        <Cell fill="#f59e0b" />
                                        <Cell fill="#ef4444" />
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div>
                        <h4 style={{ marginBottom: '1rem' }}>Defect Composition by Hands Type</h4>
                        <div style={{ height: 250 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={qcAnalytics.handsComposition} layout="vertical" margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" />
                                    <YAxis dataKey="name" type="category" width={40} />
                                    <Tooltip />
                                    <Bar dataKey="value" name="Defective Boxes" fill="#f43f5e" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: '2rem' }}>
                    <h4 style={{ marginBottom: '1rem' }}>Farm Quality Comparison</h4>
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={qcAnalytics.farmStats} margin={{ bottom: 40 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" />
                                <YAxis />
                                <Tooltip />
                                <Legend verticalAlign="top" height={36} />
                                <Bar dataKey="passed" name="Passed" stackId="a" fill="#10b981" />
                                <Bar dataKey="downgraded" name="Downgraded" stackId="a" fill="#f59e0b" />
                                <Bar dataKey="rejected" name="Rejected" stackId="a" fill="#ef4444" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Class Distribution Overall */}
            <div className="card report-card" style={{ marginTop: '2rem' }}>
                <h3>Overall Class Production Output</h3>
                <p className="subtitle">Historical volume of Class A vs Class B.</p>
                <div className="chart-wrapper" style={{ height: 250, marginTop: '1.5rem' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={classDistribution} cx="50%" cy="50%" outerRadius={90}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                dataKey="value">
                                {classDistribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 0 ? '#14b8a6' : '#f59e0b'} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Reports;
