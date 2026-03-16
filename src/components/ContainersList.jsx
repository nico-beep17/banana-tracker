import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { downloadCSV } from '../utils/exportUtils';
import { getPortCountry } from '../utils/locationUtils';
import ContainerManifest from './ContainerManifest';
import './ContainersList.css';

const getCountry = (dest) => getPortCountry(dest);

const ContainersList = ({ containers = [], onNavigate, onDepartContainer, onSealContainer }) => {
    const componentRef = useRef();
    const [selectedContainer, setSelectedContainer] = useState(null);

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
        const exportData = containers.map(c => ({
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
            'Status': c.timeDeparted ? 'DEPARTED' : (c.timeSealed ? 'SEALED' : (c.totalBoxes >= 1540 ? 'FULL' : (c.totalBoxes === 0 ? 'EMPTY' : 'PACKING'))),
            'Time Started Loading': c.timeStarted ? new Date(c.timeStarted).toLocaleString() : '-',
            'Time Ended Loading': c.timeEnded ? new Date(c.timeEnded).toLocaleString() : '-',
            'Time Sealed': c.timeSealed ? new Date(c.timeSealed).toLocaleString() : '-',
            'Time Departed Hub': c.timeDeparted ? new Date(c.timeDeparted).toLocaleString() : '-'
        }));

        const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
        downloadCSV(exportData, `Containers_List_Report_${timestampStr}.xlsx`);
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
                    <button className="btn-primary" onClick={() => onNavigate('new-container')}>+ Register New Container</button>
                </div>
            </header>

            <div className="banana-table-container shadow-lg">
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
                        {containers.length === 0 ? (
                            <tr>
                                <td colSpan="8" className="text-center empty-state" style={{ padding: '6rem 0', color: 'var(--text-tertiary)' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚢</div>
                                    No containers have been registered yet. <br />
                                    <span style={{ fontSize: '0.9rem' }}>Start by creating a new Container Log.</span>
                                </td>
                            </tr>
                        ) : (
                            containers.map(container => {
                                const isFull = (container.totalBoxes >= 1540);
                                const isEmpty = container.totalBoxes === 0;
                                const isDeparted = !!container.timeDeparted;
                                const isSealed = !!container.timeSealed;

                                let statusLabel = isDeparted ? 'DEPARTED' : (isSealed ? 'SEALED' : (isFull ? 'FULL' : (isEmpty ? 'EMPTY' : 'PACKING')));
                                let statusClass = isDeparted ? 'departed' : (isSealed ? 'sealed' : (isFull ? 'full' : (isEmpty ? 'empty' : 'packing')));

                                return (
                                    <tr key={container.id}>
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
                                        <td data-label="" className="text-center">
                                            <div className="action-cell">
                                                {isDeparted ? (
                                                    <>
                                                        <span className="dispatched-label">✓ Dispatched</span>
                                                        <button className="btn-print" onClick={() => handlePrintClick(container)}>Print Manifest</button>
                                                    </>
                                                ) : !isFull ? (
                                                    <button
                                                        className="btn-primary"
                                                        onClick={() => onNavigate({ name: 'container-stuffing-grid', state: { containerId: container.id } })}
                                                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                                    >
                                                        Stuff Container
                                                    </button>
                                                ) : !isSealed ? (
                                                    <button className="btn-seal" onClick={() => onSealContainer(container.id)}>Seal Container</button>
                                                ) : (
                                                    <>
                                                        <button className="btn-depart" onClick={() => onDepartContainer(container.id)}>Depart Hub</button>
                                                        <button className="btn-print" onClick={() => handlePrintClick(container)}>Print Manifest</button>
                                                    </>
                                                )}
                                                <button
                                                    style={{ background: 'none', border: 'none', color: 'var(--color-primary-light)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.75rem', padding: '0.2rem', marginTop: '0.2rem', fontWeight: '500' }}
                                                    onClick={() => onNavigate({ name: 'edit-container', state: { containerId: container.id } })}
                                                >
                                                    Edit Details
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Hidden component solely for printing */}
            <div style={{ display: 'none' }}>
                <ContainerManifest
                    ref={componentRef}
                    container={selectedContainer}
                />
            </div>
        </div>
    );
};

export default ContainersList;

