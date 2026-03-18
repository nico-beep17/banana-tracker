import React, { useState, useMemo } from 'react';
import './NewContainerForm.css';

const ContainerStuffingGrid = ({ containerId, containers, remainingInventory, onSavePayload, onCancel }) => {
    const container = containers.find(c => c.id === containerId);

    const [formData, setFormData] = useState({
        classA: { rha4: '', rha5: '', rha6: '', sha7: '', sha8: '', sha9: '', cla: '' },
        classB: { rhb4: '', rhb5: '', rhb6: '', shb7: '', shb8: '', shb9: '', clb: '', fp: '' }
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        const [className, field] = name.split('.');

        let validValue = value === '' ? '' : parseInt(value, 10);
        if (validValue !== '') {
            const maxVal = remainingInventory?.detailed?.[name] || 0;
            if (validValue > maxVal) {
                validValue = maxVal;
            }
            if (validValue < 0) validValue = 0;
        }

        setFormData(prev => ({
            ...prev,
            [className]: {
                ...prev[className],
                [field]: validValue
            }
        }));
    };

    const renderInput = (label, name) => {
        const maxVal = remainingInventory?.detailed?.[name] || 0;
        const [className, field] = name.split('.');
        const val = formData[className][field];

        return (
            <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem', gap: '0.25rem' }}>
                    <label style={{ fontSize: '0.8rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>{label}</label>
                    <span style={{ fontSize: '0.65rem', color: maxVal > 0 ? 'var(--color-primary-main)' : 'var(--color-error)', whiteSpace: 'nowrap' }}>Max: {maxVal}</span>
                </div>
                <input
                    type="number"
                    name={name}
                    min="0"
                    max={maxVal}
                    placeholder="0"
                    value={val}
                    onChange={handleChange}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.4rem', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: maxVal === 0 ? '#f3f4f6' : 'white', fontSize: '0.9rem' }}
                    disabled={maxVal === 0}
                />
            </div>
        );
    };

    const totals = useMemo(() => {
        let classATotal = 0;
        let classBTotal = 0;

        for (const key in formData.classA) {
            classATotal += parseInt(formData.classA[key] || 0, 10);
        }
        for (const key in formData.classB) {
            classBTotal += parseInt(formData.classB[key] || 0, 10);
        }

        return { classATotal, classBTotal, grandTotal: classATotal + classBTotal };
    }, [formData]);

    const handleSave = () => {
        if (totals.grandTotal === 0) {
            alert("Please input at least one box to stuff.");
            return;
        }

        const currentTotal = container.totalBoxes || 0;
        if (currentTotal + totals.grandTotal > 1540) {
            alert(`Cannot stuff ${totals.grandTotal} boxes. Container only has ${1540 - currentTotal} capacity remaining.`);
            return;
        }

        const payload = {
            id: `PAYLOAD-${Date.now()}`,
            timestamp: new Date().toISOString(),
            data: formData,
            total: totals.grandTotal
        };

        onSavePayload(containerId, payload);
    };

    if (!container) return <div>Container not found.</div>;

    const currentTotalBoxes = container.totalBoxes || 0;
    const progressPercentage = Math.min(((currentTotalBoxes + totals.grandTotal) / 1540) * 100, 100).toFixed(1);

    return (
        <div className="container-stuffing-page animation-fade-in" style={{ padding: '0 0.75rem' }}>
            <header className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Stuffing Content for {container.reeferName || 'Container'}</h2>
                    <p style={{ color: 'var(--color-text-light)' }}>
                        <span className="spec-badge">ID: {container.id}</span>
                        {container.brand} | {container.destination}
                    </p>
                </div>
                <button className="btn-secondary" onClick={onCancel}>Back to Hub</button>
            </header>

            <div className="stuffing-layout" style={{ maxWidth: '1000px', margin: '0 auto', display: 'block' }}>
                {/* Capacity Card */}
                <div className="glass-panel" style={{ marginBottom: '1.5rem', padding: '1rem', borderLeft: '4px solid var(--color-primary-main)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>Container Capacity</h3>
                        <span><strong>{currentTotalBoxes + totals.grandTotal}</strong> / 1540 Boxes</span>
                    </div>
                    <div className="progress-bar-container" style={{ background: 'var(--color-bg-alt)', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                        <div
                            style={{
                                width: `${progressPercentage}%`,
                                height: '100%',
                                backgroundColor: currentTotalBoxes + totals.grandTotal >= 1540 ? 'var(--color-success)' : 'orange',
                                transition: 'width 0.3s ease, background-color 0.3s ease'
                            }}
                        ></div>
                    </div>
                </div>

                {/* Grid Input Form */}
                <div className="glass-panel" style={{ padding: '1rem' }}>
                    <div style={{ marginBottom: '3rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--color-primary-main)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Class A</h3>
                            <span className="status-badge" style={{ backgroundColor: 'white', color: 'var(--color-text)', border: '1px solid #ccc' }}>Total: {totals.classATotal} bxs</span>
                        </div>

                        <h4 style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', marginBottom: '1rem' }}>Regular Hands (RHA)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '2rem' }}>
                            {renderInput('4H', 'classA.rha4')}
                            {renderInput('5H', 'classA.rha5')}
                            {renderInput('6H', 'classA.rha6')}
                        </div>

                        <h4 style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', marginBottom: '1rem' }}>Small Hands (SHA)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
                            {renderInput('7H', 'classA.sha7')}
                            {renderInput('8H', 'classA.sha8')}
                            {renderInput('9H', 'classA.sha9')}
                        </div>
                        <h4 style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', marginBottom: '1rem', marginTop: '1.5rem' }}>Others</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                            {renderInput('CLA', 'classA.cla')}
                        </div>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid orange', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Class B</h3>
                            <span className="status-badge" style={{ backgroundColor: 'white', color: 'var(--color-text)', border: '1px solid #ccc' }}>Total: {totals.classBTotal} bxs</span>
                        </div>

                        <h4 style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', marginBottom: '1rem' }}>Regular Hands (RHB)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '2rem' }}>
                            {renderInput('4H', 'classB.rhb4')}
                            {renderInput('5H', 'classB.rhb5')}
                            {renderInput('6H', 'classB.rhb6')}
                        </div>

                        <h4 style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', marginBottom: '1rem' }}>Small Hands (SHB)</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem' }}>
                            {renderInput('7H', 'classB.shb7')}
                            {renderInput('8H', 'classB.shb8')}
                            {renderInput('9H', 'classB.shb9')}
                        </div>
                        <h4 style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', marginBottom: '1rem', marginTop: '1.5rem' }}>Others</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem' }}>
                            {renderInput('CLB', 'classB.clb')}
                            {renderInput('FP', 'classB.fp')}
                        </div>
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem', flexWrap: 'wrap' }}>
                        <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', minWidth: '150px' }}>
                            <span style={{ fontSize: '1.1rem' }}>Packing Payload: <strong>{totals.grandTotal} Boxes</strong></span>
                        </div>
                        <button className="btn-secondary" onClick={onCancel} style={{ padding: '0.5rem 1rem' }}>Cancel</button>
                        <button className="btn-primary" onClick={handleSave} disabled={totals.grandTotal === 0} style={{ padding: '0.5rem 1rem' }}>Save Payload</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContainerStuffingGrid;
