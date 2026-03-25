import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { downloadCSV } from '../utils/exportUtils';
import ArrivalManifest from './ArrivalManifest';
import PinVerifyModal from './PinVerifyModal';
import { supabase } from '../supabaseClient';
import './ArrivalsTable.css';

const ArrivalsTable = ({ arrivals = [], onApproveArrival, onDeleteArrival, setArrivals, userProfile, samplings = [] }) => {
    const componentRef = useRef(null);
    const [selectedArrival, setSelectedArrival] = useState(null);

    // Edit modal state
    const [editingArrival, setEditingArrival] = useState(null);
    const [editForm, setEditForm] = useState({});

    // Double-confirm approval state
    const [confirmApprovalId, setConfirmApprovalId] = useState(null);

    // PIN verification state for override actions on APPROVED arrivals
    const [pinModal, setPinModal] = useState({ open: false, action: null, arrival: null });
    const [overrideOperator, setOverrideOperator] = useState(null); // tracks current override session

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
    const openEditForm = (arrival) => {
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

        let formattedDateTimeArrive = '';
        if (arrival.dateTimeArrive) {
            formattedDateTimeArrive = new Date(arrival.dateTimeArrive).toISOString().slice(0, 16);
        }

        setEditForm({
            farmName: arrival.farmName || '',
            driverName: arrival.driverName || '',
            plateNumber: arrival.plateNumber || '',
            deliveryReceipt: arrival.deliveryReceipt || '',
            dateTimeArrive: formattedDateTimeArrive,
            dateOfPacking: arrival.dateOfPacking || '',
            // Per-hands quantities
            quantities
        });
    };

    const handleEditClick = (arrival) => {
        const isApproved = arrival.approval_status === 'APPROVED';
        if (isApproved) {
            setPinModal({ open: true, action: 'edit', arrival });
        } else {
            openEditForm(arrival);
        }
    };

    const handleDeleteClick = (arrival) => {
        const isApproved = arrival.approval_status === 'APPROVED';
        if (isApproved) {
            setPinModal({ open: true, action: 'delete', arrival });
        } else {
            if (onDeleteArrival) onDeleteArrival(arrival.id, arrival.batchId);
        }
    };

    const handlePinVerified = async ({ operatorName }) => {
        const { action, arrival } = pinModal;
        setPinModal({ open: false, action: null, arrival: null });

        if (action === 'edit') {
            setOverrideOperator(operatorName);
            openEditForm(arrival);
        } else if (action === 'delete') {
            // Write audit log before deleting
            const batchId = arrival.batchId;
            const batchRows = batchId
                ? arrivals.filter(a => a.batchId === batchId)
                : arrivals.filter(a => a.id === arrival.id);

            await supabase.from('override_audit_logs').insert({
                action: 'DELETE',
                entity_type: 'ARRIVAL',
                entity_id: arrival.id,
                batch_id: batchId || null,
                container_id: null,
                old_data: batchRows,
                new_data: null,
                operator_name: operatorName
            });

            if (onDeleteArrival) onDeleteArrival(arrival.id, arrival.batchId);
        }
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
        try {
            if (!editingArrival || !setArrivals) return;

            const batchId = editingArrival.batchId;

            // Capture old data for audit log (only if this is an override)
            const batchRows = batchId
                ? arrivals.filter(a => a.batchId === batchId)
                : arrivals.filter(a => a.id === editingArrival.id);

            const oldDataSnapshot = batchRows.map(r => ({ id: r.id, typeId: r.typeId, quantity: r.quantity, farmName: r.farmName, driverName: r.driverName, deliveryReceipt: r.deliveryReceipt }));

            // 1. Update header fields on all batch rows
            const headerPayload = {
                farmName: editForm.farmName,
                driverName: editForm.driverName,
                plateNumber: editForm.plateNumber,
                deliveryReceipt: editForm.deliveryReceipt,
                dateTimeArrive: editForm.dateTimeArrive || new Date().toISOString(),
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

        // 2. Update individual row quantities & Insert any missing types
        const baseRow = batchRows[0];
        for (const typeId of Object.keys(editForm.quantities)) {
            const newQty = Number(editForm.quantities[typeId]) || 0;
            const existingRow = batchRows.find(r => r.typeId === typeId);
            
            if (existingRow) {
                if (newQty !== Number(existingRow.quantity)) {
                    const { error: updateError } = await supabase.from('arrivals').update({ quantity: newQty }).eq('id', existingRow.id);
                    if (updateError) alert(`Update error for ${typeId}: ${updateError.message}`);
                }
            } else if (newQty > 0) {
                let ccClass = 'A';
                if (typeId.includes('sh')) ccClass = 'S'; // 'S' for small or 'SH'
                if (typeId.includes('cla')) ccClass = 'A';
                if (typeId.includes('.rhb') || typeId.includes('.shb')) ccClass = 'B';
                if (typeId.includes('clb')) ccClass = 'B';
                if (typeId.includes('fp')) ccClass = 'B';

                let sizeCode = typeId.replace(/classA\.[a-z]+/, '').replace(/classB\.[a-z]+/, '').toUpperCase();
                let productSpecsCode = `${baseRow.brand || 'XXX'}${ccClass}${sizeCode}V135`;

                const newRowPayload = {
                    ...headerPayload,
                    batchId: baseRow.batchId || null,
                    farmCode: baseRow.farmCode,
                    typeId: typeId,
                    quantity: newQty,
                    brand: baseRow.brand || 'XXX',
                    ccClass: ccClass,
                    productSpecsCode: productSpecsCode,
                    dateTimeEncoded: baseRow.dateTimeEncoded || new Date().toISOString(),
                    approval_status: baseRow.approval_status
                };
                const { error: insertError } = await supabase.from('arrivals').insert([newRowPayload]);
                if (insertError) alert(`Insert error for ${typeId}: ${insertError.message}`);
            }
        }

        // 3. Write audit log if this was an override on an approved arrival
        if (overrideOperator) {
            const newDataSnapshot = { ...headerPayload, quantities: editForm.quantities };
            await supabase.from('override_audit_logs').insert({
                action: 'EDIT',
                entity_type: 'ARRIVAL',
                entity_id: editingArrival.id,
                batch_id: batchId || null,
                container_id: null,
                old_data: oldDataSnapshot,
                new_data: newDataSnapshot,
                operator_name: overrideOperator
            });
            setOverrideOperator(null);
        }

        // 4. Reload batch from DB to get fresh state
        let reloadQuery = supabase.from('arrivals').select('*');
        if (batchId) {
            reloadQuery = reloadQuery.eq('batchId', batchId);
        } else {
            reloadQuery = reloadQuery.eq('id', editingArrival.id);
        }
        const { data: freshData } = await reloadQuery;
        if (freshData && freshData.length > 0) {
            setArrivals(prev => {
                const withoutOldBatch = prev.filter(a => batchId ? a.batchId !== batchId : a.id !== editingArrival.id);
                return [...withoutOldBatch, ...freshData];
            });
        }

            setEditingArrival(null);
        } catch (err) {
            console.error(err);
            alert(`Execution Error during Save: ${err.message}`);
        }
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

    // Group arrivals by batchId — recompute totals and propagate approval from ANY row
    const groupedArrivals = arrivals.reduce((acc, arrival) => {
        const key = arrival.batchId || `${arrival.deliveryReceipt}-${arrival.dateOfPacking}`;
        if (!acc[key]) {
            acc[key] = {
                ...arrival,
                _liveTotal: 0,
            };
        }
        acc[key]._liveTotal += (Number(arrival.quantity) || 0);
        // If ANY row in the batch is approved, the whole batch is approved
        if (arrival.approval_status === 'APPROVED') {
            acc[key].approval_status = 'APPROVED';
        }
        return acc;
    }, {});

    const displayArrivals = Object.values(groupedArrivals).sort((a, b) => {
        return new Date(b.dateTimeEncoded || 0) - new Date(a.dateTimeEncoded || 0);
    });

    const handleExport = () => {
        const exportData = displayArrivals.map(a => {
            // Aggregate per-hands breakdown from all rows in this batch
            const batchId = a.batchId;
            const batchRows = batchId
                ? arrivals.filter(r => r.batchId === batchId)
                : arrivals.filter(r => r.id === a.id);

            const handsBreakdown = {};
            batchRows.forEach(row => {
                if (row.typeId) {
                    handsBreakdown[row.typeId] = (handsBreakdown[row.typeId] || 0) + (Number(row.quantity) || 0);
                }
            });

            // Calculate class subtotals
            const classASubtotal = classATypes.reduce((s, t) => s + (handsBreakdown[t] || 0), 0);
            const classBSubtotal = classBTypes.reduce((s, t) => s + (handsBreakdown[t] || 0), 0);

            return {
                'Batch ID': a.batchId || '-',
                'Date Arrived': a.dateTimeArrive ? a.dateTimeArrive.split('T')[0] : '-',
                'Time Arrived': a.dateTimeArrive ? a.dateTimeArrive.split('T')[1]?.substring(0, 5) : '-',
                'Farm Code': a.farmCode || '-',
                'Farm Name': a.farmName || '-',
                'Driver': a.driverName || '-',
                'Plate Number': a.plateNumber || 'N/A',
                'DR Number': a.deliveryReceipt || '-',
                'Total Boxes': a._liveTotal || 0,
                // Class A Per-Hands Breakdown
                'A-RHA 4H': handsBreakdown['classA.rha4'] || 0,
                'A-RHA 5H': handsBreakdown['classA.rha5'] || 0,
                'A-RHA 6H': handsBreakdown['classA.rha6'] || 0,
                'A-SHA 7H': handsBreakdown['classA.sha7'] || 0,
                'A-SHA 8H': handsBreakdown['classA.sha8'] || 0,
                'A-SHA 9H': handsBreakdown['classA.sha9'] || 0,
                'A-CLA': handsBreakdown['classA.cla'] || 0,
                'Class A Total': classASubtotal,
                // Class B Per-Hands Breakdown
                'B-RHB 4H': handsBreakdown['classB.rhb4'] || 0,
                'B-RHB 5H': handsBreakdown['classB.rhb5'] || 0,
                'B-RHB 6H': handsBreakdown['classB.rhb6'] || 0,
                'B-SHB 7H': handsBreakdown['classB.shb7'] || 0,
                'B-SHB 8H': handsBreakdown['classB.shb8'] || 0,
                'B-SHB 9H': handsBreakdown['classB.shb9'] || 0,
                'B-CLB': handsBreakdown['classB.clb'] || 0,
                'B-FP': handsBreakdown['classB.fp'] || 0,
                'Class B Total': classBSubtotal,
                'Status': a.approval_status || 'PENDING',
                'Encoded Timestamp (System)': a.dateTimeEncoded ? new Date(a.dateTimeEncoded).toLocaleString() : 'N/A'
            };
        });

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
                            const canApprove = userProfile?.role === 'Administrator' || userProfile?.role === 'Admin / Developer' || userProfile?.role === 'Hub Operations In-Charge' || userProfile?.role === 'Data Management Supervisor and Hub operations in-charge' || userProfile?.role === 'Production Supervisor';
                            const confirmKey = arrival.batchId || arrival.id;
                            const isConfirming = confirmApprovalId === confirmKey;

                            return (
                                <tr key={arrival.batchId || arrival.id || `fallback-row-${index}`}>
                                    <td data-label="Date">
                                        <div className="cell-primary" style={{ fontWeight: '700' }}>
                                            {arrival.dateTimeArrive ? arrival.dateTimeArrive.split('T')[0] : 'N/A'}
                                        </div>
                                        <div className="cell-secondary">
                                            {arrival.dateTimeArrive && arrival.dateTimeArrive.includes('T') ? arrival.dateTimeArrive.split('T')[1]?.substring(0,5) : ''}
                                        </div>
                                    </td>
                                    <td data-label="Farm">
                                        <div className="cell-primary" style={{ fontWeight: '700', color: 'var(--color-primary-dark)' }}>{arrival.farmName}</div>
                                        <div className="cell-secondary">{arrival.farmCode}</div>
                                    </td>
                                    <td data-label="Driver / DR">
                                        <div className="cell-primary badge-neutral">{arrival.driverName}</div>
                                        <div className="cell-secondary">DR: {arrival.deliveryReceipt}</div>
                                    </td>
                                    <td data-label="Boxes" className="text-right highlight-col">
                                        <span style={{ fontSize: '1.2rem', fontWeight: '800' }}>{arrival._liveTotal || 0}</span>
                                    </td>
                                    <td data-label="Status" className="text-center">
                                        {isApproved ? (
                                            <span className="status-badge" style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' }}>✓ Approved</span>
                                        ) : (
                                            <span className="status-badge" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white' }}>⏳ Pending</span>
                                        )}
                                    </td>
                                    <td data-label="" className="text-center">
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'stretch', width: '100%' }}>
                                            {!isApproved && canApprove && (
                                                <button
                                                    className="btn-primary"
                                                    onClick={() => handleApproveClick(arrival.id, arrival.batchId)}
                                                    style={{
                                                        padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: 'var(--border-radius-sm)',
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
                                            {/* Edit & Delete — always visible, PIN-gated for approved */}
                                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                                                <button
                                                    onClick={() => handleEditClick(arrival)}
                                                    style={{
                                                        flex: 1, background: isApproved ? '#fef3c7' : '#f8fafc',
                                                        border: `1px solid ${isApproved ? '#f59e0b' : '#cbd5e1'}`,
                                                        color: isApproved ? '#92400e' : '#475569',
                                                        padding: '0.3rem 0.4rem', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600'
                                                    }}
                                                >
                                                    {isApproved ? '🔒 Edit' : '✏️ Edit'}
                                                </button>
                                                {onDeleteArrival && (
                                                    <button
                                                        onClick={() => handleDeleteClick(arrival)}
                                                        style={{
                                                            flex: 1, background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
                                                            padding: '0.3rem 0.4rem', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600'
                                                        }}
                                                    >
                                                        {isApproved ? '🔒 Delete' : '🗑 Delete'}
                                                    </button>
                                                )}
                                            </div>
                                            <button
                                                className="btn-print"
                                                onClick={() => handlePrintClick(arrival)}
                                                style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', padding: '0.3rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer' }}
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

            {/* PIN Verification Modal */}
            <PinVerifyModal
                isOpen={pinModal.open}
                onClose={() => setPinModal({ open: false, action: null, arrival: null })}
                onVerified={handlePinVerified}
                actionLabel={pinModal.action === 'delete' ? 'Delete Override' : 'Edit Override'}
            />

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
