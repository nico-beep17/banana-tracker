import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { downloadCSV } from '../utils/exportUtils';
import { getPortCountry } from '../utils/locationUtils';
import ContainerManifest from './ContainerManifest';
import PinVerifyModal from './PinVerifyModal';
import { useContainersQuery } from '../queries/hooks';
import { canPerformAction } from '../utils/permissions';
import './ContainersList.css';

const getCountry = (dest) => getPortCountry(dest);

const ContainersList = ({ onNavigate, onDepartContainer, onSealContainer, onEditPayload, onDeletePayload, userProfile }) => {
    const { data: containers = [] } = useContainersQuery();
    const componentRef = useRef();
    const [selectedContainer, setSelectedContainer] = useState(null);
    const [breakdownContainer, setBreakdownContainer] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 15;

    // Payload manager state
    const [managingContainerId, setManagingContainerId] = useState(null);
    const managingContainer = managingContainerId ? containers.find(c => c.id === managingContainerId) : null;
    const [editingPayload, setEditingPayload] = useState(null);
    const [payloadEditForm, setPayloadEditForm] = useState(null);
    const [pinModal, setPinModal] = useState({ open: false, action: null, containerId: null, payloadId: null, payloadData: null });

    const handlePrint = useReactToPrint({
        documentTitle: `Container_Manifest_${selectedContainer?.id || 'Unknown'}`,
        contentRef: componentRef,
        content: () => componentRef.current, // Supports older versions as fallback
    });

    const handlePrintClick = (container) => {
        setSelectedContainer(container);
        setTimeout(() => {
            handlePrint();
        }, 100);
    };

    const handleExport = () => {
        const exportData = containers.map(c => {
            // Aggregate per-hands breakdown from stuffedItems
            const handsBreakdown = {};
            (c.stuffedItems || []).forEach(item => {
                if (item.data) {
                    Object.keys(item.data).forEach(classGroup => {
                        const classObj = item.data[classGroup];
                        Object.keys(classObj).forEach(sizeKey => {
                            const typeKey = `${classGroup}.${sizeKey}`;
                            handsBreakdown[typeKey] = (handsBreakdown[typeKey] || 0) + (Number(classObj[sizeKey]) || 0);
                        });
                    });
                }
            });

            const classASubtotal = classATypes.reduce((s, t) => s + (handsBreakdown[t] || 0), 0);
            const classBSubtotal = classBTypes.reduce((s, t) => s + (handsBreakdown[t] || 0), 0);

            return {
                'Container ID': c.id,
                'Date Created': new Date(c.dateCreated || 0).toLocaleDateString(),
                'Creation Timestamp': new Date(c.dateCreated || 0).toLocaleString(),
                'Brand': c.brand || '-',
                'Reefer Name': c.reeferName || '-',
                'Container No.': c.reeferNo || '-',
                'Seal No.': c.sealNo || '-',
                'Destination': c.destination || '-',
                'Driver': c.driver || '-',
                'Plate No.': c.plateNo || '-',
                'Total Boxes': c.totalBoxes || 0,
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
                'Status': c.timeDeparted ? 'DEPARTED' : (c.timeSealed ? 'SEALED' : (c.totalBoxes >= 1540 ? 'FULL' : (c.totalBoxes === 0 ? 'EMPTY' : 'PACKING'))),
                'Time Started Loading': c.timeStarted ? new Date(c.timeStarted).toLocaleString() : '-',
                'Time Ended Loading': c.timeEnded ? new Date(c.timeEnded).toLocaleString() : '-',
                'Time Sealed': c.timeSealed ? new Date(c.timeSealed).toLocaleString() : '-',
                'Time Departed Hub': c.timeDeparted ? new Date(c.timeDeparted).toLocaleString() : '-'
            };
        });

        const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
        downloadCSV(exportData, `Containers_List_Report_${timestampStr}.xlsx`);
    };

    // --- Payload management helpers ---
    const typeLabels = {
        'classA.rha4': '4H', 'classA.rha5': '5H', 'classA.rha6': '6H',
        'classA.sha7': '7H', 'classA.sha8': '8H', 'classA.sha9': '9H', 'classA.cla': 'CLA',
        'classB.rhb4': '4H', 'classB.rhb5': '5H', 'classB.rhb6': '6H',
        'classB.shb7': '7H', 'classB.shb8': '8H', 'classB.shb9': '9H',
        'classB.clb': 'CLB', 'classB.fp': 'FP'
    };
    const classATypes = ['classA.rha4', 'classA.rha5', 'classA.rha6', 'classA.sha7', 'classA.sha8', 'classA.sha9', 'classA.cla'];
    const classBTypes = ['classB.rhb4', 'classB.rhb5', 'classB.rhb6', 'classB.shb7', 'classB.shb8', 'classB.shb9', 'classB.clb', 'classB.fp'];

    const handlePayloadEditClick = (containerId, payload) => {
        setPinModal({ open: true, action: 'edit', containerId, payloadId: payload.id, payloadData: payload });
    };

    const handlePayloadDeleteClick = (containerId, payload) => {
        setPinModal({ open: true, action: 'delete', containerId, payloadId: payload.id, payloadData: payload });
    };

    const handlePinVerified = ({ operatorName }) => {
        const { action, containerId, payloadId, payloadData } = pinModal;
        setPinModal({ open: false, action: null, containerId: null, payloadId: null, payloadData: null });

        if (action === 'edit') {
            // Build edit form from payload data
            const formData = {
                classA: { rha4: '', rha5: '', rha6: '', sha7: '', sha8: '', sha9: '', cla: '' },
                classB: { rhb4: '', rhb5: '', rhb6: '', shb7: '', shb8: '', shb9: '', clb: '', fp: '' }
            };
            if (payloadData.data) {
                Object.keys(payloadData.data).forEach(classGroup => {
                    const classObj = payloadData.data[classGroup];
                    if (formData[classGroup]) {
                        Object.keys(classObj).forEach(sizeKey => {
                            if (formData[classGroup][sizeKey] !== undefined) {
                                formData[classGroup][sizeKey] = Number(classObj[sizeKey]) || '';
                            }
                        });
                    }
                });
            }
            setEditingPayload({ containerId, payloadId, operatorName });
            setPayloadEditForm(formData);
        } else if (action === 'delete') {
            if (onDeletePayload) {
                onDeletePayload(containerId, payloadId, operatorName);
            }
        }
    };

    const handlePayloadEditChange = (e) => {
        const { name, value } = e.target;
        const [className, field] = name.split('.');
        let validValue = value === '' ? '' : parseInt(value, 10);
        if (validValue !== '' && validValue < 0) validValue = 0;

        setPayloadEditForm(prev => ({
            ...prev,
            [className]: {
                ...prev[className],
                [field]: validValue
            }
        }));
    };

    const handlePayloadEditSave = () => {
        if (!editingPayload || !payloadEditForm || !onEditPayload) return;

        // Calculate new total
        let total = 0;
        Object.values(payloadEditForm).forEach(classObj => {
            Object.values(classObj).forEach(v => { total += (Number(v) || 0); });
        });

        const newPayloadData = {
            data: payloadEditForm,
            total
        };

        onEditPayload(editingPayload.containerId, editingPayload.payloadId, newPayloadData, editingPayload.operatorName);
        setEditingPayload(null);
        setPayloadEditForm(null);
    };

    return (
        <div className="containers-view animation-fade-in">
            <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', color: '#0f172a', margin: 0 }}>Container Engine Hub</h2>
                    <p style={{ color: 'var(--text-tertiary)', margin: '0.25rem 0 0 0', fontSize: '0.95rem' }}>Manage export shipping containers and allocate on-ground inventory.</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📊 Export to Excel
                    </button>
                    {canPerformAction(userProfile, 'action:register-container') && (
                    <button className="btn-primary" onClick={() => onNavigate('new-container')}>+ Register New Container</button>
                    )}
                </div>
            </header>

            {/* Split containers into active vs departed */}
            {(() => {
                const activeContainers = containers.filter(c => !c.timeDeparted);
                const departedContainers = containers.filter(c => !!c.timeDeparted);

                const totalActivePages = Math.ceil(activeContainers.length / itemsPerPage);
                const startIndex = (currentPage - 1) * itemsPerPage;
                const paginatedActive = activeContainers.slice(startIndex, startIndex + itemsPerPage);

                const renderContainerRow = (container) => {
                    const isFull = (container.totalBoxes >= 1540);
                    const isEmpty = container.totalBoxes === 0;
                    const isDeparted = !!container.timeDeparted;
                    const isSealed = !!container.timeSealed;

                    let statusLabel = isDeparted ? 'DEPARTED' : (isSealed ? 'SEALED' : (isFull ? 'FULL' : (isEmpty ? 'EMPTY' : 'PACKING')));
                    let statusClass = isDeparted ? 'departed' : (isSealed ? 'sealed' : (isFull ? 'full' : (isEmpty ? 'empty' : 'packing')));

                    return (
                        <tr
                            key={container.id}
                            onClick={() => setBreakdownContainer(container)}
                            className="container-row-clickable"
                            title="Click to view class breakdown"
                        >
                            <td data-label="Date" style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
                                {new Date(container.dateCreated).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </td>
                            <td data-label="Brand / Reefer">
                                <div className="brand-label" style={{ fontWeight: '800', color: 'var(--color-primary-dark)' }}>{container.reeferName || 'N/A'}</div>
                                <div className="reefer-label" style={{ fontWeight: '600', color: 'var(--text-tertiary)' }}>{container.brand}</div>
                            </td>
                            <td data-label="Container No."><span className="spec-badge">{container.reeferNo || 'Pending'}</span></td>
                            <td data-label="Seal No." style={{ fontWeight: '500' }}>{container.sealNo || 'Pending'}</td>
                            <td data-label="Destination" style={{ color: 'var(--text-secondary)' }}>
                                <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{container.destination || 'Pending'}</div>
                                {container.destination && <div style={{ fontSize: '0.8rem' }}>{getCountry(container.destination)}</div>}
                            </td>
                            <td data-label="Total Boxes" className="text-right">
                                <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--color-primary-dark)' }}>{container.totalBoxes}</span>
                                <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginLeft: '0.25rem' }}>/ 1540</span>
                            </td>
                            <td data-label="Status" className="text-center">
                                <span className={`status-badge ${statusClass}`}>{statusLabel}</span>
                            </td>
                            <td data-label="" className="text-center" onClick={e => e.stopPropagation()}>
                                <div className="action-cell">
                                    {isDeparted ? (
                                        <>
                                            <span className="dispatched-label">✓ Dispatched</span>
                                            <button className="btn-print" onClick={() => handlePrintClick(container)}>Print Manifest</button>
                                        </>
                                    ) : !isFull ? (
                                        canPerformAction(userProfile, 'action:stuff-container') ? (
                                        <button
                                            className="btn-primary"
                                            onClick={() => onNavigate({ name: 'container-stuffing-grid', state: { containerId: container.id } })}
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                        >
                                            Stuff Container
                                        </button>
                                        ) : null
                                    ) : !isSealed ? (
                                        canPerformAction(userProfile, 'action:seal-container') ? (
                                        <button className="btn-seal" onClick={() => onSealContainer(container.id)}>Seal Container</button>
                                        ) : <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: '600' }}>FULL</span>
                                    ) : (
                                        <>
                                            {canPerformAction(userProfile, 'action:depart-container') && (
                                            <button className="btn-depart" onClick={() => onDepartContainer(container.id)}>Depart Hub</button>
                                            )}
                                            <button className="btn-print" onClick={() => handlePrintClick(container)}>Print Manifest</button>
                                        </>
                                    )}
                                    <button
                                        style={{ background: 'none', border: 'none', color: 'var(--color-primary-light)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem', marginTop: '0.2rem', fontWeight: '500' }}
                                        onClick={() => onNavigate({ name: 'edit-container', state: { containerId: container.id } })}
                                    >
                                        Edit Details
                                    </button>
                                    {(container.stuffedItems && container.stuffedItems.length > 0) && (canPerformAction(userProfile, 'action:edit-payload') || canPerformAction(userProfile, 'action:delete-payload')) && (
                                        <button
                                            style={{
                                                background: 'none', border: 'none', color: '#d97706', textDecoration: 'underline',
                                                cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem', fontWeight: '500'
                                            }}
                                            onClick={() => setManagingContainerId(container.id)}
                                        >
                                            🔒 Manage Payloads
                                        </button>
                                    )}
                                </div>
                            </td>
                        </tr>
                    );
                };

                return (
                    <>
                        {/* ===== ACTIVE CONTAINERS ===== */}
                        <div className="banana-table-container shadow-lg">
                            <div style={{ padding: '0.75rem 1.25rem', borderBottom: '2px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h3 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    📦 Active Containers
                                    <span style={{ background: '#dcfce7', color: '#166534', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>{activeContainers.length}</span>
                                </h3>
                            </div>
                            <table className="banana-table">
                                <thead>
                                    <tr>
                                        <th>Date Created</th>
                                        <th>Brand / Reefer</th>
                                        <th>Container No.</th>
                                        <th>Seal No.</th>
                                        <th>Destination</th>
                                        <th className="text-right">Total Boxes</th>
                                        <th className="text-center">Status</th>
                                        <th className="text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeContainers.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="text-center" style={{ padding: '3rem 0', color: 'var(--text-tertiary)' }}>
                                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📦</div>
                                                All containers have been dispatched.<br />
                                                <span style={{ fontSize: '0.9rem' }}>Register a new container to get started.</span>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedActive.map(renderContainerRow)
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Active pagination */}
                        {totalActivePages > 1 && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '1rem', padding: '1rem' }}>
                                <button 
                                    disabled={currentPage === 1} 
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    className="btn-secondary btn-sm"
                                >
                                    Previous
                                </button>
                                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
                                    Page {currentPage} of {totalActivePages}
                                </span>
                                <button 
                                    disabled={currentPage === totalActivePages} 
                                    onClick={() => setCurrentPage(prev => Math.min(totalActivePages, prev + 1))}
                                    className="btn-secondary btn-sm"
                                >
                                    Next
                                </button>
                            </div>
                        )}

                        {/* ===== DEPARTED CONTAINERS ===== */}
                        {departedContainers.length > 0 && (
                            <div className="banana-table-container shadow-lg" style={{ marginTop: '2rem', opacity: 0.92 }}>
                                <div style={{ padding: '0.75rem 1.25rem', borderBottom: '2px solid #64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                                    <h3 style={{ margin: 0, fontSize: '1rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        🚢 Departed / Shipped
                                        <span style={{ background: '#e2e8f0', color: '#475569', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px' }}>{departedContainers.length}</span>
                                    </h3>
                                </div>
                                <table className="banana-table" style={{ fontSize: '0.9rem' }}>
                                    <thead>
                                        <tr>
                                            <th>Departed</th>
                                            <th>Brand / Reefer</th>
                                            <th>Container No.</th>
                                            <th>Seal No.</th>
                                            <th>Destination</th>
                                            <th className="text-right">Total Boxes</th>
                                            <th className="text-center">Status</th>
                                            <th className="text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {departedContainers
                                            .sort((a, b) => new Date(b.timeDeparted) - new Date(a.timeDeparted))
                                            .map(renderContainerRow)
                                        }
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                );
            })()}

            {/* Hidden component solely for printing */}
            <div style={{ display: 'none' }}>
                <ContainerManifest
                    ref={componentRef}
                    container={selectedContainer}
                />
            </div>

            {/* ====== CLASS BREAKDOWN MODAL ====== */}
            {breakdownContainer && (() => {
                const c = breakdownContainer;
                // Aggregate all stuffed items into a flat breakdown object
                const bd = {};
                (c.stuffedItems || []).forEach(item => {
                    if (item.data) {
                        Object.keys(item.data).forEach(cg => {
                            const classObj = item.data[cg];
                            Object.keys(classObj).forEach(sk => {
                                const key = `${cg}.${sk}`;
                                bd[key] = (bd[key] || 0) + (Number(classObj[sk]) || 0);
                            });
                        });
                    }
                });

                const classATotal = classATypes.reduce((s, t) => s + (bd[t] || 0), 0);
                const classBTotal = classBTypes.reduce((s, t) => s + (bd[t] || 0), 0);
                const grandTotal = classATotal + classBTotal;
                const capacity = 1540;
                const fillPct = Math.min((c.totalBoxes / capacity) * 100, 100);
                const circumference = 2 * Math.PI * 42; // r=42
                const dashOffset = circumference * (1 - fillPct / 100);

                const isDeparted = !!c.timeDeparted;
                const isSealed = !!c.timeSealed;
                const isFull = c.totalBoxes >= capacity;
                const isEmpty = c.totalBoxes === 0;
                const statusLabel = isDeparted ? 'DEPARTED' : (isSealed ? 'SEALED' : (isFull ? 'FULL' : (isEmpty ? 'EMPTY' : 'PACKING')));
                const statusClass = isDeparted ? 'departed' : (isSealed ? 'sealed' : (isFull ? 'full' : (isEmpty ? 'empty' : 'packing')));

                const BarRow = ({ label, value, maxVal, colorFrom, colorTo }) => {
                    const pct = maxVal > 0 ? Math.round((value / maxVal) * 100) : 0;
                    return (
                        <div className="bd-bar-row">
                            <div className="bd-bar-label">{label}</div>
                            <div className="bd-bar-track">
                                <div
                                    className="bd-bar-fill"
                                    style={{
                                        width: `${pct}%`,
                                        background: `linear-gradient(90deg, ${colorFrom}, ${colorTo})`
                                    }}
                                />
                            </div>
                            <div className="bd-bar-count">{value > 0 ? value.toLocaleString() : '—'}</div>
                            <div className="bd-bar-pct">{pct > 0 ? `${pct}%` : ''}</div>
                        </div>
                    );
                };

                const ringColor = isDeparted ? '#1d4ed8' : isSealed ? '#059669' : isFull ? '#3b82f6' : '#f59e0b';

                return (
                    <div className="bd-overlay" onClick={() => setBreakdownContainer(null)}>
                        <div className="bd-modal animation-fade-in" onClick={e => e.stopPropagation()}>
                            <button className="bd-close" onClick={() => setBreakdownContainer(null)}>×</button>

                            {/* Header */}
                            <div className="bd-header">
                                <div className="bd-header-info">
                                    <span className="bd-container-name">{c.reeferName || 'Container'}</span>
                                    <span className="bd-container-sub">
                                        {c.reeferNo || 'No. Pending'}
                                        {c.destination && <> &nbsp;→&nbsp; <strong>{c.destination}</strong></>}
                                    </span>
                                    <span className={`status-badge ${statusClass}`} style={{ marginTop: '0.25rem', alignSelf: 'flex-start' }}>{statusLabel}</span>
                                </div>

                                {/* Capacity Ring */}
                                <div className="bd-ring-wrap">
                                    <svg viewBox="0 0 100 100" className="bd-ring-svg">
                                        <circle cx="50" cy="50" r="42" fill="none" stroke="#e2e8f0" strokeWidth="8" />
                                        <circle
                                            cx="50" cy="50" r="42" fill="none"
                                            stroke={ringColor} strokeWidth="8"
                                            strokeLinecap="round"
                                            strokeDasharray={circumference}
                                            strokeDashoffset={dashOffset}
                                            transform="rotate(-90 50 50)"
                                            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                                        />
                                    </svg>
                                    <div className="bd-ring-text">
                                        <span className="bd-ring-boxes">{(c.totalBoxes || 0).toLocaleString()}</span>
                                        <span className="bd-ring-cap">/ {capacity.toLocaleString()}</span>
                                        <span className="bd-ring-label">boxes</span>
                                    </div>
                                </div>
                            </div>

                            {/* Summary pills */}
                            <div className="bd-summary-pills">
                                <div className="bd-pill bd-pill-a">
                                    <span className="bd-pill-val">{classATotal.toLocaleString()}</span>
                                    <span className="bd-pill-lbl">Class A</span>
                                </div>
                                <div className="bd-pill bd-pill-b">
                                    <span className="bd-pill-val">{classBTotal.toLocaleString()}</span>
                                    <span className="bd-pill-lbl">Class B</span>
                                </div>
                                <div className="bd-pill bd-pill-total">
                                    <span className="bd-pill-val">{grandTotal.toLocaleString()}</span>
                                    <span className="bd-pill-lbl">Total Hands</span>
                                </div>
                            </div>

                            {/* Charts */}
                            {(() => {
                                // Class A sub-groups
                                const classARegularTypes = ['classA.rha4', 'classA.rha5', 'classA.rha6'];
                                const classASmallTypes   = ['classA.sha7', 'classA.sha8', 'classA.sha9', 'classA.cla'];
                                const classARegularTotal = classARegularTypes.reduce((s, t) => s + (bd[t] || 0), 0);
                                const classASmallTotal   = classASmallTypes.reduce((s, t) => s + (bd[t] || 0), 0);

                                // Class B sub-groups
                                const classBRegularTypes = ['classB.rhb4', 'classB.rhb5', 'classB.rhb6'];
                                const classBSmallTypes   = ['classB.shb7', 'classB.shb8', 'classB.shb9', 'classB.clb', 'classB.fp'];
                                const classBRegularTotal = classBRegularTypes.reduce((s, t) => s + (bd[t] || 0), 0);
                                const classBSmallTotal   = classBSmallTypes.reduce((s, t) => s + (bd[t] || 0), 0);

                                const SubHeader = ({ label, total, accent }) => (
                                    <div style={{
                                        fontSize: '0.68rem', fontWeight: '700', textTransform: 'uppercase',
                                        letterSpacing: '0.07em', color: accent, margin: '0.6rem 0 0.35rem',
                                        display: 'flex', alignItems: 'center', gap: '0.4rem'
                                    }}>
                                        <span style={{ opacity: 0.5, fontSize: '0.6rem' }}>▸</span>
                                        {label}
                                        <span style={{ fontWeight: 500, opacity: 0.6 }}>({total.toLocaleString()})</span>
                                    </div>
                                );

                                return (
                                    <div className="bd-charts">
                                        {/* Class A */}
                                        <div className="bd-section">
                                            <div className="bd-section-header bd-section-header-a">
                                                <span className="bd-section-dot bd-dot-a"/>
                                                Class A &nbsp;<span className="bd-section-total">({classATotal.toLocaleString()} boxes)</span>
                                            </div>

                                            <SubHeader label="Regular Hands" total={classARegularTotal} accent="#15803d" />
                                            {classARegularTypes.map(t => (
                                                <BarRow key={t} label={typeLabels[t]} value={bd[t] || 0}
                                                    maxVal={classATotal || 1} colorFrom="#4ade80" colorTo="#16a34a" />
                                            ))}

                                            <SubHeader label="Small Hands" total={classASmallTotal} accent="#0369a1" />
                                            {classASmallTypes.map(t => (
                                                <BarRow key={t} label={typeLabels[t]} value={bd[t] || 0}
                                                    maxVal={classATotal || 1} colorFrom="#38bdf8" colorTo="#0284c7" />
                                            ))}
                                        </div>

                                        {/* Class B */}
                                        <div className="bd-section">
                                            <div className="bd-section-header bd-section-header-b">
                                                <span className="bd-section-dot bd-dot-b"/>
                                                Class B &nbsp;<span className="bd-section-total">({classBTotal.toLocaleString()} boxes)</span>
                                            </div>

                                            <SubHeader label="Regular Hands" total={classBRegularTotal} accent="#b45309" />
                                            {classBRegularTypes.map(t => (
                                                <BarRow key={t} label={typeLabels[t]} value={bd[t] || 0}
                                                    maxVal={classBTotal || 1} colorFrom="#fbbf24" colorTo="#d97706" />
                                            ))}

                                            <SubHeader label="Small Hands" total={classBSmallTotal} accent="#9333ea" />
                                            {classBSmallTypes.map(t => (
                                                <BarRow key={t} label={typeLabels[t]} value={bd[t] || 0}
                                                    maxVal={classBTotal || 1} colorFrom="#c084fc" colorTo="#9333ea" />
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}

                            {grandTotal === 0 && (
                                <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.9rem', marginTop: '1rem' }}>
                                    No stuffed payload data recorded yet.
                                </p>
                            )}
                        </div>
                    </div>
                );
            })()}

            {/* Payload Manager Modal */}
            {managingContainer && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
                    <div className="card animation-fade-in" style={{ padding: '2rem', maxWidth: '800px', width: '95%', maxHeight: '90vh', overflowY: 'auto', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)' }}>
                        <button onClick={() => { setManagingContainerId(null); setEditingPayload(null); setPayloadEditForm(null); }} style={{ position: 'absolute', top: '15px', right: '15px', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-tertiary)', background: 'none', border: 'none' }}>×</button>

                        <h3 style={{ marginBottom: '0.25rem', color: 'var(--color-primary-dark)' }}>Manage Stuffed Payloads</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                            Container: <strong>{managingContainer.reeferName || managingContainer.id}</strong> &nbsp;|&nbsp;
                            Container No: <strong>{managingContainer.reeferNo || 'N/A'}</strong> &nbsp;|&nbsp;
                            Total: <strong>{managingContainer.totalBoxes} / 1540</strong>
                        </p>

                        {/* Payload Edit Form Inline */}
                        {editingPayload && payloadEditForm ? (
                            <div style={{ border: '2px solid #f59e0b', borderRadius: '10px', padding: '1.5rem', marginBottom: '1.5rem', background: '#fffbeb' }}>
                                <h4 style={{ margin: '0 0 0.75rem', color: '#92400e', fontSize: '0.95rem' }}>Editing Payload: {editingPayload.payloadId}</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    {/* Class A */}
                                    <div style={{ border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.75rem', background: '#f0fdf4' }}>
                                        <h5 style={{ margin: '0 0 0.5rem', color: '#166534', fontSize: '0.85rem' }}>Class A</h5>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                                            {classATypes.map(typeId => {
                                                const [cn, fld] = typeId.split('.');
                                                return (
                                                    <div key={typeId}>
                                                        <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#475569' }}>{typeLabels[typeId]}</label>
                                                        <input type="number" min="0" name={typeId} className="input-field"
                                                            style={{ padding: '0.3rem', fontSize: '0.8rem', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}
                                                            value={payloadEditForm[cn]?.[fld] ?? ''}
                                                            onChange={handlePayloadEditChange}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {/* Class B */}
                                    <div style={{ border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem', background: '#fffbeb' }}>
                                        <h5 style={{ margin: '0 0 0.5rem', color: '#92400e', fontSize: '0.85rem' }}>Class B</h5>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
                                            {classBTypes.map(typeId => {
                                                const [cn, fld] = typeId.split('.');
                                                return (
                                                    <div key={typeId}>
                                                        <label style={{ fontSize: '0.65rem', fontWeight: '700', color: '#475569' }}>{typeLabels[typeId]}</label>
                                                        <input type="number" min="0" name={typeId} className="input-field"
                                                            style={{ padding: '0.3rem', fontSize: '0.8rem', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}
                                                            value={payloadEditForm[cn]?.[fld] ?? ''}
                                                            onChange={handlePayloadEditChange}
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                                    <button className="btn-secondary" onClick={() => { setEditingPayload(null); setPayloadEditForm(null); }} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Cancel</button>
                                    <button className="btn-primary" onClick={handlePayloadEditSave} style={{ padding: '0.4rem 1rem', fontSize: '0.8rem' }}>Save Payload Changes</button>
                                </div>
                            </div>
                        ) : null}

                        {/* Payload List */}
                        <table className="banana-table" style={{ fontSize: '0.85rem' }}>
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Payload ID</th>
                                    <th className="text-right">Class A</th>
                                    <th className="text-right">Class B</th>
                                    <th className="text-right">Total</th>
                                    <th className="text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(managingContainer.stuffedItems || []).map((item, idx) => {
                                    let entryA = 0, entryB = 0;
                                    if (item.data) {
                                        Object.keys(item.data).forEach(cg => {
                                            const sum = Object.values(item.data[cg]).reduce((s, v) => s + (Number(v) || 0), 0);
                                            if (cg.startsWith('classA')) entryA += sum;
                                            else entryB += sum;
                                        });
                                    }
                                    return (
                                        <tr key={item.id || idx}>
                                            <td>{new Date(item.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                                            <td><span className="spec-badge" style={{ fontSize: '0.7rem' }}>{item.id}</span></td>
                                            <td className="text-right" style={{ color: '#166534', fontWeight: '600' }}>{entryA || '—'}</td>
                                            <td className="text-right" style={{ color: '#92400e', fontWeight: '600' }}>{entryB || '—'}</td>
                                            <td className="text-right" style={{ fontWeight: '800' }}>{item.total}</td>
                                            <td className="text-center">
                                                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center' }}>
                                                    <button
                                                        onClick={() => handlePayloadEditClick(managingContainer.id, item)}
                                                        style={{ background: '#fef3c7', border: '1px solid #f59e0b', color: '#92400e', padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                                                    >
                                                        🔒 Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handlePayloadDeleteClick(managingContainer.id, item)}
                                                        style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', padding: '0.25rem 0.5rem', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}
                                                    >
                                                        🔒 Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PIN Verification Modal */}
            <PinVerifyModal
                isOpen={pinModal.open}
                onClose={() => setPinModal({ open: false, action: null, containerId: null, payloadId: null, payloadData: null })}
                onVerified={handlePinVerified}
                actionLabel={pinModal.action === 'delete' ? 'Delete Payload Override' : 'Edit Payload Override'}
            />
        </div>
    );
};

export default ContainersList;

