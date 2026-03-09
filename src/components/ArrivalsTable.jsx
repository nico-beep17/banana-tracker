import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { downloadCSV } from '../utils/exportUtils';
import ArrivalManifest from './ArrivalManifest';
import './ArrivalsTable.css';

const ArrivalsTable = ({ arrivals = [], onApproveArrival, userProfile, samplings = [] }) => {
    const componentRef = useRef(null);
    const [selectedArrival, setSelectedArrival] = useState(null);

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

    // Group arrivals by batchId (or DR+Date as fallback for older entries)
    const groupedArrivals = arrivals.reduce((acc, arrival) => {
        const key = arrival.batchId || `${arrival.deliveryReceipt}-${arrival.dateOfPacking}`;
        if (!acc[key]) {
            acc[key] = {
                ...arrival, // Keep base header details for the display row
                totalQuantity: 0,
            };
        }
        acc[key].totalQuantity += (Number(arrival.quantity) || 0);
        return acc;
    }, {});

    // Sort by latest encode time
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
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
                                            {!isApproved && canApprove ? (
                                                <button
                                                    className="btn-primary"
                                                    onClick={() => onApproveArrival(arrival.id, arrival.batchId)}
                                                    style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: 'var(--border-radius-sm)', width: '100%' }}
                                                >
                                                    Approve
                                                </button>
                                            ) : (
                                                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-tertiary)' }}>{isApproved ? 'VERIFIED' : '-'}</span>
                                            )}
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
