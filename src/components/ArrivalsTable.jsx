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
        setEditForm({
            farmName: arrival.farmName || '',
            driverName: arrival.driverName || '',
            plateNumber: arrival.plateNumber || '',
            deliveryReceipt: arrival.deliveryReceipt || '',
            dateTimeArrive: arrival.dateTimeArrive || '',
            dateOfPacking: arrival.dateOfPacking || '',
        });
    };

    const handleEditChange = (e) => {
        setEditForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleEditSave = async () => {
        if (!editingArrival || !setArrivals) return;

        // We need supabase to update. Import dynamically since it may not be available as prop.
        const { supabase } = await import('../supabaseClient');

        // Update all arrivals in this batch
        const batchId = editingArrival.batchId;
        const updatePayload = {
            farmName: editForm.farmName,
            driverName: editForm.driverName,
            plateNumber: editForm.plateNumber,
            deliveryReceipt: editForm.deliveryReceipt,
            dateTimeArrive: editForm.dateTimeArrive,
            dateOfPacking: editForm.dateOfPacking,
        };

        let query = supabase.from('arrivals').update(updatePayload);
        if (batchId) {
            query = query.eq('batchId', batchId);
        } else {
            query = query.eq('id', editingArrival.id);
        }

        const { data, error } = await query.select();

        if (error) {
            console.error('Supabase error (Edit Arrival):', error);
            alert(`Failed to update arrival: ${error.message}`);
            return;
        }

        if (data && data.length > 0) {
            const updatedMap = new Map(data.map(item => [item.id, item]));
            setArrivals(prev => prev.map(a => updatedMap.has(a.id) ? updatedMap.get(a.id) : a));
        }

        setEditingArrival(null);
    };

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

    // Group arrivals by batchId
    const groupedArrivals = arrivals.reduce((acc, arrival) => {
        const key = arrival.batchId || `${arrival.deliveryReceipt}-${arrival.dateOfPacking}`;
        if (!acc[key]) {
            acc[key] = {
                ...arrival,
                totalQuantity: 0,
            };
        }
        acc[key].totalQuantity += (Number(arrival.quantity) || 0);
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
            'Total Boxes': a.totalQuantity || 0,
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
                                        <span style={{ fontSize: '1.2rem', fontWeight: '800' }}>{arrival.totalQuantity || 0}</span>
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

                                            {/* Edit & Delete row */}
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
                    <div className="card animation-fade-in" style={{ padding: '2rem', maxWidth: '520px', width: '90%', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
                        <button onClick={() => setEditingArrival(null)} style={{ position: 'absolute', top: '15px', right: '15px', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-tertiary)', background: 'none', border: 'none' }}>×</button>
                        <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-primary-dark)' }}>Edit Arrival</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                            Batch: <strong>{editingArrival.batchId || editingArrival.id}</strong>
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
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
