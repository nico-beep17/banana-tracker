import React, { useMemo } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import './Reports.css';

const COLORS = ['#14b8a6', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

const Reports = ({ arrivals = [], containers = [], samplings = [] }) => {

    const approvedArrivals = useMemo(() => arrivals.filter(arr => arr.approval_status === 'APPROVED'), [arrivals]);

    // 1. Boxes by Day Bar Chart
    const boxesByDay = useMemo(() => {
        const data = {};
        approvedArrivals.forEach(arr => {
            const date = arr.dateOfPacking || arr.dateTimeEncoded?.split('T')[0] || 'Unknown';
            if (!data[date]) data[date] = { date, classA: 0, classB: 0 };

            const isA = arr.typeId ? arr.typeId.startsWith('classA') : (arr.ccClass === 'A' || arr.ccClass === 'Class A' || arr.ccClass === 'SH' || arr.ccClass === 'A (Cluster)');
            if (isA) {
                data[date].classA += (Number(arr.quantity) || 0);
            } else {
                data[date].classB += (Number(arr.quantity) || 0);
            }
        });
        return Object.values(data).sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [approvedArrivals]);

    // 2. Total Volume Class Distribution (Pie Chart)
    const classDistribution = useMemo(() => {
        let aTotal = 0;
        let bTotal = 0;
        approvedArrivals.forEach(arr => {
            const isA = arr.typeId ? arr.typeId.startsWith('classA') : (arr.ccClass === 'A' || arr.ccClass === 'Class A' || arr.ccClass === 'SH' || arr.ccClass === 'A (Cluster)');
            if (isA) aTotal += (Number(arr.quantity) || 0);
            else bTotal += (Number(arr.quantity) || 0);
        });
        return [
            { name: 'Class A', value: aTotal },
            { name: 'Class B', value: bTotal }
        ];
    }, [approvedArrivals]);

    // 3. Stuffed Containers Output
    const stuffedData = useMemo(() => {
        let sealed = 0;
        let packing = 0;
        containers.forEach(c => {
            if (c.timeSealed) sealed++;
            else if (c.totalBoxes > 0) packing++;
        });
        return [
            { name: 'Sealed', value: sealed },
            { name: 'Currently Packing', value: packing }
        ]
    }, [containers]);

    // 4. Sampling QA Analytics 
    const qcAnalytics = useMemo(() => {
        let totalBoxes = 0;
        let passed = 0;
        let downgraded = 0;
        let rejected = 0;

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

                    if (b.decision === 'PROCEED' || b.decision === 'Passed') {
                        passed++;
                        farmComparison[s.farmName].passed++;
                    } else if (b.decision === 'DOWNGRADED') {
                        downgraded++;
                        farmComparison[s.farmName].downgraded++;

                        const ht = b.handsType || 'Unknown';
                        defectHands[ht] = (defectHands[ht] || 0) + 1;
                    } else if (b.decision === 'REJECTED') {
                        rejected++;
                        farmComparison[s.farmName].rejected++;

                        const ht = b.handsType || 'Unknown';
                        defectHands[ht] = (defectHands[ht] || 0) + 1;
                    }
                });
            }
        });

        const overallDecisions = [
            { name: 'Passed', value: passed },
            { name: 'Downgraded', value: downgraded },
            { name: 'Rejected', value: rejected }
        ];

        const handsComposition = Object.keys(defectHands).map(k => ({ name: k, value: defectHands[k] }));
        const farmStats = Object.values(farmComparison);

        return { totalBoxes, passed, downgraded, rejected, overallDecisions, handsComposition, farmStats };
    }, [samplings]);

    return (
        <div className="reports-container animation-fade-in">
            <header className="page-header" style={{ marginBottom: '2rem' }}>
                <h2>Analytics & Reports</h2>
                <p>Gain insights from recent packing and dispatching operations.</p>
            </header>

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

                {/* Packing Status / Container Output */}
                <div className="card report-card">
                    <h3>Active Fleet Status</h3>
                    <p className="subtitle">Ratio of containers fully sealed vs packing.</p>
                    <div className="chart-wrapper" style={{ height: 300, marginTop: '1.5rem' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stuffedData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
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
                <h3 style={{ marginBottom: '1.5rem' }}>Quality Assurance & Sampling Analytics</h3>

                <div className="grid-3" style={{ marginBottom: '2rem' }}>
                    <div style={{ backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                        <h4 style={{ margin: 0, color: 'var(--color-text-light)', fontSize: '0.9rem' }}>Total Boxes Sampled</h4>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0', color: 'var(--color-primary-dark)' }}>{qcAnalytics.totalBoxes}</p>
                    </div>
                    <div style={{ backgroundColor: '#fef3c7', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
                        <h4 style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>Total Downgraded</h4>
                        <p style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0.5rem 0 0 0', color: '#b45309' }}>{qcAnalytics.downgraded}</p>
                    </div>
                    <div style={{ backgroundColor: '#fee2e2', padding: '1rem', borderRadius: '8px', textAlign: 'center' }}>
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
                                    <Pie
                                        data={qcAnalytics.overallDecisions}
                                        cx="50%" cy="50%" outerRadius={80}
                                        dataKey="value"
                                        label={({ name, percent }) => percent > 0 ? `${name} ${(percent * 100).toFixed(1)}%` : ''}
                                    >
                                        <Cell fill="#10b981" /> {/* Passed */}
                                        <Cell fill="#f59e0b" /> {/* Downgraded */}
                                        <Cell fill="#ef4444" /> {/* Rejected */}
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
                            <Pie
                                data={classDistribution}
                                cx="50%"
                                cy="50%"
                                outerRadius={90}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                dataKey="value"
                            >
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
