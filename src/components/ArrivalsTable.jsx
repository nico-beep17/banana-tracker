import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { downloadCSV } from '../utils/exportUtils';
import ArrivalManifest from './ArrivalManifest';
import './ArrivalsTable.css';

const ArrivalsTable = ({ arrivals = [], onApproveArrival, onDeleteArrival, setArrivals, userProfile, samplings = [] }) => {
    const componentRef = useRef(null);
    const [selectedArrival, setSelectedArrival] = useState(null);

    // Edit modal state
    const [editingArrival, setEditingArrival] = useState(null);
    const [editForm, setEditForm] = useState({});

    // Double-confirm approval state
    const [confirmApprovalId, setConfirmApprovalId] = useState(null);

    const handlePrint = useReactToPrint({
        documentTitle: `Arrival_Manifest_${selectedArrival?.batchId || selectedArrival?.id || 'Unknown'}`,
        contentRef: componentRef,
        content: () => componentRef.current,
    });

    const handlePrintClick = (arrival) => {
        setSelectedArrival(arrival);
        setTimeout(() => {
            handlePrint();
        }, 100);
    };

    // --- Edit handlers ---
    const handleEditClick = (arrival) => {
        setEditingArrival(arrival);

        // Build quantity grid from all individual arrival rows in this batch
        const batchId = arrival.batchId;
        const batchRows = batchId
            ? arrivals.filter(a => a.batchId === batchId)
            : arrivals.filter(a => a.id === arrival.id);

        const quantities = {};
        batchRows.forEach(row => {
            if (row.typeId) {
                quantities[row.typeId] = Number(row.quantity) || 0;
            }
        });

        setEditForm({
            farmName: arrival.farmName || '',
            driverName: arrival.driverName || '',
            plateNumber: arrival.plateNumber || '',
            deliveryReceipt: arrival.deliveryReceipt || '',
            dateTimeArrive: arrival.dateTimeArrive || '',
            dateOfPacking: arrival.dateOfPacking || '',
            // Per-hands quantities
            quantities
        });
    };

    const handleEditChange = (e) => {
        setEditForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleQtyChange = (typeId, value) => {
        setEditForm(prev => ({
            ...prev,
            quantities: { ...prev.quantities, [typeId]: value === '' ? '' : Number(value) }
        }));
    };

    const handleEditSave = async () => {
        if (!editingArrival || !setArrivals) return;

        const { supabase } = await import('../supabaseClient');
        const batchId = editingArrival.batchId;

        // 1. Update header fields on all batch rows
        const headerPayload = {
            farmName: editForm.farmName,
            driverName: editForm.driverName,
            plateNumber: editForm.plateNumber,
            deliveryReceipt: editForm.deliveryReceipt,
            dateTimeArrive: editForm.dateTimeArrive,
            dateOfPacking: editForm.dateOfPacking,
        };

        let headerQuery = supabase.from('arrivals').update(headerPayload);
        if (batchId) {
            headerQuery = headerQuery.eq('batchId', batchId);
        } else {
            headerQuery = headerQuery.eq('id', editingArrival.id);
        }
        const { error: headerError } = await headerQuery.select();
        if (headerError) {
            alert(`Failed to update arrival headers: ${headerError.message}`);
            return;
        }

        // 2. Update individual row quantities
        const batchRows = batchId
            ? arrivals.filter(a => a.batchId === batchId)
            : arrivals.filter(a => a.id === editingArrival.id);

        for (const row of batchRows) {
            if (row.typeId && editForm.quantities[row.typeId] !== undefined) {
                const newQty = Number(editForm.quantities[row.typeId]) || 0;
                if (newQty !== Number(row.quantity)) {
                    await supabase.from('arrivals').update({ quantity: newQty }).eq('id', row.id);
                }
            }
        }

        // 3. Reload batch from DB to get fresh state
        let reloadQuery = supabase.from('arrivals').select('*');
        if (batchId) {
            reloadQuery = reloadQuery.eq('batchId', batchId);
        } else {
            reloadQuery = reloadQuery.eq('id', editingArrival.id);
        }
        const { data: freshData } = await reloadQuery;
        if (freshData && freshData.length > 0) {
            const freshMap = new Map(freshData.map(item => [item.id, item]));
            setArrivals(prev => prev.map(a => freshMap.has(a.id) ? freshMap.get(a.id) : a));
        }

        setEditingArrival(null);
    };

    // Type labels for display
    const typeLabels = {
        'classA.rha4': '4H', 'classA.rha5': '5H', 'classA.rha6': '6H',
        'classA.sha7': '7H', 'classA.sha8': '8H', 'classA.sha9': '9H', 'classA.cla': 'CLA',
        'classB.rhb4': '4H', 'classB.rhb5': '5H', 'classB.rhb6': '6H',
        'classB.shb7': '7H', 'classB.shb8': '8H', 'classB.shb9': '9H',
        'classB.clb': 'CLB', 'classB.fp': 'FP'
    };
    const classATypes = ['classA.rha4', 'classA.rha5', 'classA.rha6', 'classA.sha7', 'classA.sha8', 'classA.sha9', 'classA.cla'];
    const classBTypes = ['classB.rhb4', 'classB.rhb5', 'classB.rhb6', 'classB.shb7', 'classB.shb8', 'classB.shb9', 'classB.clb', 'classB.fp'];

    // --- Approve double-confirm ---
    const handleApproveClick = (arrivalId, batchId) => {
        if (confirmApprovalId === (batchId || arrivalId)) {
            // Second click — actually approve
            onApproveArrival(arrivalId, batchId);
            setConfirmApprovalId(null);
        } else {
            // First click — set confirm state
            setConfirmApprovalId(batchId || arrivalId);
            // Auto-reset after 5 seconds if no second click
            setTimeout(() => setConfirmApprovalId(prev => prev === (batchId || arrivalId) ? null : prev), 5000);
        }
    };

    if (!arrivals || arrivals.length === 0) {
        return (
            <div className="card content-section">
                <h2>Arrivals Log</h2>
                <div className="placeholder-state">
                    <div className="placeholder-content">
                        <span className="placeholder-icon">📋</span>
                        <p>No arrivals logged yet.</p>
                        <span className="placeholder-sub">New arrivals will appear here once submitted.</span>
                    </div>
                </div>
            </div>
        );
    }

    // Group arrivals by batchId — recompute totals from live rows every render
    const groupedArrivals = arrivals.reduce((acc, arrival) => {
        const key = arrival.batchId || `${arrival.deliveryReceipt}-${arrival.dateOfPacking}`;
        if (!acc[key]) {
            acc[key] = {
                ...arrival,
                _liveTotal: 0,
            };
        }
        acc[key]._liveTotal += (Number(arrival.quantity) || 0);
        return acc;
    }, {});

    const displayArrivals = Object.values(groupedArrivals).sort((a, b) => {
        return new Date(b.dateTimeEncoded || 0) - new Date(a.dateTimeEncoded || 0);
    });

    const handleExport = () => {
        const exportData = displayArrivals.map(a => ({
            'Batch ID': a.batchId || '-',
            'Date Arrived': a.dateTimeArrive ? a.dateTimeArrive.split('T')[0] : '-',
            'Time Arrived': a.dateTimeArrive ? a.dateTimeArrive.split('T')[1]?.substring(0, 5) : '-',
            'Farm Code': a.farmCode || '-',
            'Farm Name': a.farmName || '-',
            'Driver': a.driverName || '-',
            'Plate Number': a.plateNumber || 'N/A',
            'DR Number': a.deliveryReceipt || '-',
            'Total Boxes': a._liveTotal || 0,
            'Status': a.approval_status || 'PENDING',
            'Encoded Timestamp (System)': a.dateTimeEncoded ? new Date(a.dateTimeEncoded).toLocaleString() : 'N/A'
        }));

        const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
        downloadCSV(exportData, `Arrivals_Log_Report_${timestampStr}.xlsx`);
    };

    return (
        <div className="banana-table-container shadow-lg animation-fade-in" style={{ marginTop: '2rem' }}>
            <div className="table-header-row" style={{ padding: '1.5rem', borderBottom: '2px solid var(--border-color)' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--color-primary-dark)' }}>Recent Arrivals</h2>
                <button className="btn-secondary btn-sm" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    📊 Export to Excel
                </button>
            </div>

            <div className="table-responsive">
                <table className="banana-table">
                    <thead>
                        <tr>
                            <th>Date Arrived</th>
                            <th>Farm / Region</th>
                            <th>Driver & DR#</th>
                            <th className="text-right">Total Boxes</th>
                            <th className="text-center">Status</th>
                            <th className="text-center">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayArrivals.map((arrival, index) => {
                            const isApproved = arrival.approval_status === 'APPROVED';
                            const canApprove = userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Hub Operations In-Charge' || userProfile?.role === 'Data Management Supervisor and Hub operations in-charge';
                            const confirmKey = arrival.batchId || arrival.id;
                            const isConfirming = confirmApprovalId === confirmKey;

                            return (
                                <tr key={arrival.batchId || arrival.id || `fallback-row-${index}`}>
                                    <td>
                                        <div className="cell-primary" style={{ fontWeight: '700' }}>
                                            {arrival.dateTimeArrive ? arrival.dateTimeArrive.split('T')[0] : 'N/A'}
                                        </div>
                                        <div className="cell-secondary">
                                            {arrival.dateTimeArrive && arrival.dateTimeArrive.includes('T') ? arrival.dateTimeArrive.split('T')[1] : ''}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="cell-primary" style={{ fontWeight: '700', color: 'var(--color-primary-dark)' }}>{arrival.farmName}</div>
                                        <div className="cell-secondary">{arrival.farmCode}</div>
                                    </td>
                                    <td>
                                        <div className="cell-primary badge-neutral">{arrival.driverName}</div>
                                        <div className="cell-secondary">DR: {arrival.deliveryReceipt}</div>
                                    </td>
                                    <td className="text-right highlight-col">
                                        <span style={{ fontSize: '1.2rem', fontWeight: '800' }}>{arrival._liveTotal || 0}</span>
                                    </td>
                                    <td className="text-center">
                                        {isApproved ? (
                                            <span className="status-badge" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}>✓ Approved</span>
                                        ) : (
                                            <span className="status-badge" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white' }}>⏳ Pending</span>
                                        )}
                                    </td>
                                    <td className="text-center">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'center' }}>
                                            {/* Approve with double-confirm */}
                                            {!isApproved && canApprove && (
                                                <button
                                                    className="btn-primary"
                                                    onClick={() => handleApproveClick(arrival.id, arrival.batchId)}
                                                    style={{
                                                        padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: 'var(--border-radius-sm)', width: '100%',
                                                        background: isConfirming ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : undefined,
                                                        animation: isConfirming ? 'pulse 0.6s ease-in-out infinite' : undefined
                                                    }}
                                                >
                                                    {isConfirming ? 'Confirm Approve?' : 'Approve'}
                                                </button>
                                            )}
                                            {isApproved && (
                                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-tertiary)' }}>VERIFIED</span>
                                            )}

                                            {/* Edit & Delete row — hidden when approved */}
                                            {!isApproved && (
                                                <div style={{ display: 'flex', gap: '0.35rem', width: '100%' }}>
                                                    <button
                                                        onClick={() => handleEditClick(arrival)}
                                                        style={{
                                                            flex: 1, background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569',
                                                            padding: '0.3rem 0.4rem', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600'
                                                        }}
                                                    >
                                                        ✏️ Edit
                                                    </button>
                                                    {onDeleteArrival && (
                                                        <button
                                                            onClick={() => onDeleteArrival(arrival.id, arrival.batchId)}
                                                            style={{
                                                                flex: 1, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
                                                                padding: '0.3rem 0.4rem', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600'
                                                            }}
                                                        >
                                                            🗑 Delete
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Print */}
                                            <button
                                                className="btn-print"
                                                onClick={() => handlePrintClick(arrival)}
                                                style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer', width: '100%' }}
                                            >
                                                🖨️ Print
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Edit Modal */}
            {editingArrival && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
                    <div className="card animation-fade-in" style={{ padding: '2rem', maxWidth: '700px', width: '95%', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
                        <button onClick={() => setEditingArrival(null)} style={{ position: 'absolute', top: '15px', right: '15px', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-tertiary)', background: 'none', border: 'none' }}>×</button>
                        <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-primary-dark)' }}>Edit Arrival</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                            Batch: <strong>{editingArrival.batchId || editingArrival.id}</strong>
                        </p>

                        {/* Delivery Header Fields */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
                            <div className="form-group">
                                <label className="label">Farm Name</label>
                                <input type="text" name="farmName" className="input-field" value={editForm.farmName} onChange={handleEditChange} style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div className="form-group">
                                <label className="label">Driver Name</label>
                                <input type="text" name="driverName" className="input-field" value={editForm.driverName} onChange={handleEditChange} style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div className="form-group">
                                <label className="label">Plate Number</label>
                                <input type="text" name="plateNumber" className="input-field" value={editForm.plateNumber} onChange={handleEditChange} style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div className="form-group">
                                <label className="label">Delivery Receipt #</label>
                                <input type="text" name="deliveryReceipt" className="input-field" value={editForm.deliveryReceipt} onChange={handleEditChange} style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div className="form-group">
                                <label className="label">Date of Packing</label>
                                <input type="date" name="dateOfPacking" className="input-field" value={editForm.dateOfPacking} onChange={handleEditChange} style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                            <div className="form-group">
                                <label className="label">Date & Time Arrived</label>
                                <input type="datetime-local" name="dateTimeArrive" className="input-field" value={editForm.dateTimeArrive} onChange={handleEditChange} style={{ width: '100%', boxSizing: 'border-box' }} />
                            </div>
                        </div>

                        {/* Per-Hands Quantity Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {/* Class A */}
                            <div style={{ border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem', background: '#f0fdf4' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <h4 style={{ margin: 0, color: '#166534', fontSize: '0.9rem' }}>Class A</h4>
                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#166534' }}>
                                        {classATypes.reduce((s, t) => s + (Number(editForm.quantities?.[t]) || 0), 0)} bxs
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                                    {classATypes.map(typeId => (
                                        <div key={typeId} className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="label" style={{ fontSize: '0.7rem', marginBottom: '2px' }}>{typeLabels[typeId]}</label>
                                            <input
                                                type="number" min="0" className="input-field"
                                                style={{ padding: '0.35rem', fontSize: '0.85rem', textAlign: 'center' }}
                                                value={editForm.quantities?.[typeId] ?? ''}
                                                onChange={(e) => handleQtyChange(typeId, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Class B */}
                            <div style={{ border: '1px solid #fde68a', borderRadius: '8px', padding: '1rem', background: '#fffbeb' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <h4 style={{ margin: 0, color: '#92400e', fontSize: '0.9rem' }}>Class B</h4>
                                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#92400e' }}>
                                        {classBTypes.reduce((s, t) => s + (Number(editForm.quantities?.[t]) || 0), 0)} bxs
                                    </span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                                    {classBTypes.map(typeId => (
                                        <div key={typeId} className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="label" style={{ fontSize: '0.7rem', marginBottom: '2px' }}>{typeLabels[typeId]}</label>
                                            <input
                                                type="number" min="0" className="input-field"
                                                style={{ padding: '0.35rem', fontSize: '0.85rem', textAlign: 'center' }}
                                                value={editForm.quantities?.[typeId] ?? ''}
                                                onChange={(e) => handleQtyChange(typeId, e.target.value)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Grand Total */}
                        <div style={{ marginTop: '1rem', textAlign: 'right', fontSize: '0.95rem', fontWeight: '700', color: 'var(--color-primary-dark)' }}>
                            Grand Total: {[...classATypes, ...classBTypes].reduce((s, t) => s + (Number(editForm.quantities?.[t]) || 0), 0)} boxes
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                            <button className="btn-secondary" onClick={() => setEditingArrival(null)} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
                            <button className="btn-primary" onClick={handleEditSave} style={{ padding: '0.5rem 1.5rem' }}>Save Changes</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden component solely for printing */}
            <div style={{ display: 'none' }}>
                <ArrivalManifest
                    ref={componentRef}
                    arrival={selectedArrival}
                    samplings={samplings}
                    allArrivals={arrivals}
                />
            </div>
        </div>
    );
};

export default ArrivalsTable;
