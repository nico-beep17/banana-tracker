import React from 'react';
import { getEnhancedDestination } from '../utils/locationUtils';

const ContainerManifest = React.forwardRef(({ container, style }, ref) => {
    if (!container) return null;

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr === 'N/A' || dateStr === '-') return 'Pending';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    };

    const isFull = (container.totalBoxes >= 1540);
    const isEmpty = container.totalBoxes === 0;
    const isDeparted = !!container.timeDeparted;
    const isSealed = !!container.timeSealed;

    const statusLabel = isDeparted ? 'DEPARTED' : (isSealed ? 'SEALED' : (isFull ? 'FULL' : (isEmpty ? 'EMPTY' : 'PACKING')));

    // Map type keys to human-readable labels for per-hands breakdown
    const typeLabels = {
        'classA.rha4': 'A - RHA 4H', 'classA.rha5': 'A - RHA 5H', 'classA.rha6': 'A - RHA 6H',
        'classA.sha7': 'A - SHA 7H', 'classA.sha8': 'A - SHA 8H', 'classA.sha9': 'A - SHA 9H', 'classA.cla': 'A - CLA',
        'classB.rhb4': 'B - RHB 4H', 'classB.rhb5': 'B - RHB 5H', 'classB.rhb6': 'B - RHB 6H',
        'classB.shb7': 'B - SHB 7H', 'classB.shb8': 'B - SHB 8H', 'classB.shb9': 'B - SHB 9H',
        'classB.clb': 'B - CLB', 'classB.fp': 'B - FP'
    };

    // Aggregate per-hands totals across all stuffed entries
    const aggregateHandsTotals = () => {
        const totals = {};
        (container.stuffedItems || []).forEach(item => {
            if (item.data) {
                Object.keys(item.data).forEach(classGroup => {
                    const classObj = item.data[classGroup];
                    Object.keys(classObj).forEach(sizeKey => {
                        const val = Number(classObj[sizeKey]) || 0;
                        if (val > 0) {
                            const typeKey = `${classGroup}.${sizeKey}`;
                            totals[typeKey] = (totals[typeKey] || 0) + val;
                        }
                    });
                });
            }
        });
        return totals;
    };

    const handsTotals = aggregateHandsTotals();
    const classAHandsEntries = Object.entries(handsTotals).filter(([k]) => k.startsWith('classA'));
    const classBHandsEntries = Object.entries(handsTotals).filter(([k]) => k.startsWith('classB'));

    return (
        <div ref={ref} style={{ padding: '50px', fontFamily: '"Inter", "Segoe UI", Arial, sans-serif', color: '#1e293b', backgroundColor: '#fff', ...style }}>
            <div style={{ borderBottom: '3px solid #166534', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ margin: '0 0 5px 0', fontSize: '32px', color: '#0f172a', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
                        Dispatch Manifest
                    </h1>
                    <div style={{ display: 'inline-block', backgroundColor: '#166534', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '14px', fontWeight: '700' }}>
                        ID: {container.id.substring(0, 8).toUpperCase()} • {statusLabel}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#64748b', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>LFJ AGRI-VENTURES CORPORATION</div>
                    <div style={{ fontSize: '14px' }}><strong>Date Printed:</strong> {new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
                <div style={{ border: '1px solid #e2e8f0', overflow: 'hidden', borderRadius: '8px' }}>
                    <h3 style={{ margin: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 15px', fontSize: '16px', color: '#0f172a' }}>Logistics Details</h3>
                    <div style={{ padding: '15px' }}>
                        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Reefer Name:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{container.reeferName || 'N/A'}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Brand:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{container.brand || 'N/A'}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Container No:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{container.reeferNo || 'N/A'}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Seal No:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{container.sealNo || 'N/A'}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Destination:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{getEnhancedDestination(container.destination)}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Driver:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{container.driver || container.driverName || 'N/A'}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Plate No:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{container.plateNo || 'N/A'}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div style={{ border: '1px solid #e2e8f0', overflow: 'hidden', borderRadius: '8px' }}>
                    <h3 style={{ margin: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 15px', fontSize: '16px', color: '#0f172a' }}>Temperature & Timings</h3>
                    <div style={{ padding: '15px' }}>
                        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Set Temp:</td><td style={{ fontWeight: '700', padding: '6px 0', color: '#b91c1c' }}>{container.temperature || 'N/A'} °C</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Ventilation:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{container.ventilation || 'N/A'}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Gross Weight:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{container.grossWeight ? `${Number(container.grossWeight).toLocaleString()} kg` : 'N/A'}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Net Weight:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{container.netWeight ? `${Number(container.netWeight).toLocaleString()} kg` : 'N/A'}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Arrival Hub:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{formatDate(container.timeArrHub)}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Loading Start:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{formatDate(container.timeStarted)}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Loading End:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{formatDate(container.timeEnded)}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Time Sealed:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{formatDate(container.timeSealed)}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Time Departed:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{formatDate(container.timeDeparted)}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>BPI Sticker:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{container.bpiSticker || 'N/A'}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Per-Hands Segregation Summary */}
            {(classAHandsEntries.length > 0 || classBHandsEntries.length > 0) && (
                <div style={{ marginBottom: '30px' }}>
                    <div style={{ marginBottom: '12px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>Per-Hands Segregation Summary</h3>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>(Aggregated Totals by Type)</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* Class A */}
                        {classAHandsEntries.length > 0 && (
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                <div style={{ backgroundColor: '#f0fdf4', padding: '10px 15px', borderBottom: '1px solid #bbf7d0' }}>
                                    <span style={{ fontWeight: '700', color: '#166534', fontSize: '14px' }}>Class A</span>
                                    <span style={{ float: 'right', fontWeight: '700', color: '#166534', fontSize: '13px' }}>
                                        {classAHandsEntries.reduce((s, [, v]) => s + v, 0).toLocaleString()} boxes
                                    </span>
                                </div>
                                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                                    <tbody>
                                        {classAHandsEntries.map(([key, count]) => (
                                            <tr key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '7px 15px', color: '#475569' }}>{typeLabels[key] || key}</td>
                                                <td style={{ padding: '7px 15px', textAlign: 'right', fontWeight: '700' }}>{count.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {/* Class B */}
                        {classBHandsEntries.length > 0 && (
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                <div style={{ backgroundColor: '#fffbeb', padding: '10px 15px', borderBottom: '1px solid #fde68a' }}>
                                    <span style={{ fontWeight: '700', color: '#92400e', fontSize: '14px' }}>Class B</span>
                                    <span style={{ float: 'right', fontWeight: '700', color: '#92400e', fontSize: '13px' }}>
                                        {classBHandsEntries.reduce((s, [, v]) => s + v, 0).toLocaleString()} boxes
                                    </span>
                                </div>
                                <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                                    <tbody>
                                        {classBHandsEntries.map(([key, count]) => (
                                            <tr key={key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '7px 15px', color: '#475569' }}>{typeLabels[key] || key}</td>
                                                <td style={{ padding: '7px 15px', textAlign: 'right', fontWeight: '700' }}>{count.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Container Content Payload</h3>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>(Historical Loading Records)</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '14px', marginBottom: '20px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f8fafc' }}>
                        <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Event Timestamp</th>
                        <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Class A</th>
                        <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Class B</th>
                        <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Subtotal Boxes</th>
                    </tr>
                </thead>
                <tbody>
                    {container.stuffedItems && container.stuffedItems.length > 0 ? (
                        container.stuffedItems.map((item, index) => {
                            // Compute class A and class B sub-totals for this entry
                            let entryClassA = 0;
                            let entryClassB = 0;
                            if (item.data) {
                                Object.keys(item.data).forEach(cg => {
                                    const cObj = item.data[cg];
                                    const groupSum = Object.values(cObj).reduce((s, v) => s + (Number(v) || 0), 0);
                                    if (cg.startsWith('classA')) entryClassA += groupSum;
                                    else entryClassB += groupSum;
                                });
                            }
                            const isLast = index === container.stuffedItems.length - 1;
                            return (
                                <tr key={index}>
                                    <td style={{ padding: '10px 15px', borderBottom: isLast ? 'none' : '1px solid #f1f5f9' }}>{formatDate(item.timestamp)}</td>
                                    <td style={{ padding: '10px 15px', borderBottom: isLast ? 'none' : '1px solid #f1f5f9', color: '#166534', fontWeight: '600' }}>{entryClassA > 0 ? `${entryClassA.toLocaleString()} bx` : '—'}</td>
                                    <td style={{ padding: '10px 15px', borderBottom: isLast ? 'none' : '1px solid #f1f5f9', color: '#92400e', fontWeight: '600' }}>{entryClassB > 0 ? `${entryClassB.toLocaleString()} bx` : '—'}</td>
                                    <td style={{ padding: '10px 15px', textAlign: 'right', fontWeight: '700', borderBottom: isLast ? 'none' : '1px solid #f1f5f9' }}>{item.total.toLocaleString()}</td>
                                </tr>
                            );
                        })
                    ) : (
                        <tr>
                            <td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>No box entries recorded for this container.</td>
                        </tr>
                    )}
                </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px', gap: '16px' }}>
                {(container.grossWeight || container.netWeight) && (
                    <div style={{ textAlign: 'right', minWidth: '200px', padding: '20px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                        <div style={{ color: '#475569', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '8px' }}>Weight Summary</div>
                        {container.grossWeight && (
                            <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                                <span style={{ color: '#64748b' }}>Gross: </span>
                                <span style={{ fontWeight: '700' }}>{Number(container.grossWeight).toLocaleString()} kg</span>
                            </div>
                        )}
                        {container.netWeight && (
                            <div style={{ fontSize: '14px' }}>
                                <span style={{ color: '#64748b' }}>Net: </span>
                                <span style={{ fontWeight: '700' }}>{Number(container.netWeight).toLocaleString()} kg</span>
                            </div>
                        )}
                    </div>
                )}
                <div style={{ textAlign: 'right', minWidth: '240px', padding: '20px', backgroundColor: '#f0fdf4', border: '2px solid #166534', borderRadius: '12px' }}>
                    <div style={{ color: '#166534', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Final Allocation</div>
                    <div style={{ color: '#14532d', fontSize: '24px', fontWeight: '800' }}>
                        {container.totalBoxes?.toLocaleString() || 0} <span style={{ fontSize: '16px', color: '#166534', fontWeight: '600' }}>/ 1,540 Boxes</span>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '100px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '100px' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '2px solid #0f172a', paddingTop: '10px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700' }}>Inspector / Checker Signature</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>Operations In-Charge</div>
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '2px solid #0f172a', paddingTop: '10px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700' }}>Driver Signature</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>Logistics Personnel</div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '10px', borderTop: '1px dashed #e2e8f0', paddingTop: '10px' }}>
                Generated by LFJ ERP Banana Tracker | System Report ID: {container.id}
            </div>
        </div>
    );
});

export default ContainerManifest;
