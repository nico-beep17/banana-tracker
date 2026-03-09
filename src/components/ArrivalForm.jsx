import React, { useState } from 'react';
import ArrivalsTable from './ArrivalsTable';
import './ArrivalForm.css';

const ArrivalForm = ({ arrivals = [], onApproveArrival, userProfile, onAddArrival, farms = [], weeklyRates = [], samplings = [], onNavigate }) => {
    const [showForm, setShowForm] = useState(false);
    // Helper to get local ISO string compatible with datetime-local
    const getLocalISOString = () => {
        const now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        return now.toISOString().slice(0, 16);
    };

    const initialFormState = {
        // Delivery Headers
        farmName: '',
        farmCode: '',
        brand: '',
        dateOfPacking: new Date().toISOString().split('T')[0],
        deliveryReceipt: '',
        driverName: '',
        plateNumber: '',
        packaging: 'VP',
        piw: 13.5,
        dateTimeArrive: getLocalISOString(),

        // Batch Grids
        classA: { rha4: '', rha5: '', rha6: '', sha7: '', sha8: '', sha9: '', shaCLA: '' },
        classB: { rhb4: '', rhb5: '', rhb6: '', shb7: '', shb8: '', shb9: '', shbCLB: '', shbFP: '' }
    };

    const [formData, setFormData] = useState(initialFormState);

    const [showFarmPrompt, setShowFarmPrompt] = useState(false);
    const [promptData, setPromptData] = useState({ farmName: '', farmCode: '', dateOfPacking: initialFormState.dateOfPacking });
    const [promptSamplingState, setPromptSamplingState] = useState(null);

    // SAMPLING WORKFLOW STATE
    // status options: 'PENDING', 'PROCEED', 'DOWNGRADED', 'REJECTED'
    const [samplingState, setSamplingState] = useState({
        isRequired: false,
        status: 'PENDING',
    });

    const getSamplingRequirement = (farmCode, datePacked) => {
        if (!farmCode || !datePacked) return null;
        const alreadySampled = samplings.find(
            s => s.farmCode === farmCode && (s.date === datePacked || s.dateOfPacking === datePacked)
        );
        if (alreadySampled) {
            return { isRequired: false, status: alreadySampled.overallDecision || alreadySampled.decision };
        } else {
            return { isRequired: true, status: 'PENDING' };
        }
    };

    // Check if a sampling has already been done for this farm TODAY (Date of Packing)
    const checkSamplingRequirement = (farmCode, datePacked) => {
        const req = getSamplingRequirement(farmCode, datePacked);
        if (req) setSamplingState(req);
    };

    const handlePromptChange = (field, value) => {
        setPromptData(prev => {
            const next = { ...prev };
            if (field === 'farmName') {
                const selectedFarm = farms.find(f => f.name === value);
                next.farmName = value;
                next.farmCode = selectedFarm ? selectedFarm.farmCode : '';
            } else {
                next[field] = value;
            }

            const req = getSamplingRequirement(next.farmCode, next.dateOfPacking);
            setPromptSamplingState(req);

            return next;
        });
    };

    const handleProceedToForm = () => {
        setFormData(prev => ({
            ...prev,
            farmName: promptData.farmName,
            farmCode: promptData.farmCode,
            dateOfPacking: promptData.dateOfPacking
        }));
        if (promptSamplingState) setSamplingState(promptSamplingState);
        setShowFarmPrompt(false);
        setShowForm(true);
    };

    const handleChange = (e) => {
        const { name, value, type } = e.target;

        // Auto-fill logic for Farm Selection
        if (name === 'farmName') {
            const selectedFarm = farms.find(f => f.name === value);
            if (selectedFarm) {
                setFormData(prev => ({
                    ...prev,
                    farmName: selectedFarm.name,
                    farmCode: selectedFarm.farmCode, // Note: The prop name in App.jsx is farmCode, not ppCode
                }));
                // Check sampling requirement immediately using current date on form
                checkSamplingRequirement(selectedFarm.farmCode, formData.dateOfPacking);
                return;
            }
        }

        // Handle nested grid inputs
        if (name.startsWith('classA.') || name.startsWith('classB.')) {
            const [className, keyName] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [className]: {
                    ...prev[className],
                    [keyName]: type === 'number' ? (value === '' ? '' : Number(value)) : value
                }
            }));
            return;
        }

        // Standard inputs
        setFormData(prev => {
            const updated = {
                ...prev,
                [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
            };

            // Re-evaluate sampling requirement if Farm or Date changes manually
            if (name === 'farmCode' || name === 'dateOfPacking') {
                checkSamplingRequirement(updated.farmCode, updated.dateOfPacking);
            }

            return updated;
        });
    };

    // Calculate dynamic totals for the UI
    const calculateTotals = () => {
        const sum = (obj) => Object.values(obj).reduce((acc, val) => acc + (Number(val) || 0), 0);
        const classATotal = sum(formData.classA);
        const classBTotal = sum(formData.classB);
        return { classATotal, classBTotal, grandTotal: classATotal + classBTotal };
    };
    const totals = calculateTotals();

    const handleClear = () => {
        setFormData(initialFormState);
        setSamplingState({ isRequired: false, status: 'PENDING' });
    };

    const [formError, setFormError] = useState('');
    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError(''); // Reset errors

        // Robust manual validation prevents silent HTML5 scrolling bugs
        if (!formData.farmName || !formData.farmCode || !formData.dateOfPacking || !formData.dateTimeArrive) {
            setFormError("Validation Error: Missing core date or farm data! Please ensure Farm Name and Dates are complete.");
            return;
        }

        if (!formData.deliveryReceipt || !formData.driverName || !formData.plateNumber || !formData.brand) {
            setFormError("Validation Error: Please complete all Delivery Header fields (Delivery Receipt, Driver, Plate, Brand) before saving.");
            return;
        }

        if (!formData.packaging || !formData.piw) {
            setFormError("Validation Error: Please select the Packaging and Pack-in-Weight.");
            return;
        }

        const farmObj = farms.find(f => f.farmCode === formData.farmCode);
        if (!farmObj) {
            setFormError("Critical Error: Farm validation failed. Please re-select the Farm Name.");
            return;
        }

        // Calculate ISO Week Number for the selected dateOfPacking
        const getWeekNumber = (dateString) => {
            const date = new Date(dateString);
            const startDate = new Date(date.getFullYear(), 0, 1);
            const days = Math.floor((date - startDate) / (24 * 60 * 60 * 1000));
            return Math.ceil((date.getDay() + 1 + days) / 7);
        };

        const packingYear = new Date(formData.dateOfPacking).getFullYear();
        const packingWeek = getWeekNumber(formData.dateOfPacking);

        // Find the applicable weekly rate for this Farm + Week Combo
        const activeRateDoc = weeklyRates.find(r => r.farm_id === farmObj.id && r.year === packingYear && r.week_number === packingWeek);

        if (!activeRateDoc) {
            setFormError(`Missing Pricing Data: No Weekly Contract found for ${farmObj.name} in Year ${packingYear}, Week ${packingWeek}. Please define this farm's weekly rates in the Grower Registry before logging this delivery.`);
            return;
        }

        let parsedRates = activeRateDoc.rates_matrix || {};

        // Loop through the batch grid and construct individual Inventory Line Items
        // This satisfies the "On Ground Inventory" data model while keeping data entry fast
        const newArrivalsBatch = [];
        const currentBatchId = `BATCH-${Date.now().toString()}`;
        const baseSpecCode = formData.brand.toUpperCase() || 'XXX';

        // Build Pack & Weight Spec Codes
        const packCode = formData.packaging ? formData.packaging.charAt(0).toUpperCase() : 'V';
        const weightCode = formData.piw ? formData.piw.toString().replace('.', '') : '135';

        // Helper to add lines
        const addLine = (typeId, baseClass, actualClass, hClassInput, specSize, quantity) => {
            if (quantity && Number(quantity) > 0) {
                // Example Spec Builder: LFJA4HV135 (Brand + Class + Size + Packaging + PIW)
                const specCode = `${baseSpecCode}${actualClass}${specSize}${packCode}${weightCode}`;

                // Extract the specific rate for this exact box type
                const itemRate = Number(parsedRates[typeId]) || 0;

                newArrivalsBatch.push({
                    id: crypto.randomUUID(),
                    farmName: formData.farmName,
                    farmCode: formData.farmCode,
                    driverName: formData.driverName,
                    plateNumber: formData.plateNumber,
                    deliveryReceipt: formData.deliveryReceipt,
                    dateOfPacking: formData.dateOfPacking,
                    dateTimeArrive: formData.dateTimeArrive,
                    brand: formData.brand,
                    ccClass: baseClass, // Display label e.g., 'Class A' or 'Class SH'
                    productSpecsCode: specCode,
                    quantity: Number(quantity),
                    batchId: currentBatchId,
                    typeId: typeId,
                    dateTimeEncoded: new Date().toISOString()
                });
            }
        };

        // Parse Class A (Regular)
        // Parse Class A (Regular)
        addLine('classA.rha4', 'A', 'A', '4H', '4H', formData.classA.rha4);
        addLine('classA.rha5', 'A', 'A', '5H', '5H', formData.classA.rha5);
        addLine('classA.rha6', 'A', 'A', '6H', '6H', formData.classA.rha6);

        // Parse Class A (Small / Specials)
        addLine('classA.sha7', 'SH', 'S', '7H', '7H', formData.classA.sha7);
        addLine('classA.sha8', 'SH', 'S', '8H', '8H', formData.classA.sha8);
        addLine('classA.sha9', 'SH', 'S', '9H', '9H', formData.classA.sha9);
        addLine('classA.cla', 'A (Cluster)', 'A', 'CL', 'CL', formData.classA.shaCLA);

        // Parse Class B (Regular)
        addLine('classB.rhb4', 'B', 'B', '4H', '4H', formData.classB.rhb4);
        addLine('classB.rhb5', 'B', 'B', '5H', '5H', formData.classB.rhb5);
        addLine('classB.rhb6', 'B', 'B', '6H', '6H', formData.classB.rhb6);

        // Parse Class B (Small)
        addLine('classB.shb7', 'B', 'B', '7H', '7H', formData.classB.shb7);
        addLine('classB.shb8', 'B', 'B', '8H', '8H', formData.classB.shb8);
        addLine('classB.shb9', 'B', 'B', '9H', '9H', formData.classB.shb9);
        addLine('classB.clb', 'B (Cluster)', 'B', 'CL', 'CL', formData.classB.shbCLB);
        addLine('classB.fp', 'B (Finger Pack)', 'B', 'FP', 'FP', formData.classB.shbFP);

        // Validate if at least ONE box was entered across all inputs
        if (newArrivalsBatch.length === 0) {
            alert("⚠️ Validation Error: You must enter at least 1 box quantity in the Grid before saving the batch.");
            return;
        }

        // Send all compiled items to the main state
        if (onAddArrival) {
            // Wait for database confirmation
            try {
                const isSuccess = await onAddArrival(newArrivalsBatch);
                if (isSuccess) {
                    setShowForm(false); // Reset to list view ONLY after save succeeds
                }
            } catch (err) {
                console.error("Arrival integration error:", err);
            }
        }
    };

    if (!showForm) {
        return (
            <div className="animation-fade-in">
                <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.5rem', color: '#0f172a', margin: 0 }}>Arrivals Log</h2>
                        <p style={{ color: 'var(--text-tertiary)', margin: '0.25rem 0 0 0', fontSize: '0.95rem' }}>View and manage daily banana deliveries from farms.</p>
                    </div>
                    <button className="btn-primary" onClick={() => setShowFarmPrompt(true)} style={{ padding: '0.6rem 1.2rem', whiteSpace: 'nowrap' }}>+ Log New Arrival</button>
                </header>

                {/* PROMPT POPUP MODAL */}
                {showFarmPrompt && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(4px)' }}>
                        <div className="card animation-fade-in" style={{ padding: '2rem', maxWidth: '450px', width: '90%', position: 'relative', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)' }}>
                            <button onClick={() => setShowFarmPrompt(false)} style={{ position: 'absolute', top: '15px', right: '15px', cursor: 'pointer', fontSize: '1.2rem', color: 'var(--text-tertiary)', background: 'none', border: 'none' }}>×</button>
                            <h3 style={{ marginBottom: '0.5rem', color: 'var(--color-primary-dark)' }}>Verify Farm Sampling</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Select the farm and packing date below. Deliveries cannot be logged without a cleared sample for the day.</p>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="label">Date of Packing</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                    value={promptData.dateOfPacking}
                                    onChange={(e) => handlePromptChange('dateOfPacking', e.target.value)}
                                />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1rem' }}>
                                <label className="label">Farm Name</label>
                                <select
                                    className="input-field"
                                    style={{ width: '100%', boxSizing: 'border-box' }}
                                    value={promptData.farmName}
                                    onChange={(e) => handlePromptChange('farmName', e.target.value)}
                                >
                                    <option value="" disabled>Select a farm...</option>
                                    {farms.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}
                                </select>
                            </div>

                            {promptData.farmCode && promptSamplingState && (
                                <div className="animation-fade-in" style={{ marginTop: '1.5rem', padding: '1.25rem', borderRadius: '8px', backgroundColor: promptSamplingState.isRequired ? '#fffbeb' : promptSamplingState.status === 'REJECTED' ? '#ffebee' : '#f0fdf4', border: `1px solid ${promptSamplingState.isRequired ? '#fcd34d' : promptSamplingState.status === 'REJECTED' ? '#fca5a5' : '#bbf7d0'}`, borderLeft: `6px solid ${promptSamplingState.isRequired ? 'var(--warning, #d97706)' : promptSamplingState.status === 'REJECTED' ? 'var(--error, #dc2626)' : 'var(--success, #059669)'}` }}>
                                    {promptSamplingState.isRequired ? (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '1.2rem' }}>⚠️</span>
                                                <h4 style={{ color: '#b45309', margin: 0 }}>Sampling Required</h4>
                                            </div>
                                            <p style={{ fontSize: '0.85rem', color: '#78350f', marginTop: '0.5rem', lineHeight: '1.4' }}>This farm has no logged sampling for {promptData.dateOfPacking}. Please evaluate a sample container first.</p>
                                            <button className="btn-primary" style={{ marginTop: '1rem', width: '100%', background: 'var(--color-warning)', color: '#fff', border: 'none' }} onClick={() => onNavigate({ name: 'sampling', state: { farmCode: promptData.farmCode } })}>Go to Daily Sampling</button>
                                        </>
                                    ) : promptSamplingState.status === 'REJECTED' ? (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '1.2rem' }}>⛔</span>
                                                <h4 style={{ color: '#b91c1c', margin: 0 }}>Sample Rejected</h4>
                                            </div>
                                            <p style={{ fontSize: '0.85rem', color: '#7f1d1d', marginTop: '0.5rem', lineHeight: '1.4' }}>This farm's sample was officially rejected. Operations are normally suspended, but you may proceed to log specific accepted boxes if authorized.</p>
                                            <button type="button" className="btn-secondary" style={{ marginTop: '1rem', width: '100%', borderColor: '#fca5a5', color: '#b91c1c', backgroundColor: '#fff' }} onClick={handleProceedToForm}>Anyway, Proceed →</button>
                                        </>
                                    ) : (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ fontSize: '1.2rem' }}>✅</span>
                                                <h4 style={{ color: '#166534', margin: 0 }}>Sampling Cleared</h4>
                                            </div>
                                            <p style={{ fontSize: '0.85rem', color: '#14532d', marginTop: '0.5rem', lineHeight: '1.4' }}>Decision: <strong>{promptSamplingState.status}</strong></p>
                                            <button className="btn-primary" style={{ marginTop: '1rem', width: '100%', border: 'none' }} onClick={handleProceedToForm}>Proceed to Log Arrival →</button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div style={{ marginTop: '1rem' }}>
                    <ArrivalsTable arrivals={arrivals} onApproveArrival={onApproveArrival} userProfile={userProfile} samplings={samplings} />
                </div>
            </div>
        );
    }

    return (
        <div className="card form-container container-slide-down">
            <div className="form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2>Log Batch Arrival</h2>
                    <p className="subtitle">Enter the delivery headers below. The item grid will automatically be broken down into individual inventory specs.</p>
                </div>
                <button className="btn-secondary" onClick={() => setShowForm(false)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>Back to List</button>
            </div>

            {formError && (
                <div style={{ padding: '1rem', backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: '4px', marginBottom: '1.5rem' }}>
                    <h3 style={{ color: '#b91c1c', fontSize: '0.95rem', margin: '0 0 0.25rem 0' }}>Submission Error</h3>
                    <p style={{ color: '#7f1d1d', fontSize: '0.85rem', margin: 0 }}>{formError}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="arrival-form">

                {/* Section 1: Delivery Delivery & Driver details */}
                <div className="form-section">
                    <h3>Delivery Header</h3>
                    <div className="grid-3">
                        <div className="form-group">
                            <label className="label">Farm Name <span style={{ color: 'red' }}>*</span></label>
                            <select name="farmName" className="input-field" value={formData.farmName} onChange={handleChange}>
                                <option value="" disabled>Select a farm...</option>
                                {farms.map(farm => (
                                    <option key={farm.id} value={farm.name}>{farm.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="label">Farm Code (PP Code)</label>
                            <input type="text" name="farmCode" className="input-field" value={formData.farmCode} onChange={handleChange} readOnly />
                        </div>
                        <div className="form-group">
                            <label className="label">Delivery Receipt # <span style={{ color: 'red' }}>*</span></label>
                            <input type="text" name="deliveryReceipt" className="input-field" placeholder="e.g. DR-12345" value={formData.deliveryReceipt} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label">Driver Name <span style={{ color: 'red' }}>*</span></label>
                            <input type="text" name="driverName" className="input-field" placeholder="e.g. Juan Perez" value={formData.driverName} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label">Plate Number <span style={{ color: 'red' }}>*</span></label>
                            <input type="text" name="plateNumber" className="input-field" placeholder="e.g. ABC-1234" value={formData.plateNumber} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label">Brand Prefix <span style={{ color: 'red' }}>*</span></label>
                            <input type="text" name="brand" className="input-field" placeholder="e.g. LFJ" value={formData.brand} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label">Packaging <span style={{ color: 'red' }}>*</span></label>
                            <select name="packaging" className="input-field" value={formData.packaging} onChange={handleChange}>
                                <option value="VP">VP (Vacuum Packed)</option>
                                <option value="PE">PE (Polyethylene)</option>
                                <option value="N">Naked</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="label">Pack in Weight (kg) <span style={{ color: 'red' }}>*</span></label>
                            <input type="number" step="0.1" name="piw" className="input-field" placeholder="13.5" value={formData.piw} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label">Date & Time Arrived <span style={{ color: 'red' }}>*</span></label>
                            <input type="datetime-local" name="dateTimeArrive" className="input-field" value={formData.dateTimeArrive} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label">Date of Packing <span style={{ color: 'red' }}>*</span></label>
                            <input type="date" name="dateOfPacking" className="input-field" value={formData.dateOfPacking} onChange={handleChange} />
                        </div>
                    </div>
                </div>

                {/* Section Mandatory Sampling Integration */}
                {samplingState.isRequired && (
                    <div className="form-section highlight-yellow slide-down" style={{ borderLeft: '4px solid var(--warning)' }}>
                        <h3>Mandatory Daily Sampling Required</h3>
                        <p className="subtitle" style={{ color: 'var(--warning-dark)', marginTop: '0.5rem' }}>
                            {formData.farmName} has not been sampled today. You must evaluate a first-delivery sample before logging inventory.
                        </p>

                        <div className="form-actions" style={{ marginTop: '1rem', justifyContent: 'flex-start' }}>
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => onNavigate && onNavigate({ name: 'sampling', state: { farmCode: formData.farmCode } })}
                            >
                                Go to Daily Sampling
                            </button>
                        </div>
                    </div>
                )
                }

                {/* Show rejection warning if rejected */}
                {
                    samplingState.status === 'REJECTED' && !samplingState.isRequired && (
                        <div className="form-section" style={{ backgroundColor: '#ffebee', borderLeft: '4px solid var(--danger)' }}>
                            <h3 style={{ color: 'var(--danger)' }}>Sample Box Rejected</h3>
                            <p>A sample from this farm was evaluated and rejected for today. You may still proceed to log inventory for the remaining accepted boxes.</p>
                            <button type="button" className="btn-secondary" style={{ marginTop: '1rem', borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={handleClear}>Clear Form</button>
                        </div>
                    )
                }

                {/* Section 2: Class A Grid */}
                <div className={`form-section breakdown-section highlight-green ${samplingState.status === 'DOWNGRADED' || samplingState.isRequired ? 'disabled-section' : ''}`}
                    style={{ opacity: (samplingState.status === 'DOWNGRADED' || samplingState.isRequired) ? 0.5 : 1, pointerEvents: (samplingState.status === 'DOWNGRADED' || samplingState.isRequired) ? 'none' : 'auto' }}>
                    <div className="section-header-flex">
                        <h3>Class A {samplingState.status === 'DOWNGRADED' && <span style={{ color: 'var(--danger)', fontSize: '0.9rem', marginLeft: '0.5rem' }}>(Locked)</span>}</h3>
                        <span className="section-total">Total: {totals.classATotal} bxs</span>
                    </div>

                    <h4 style={{ marginTop: '0.75rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Regular Hands (RHA)</h4>
                    <div className="hands-grid">
                        <div className="form-group">
                            <label className="label text-xs">4H</label>
                            <input type="number" name="classA.rha4" className="input-field" min="0" placeholder="0" value={formData.classA.rha4} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label text-xs">5H</label>
                            <input type="number" name="classA.rha5" className="input-field" min="0" placeholder="0" value={formData.classA.rha5} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label text-xs">6H</label>
                            <input type="number" name="classA.rha6" className="input-field" min="0" placeholder="0" value={formData.classA.rha6} onChange={handleChange} />
                        </div>
                    </div>

                    <h4 style={{ marginTop: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Small Hands (SHA)</h4>
                    <div className="hands-grid">
                        <div className="form-group">
                            <label className="label text-xs">7H</label>
                            <input type="number" name="classA.sha7" className="input-field" min="0" placeholder="0" value={formData.classA.sha7} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label text-xs">8H</label>
                            <input type="number" name="classA.sha8" className="input-field" min="0" placeholder="0" value={formData.classA.sha8} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label text-xs">9H</label>
                            <input type="number" name="classA.sha9" className="input-field" min="0" placeholder="0" value={formData.classA.sha9} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label text-xs">CLA</label>
                            <input type="number" name="classA.shaCLA" className="input-field" min="0" placeholder="0" value={formData.classA.shaCLA} onChange={handleChange} />
                        </div>
                    </div>
                </div>

                {/* Section 3: Class B Grid */}
                <div className={`form-section breakdown-section highlight-yellow ${samplingState.isRequired ? 'disabled-section' : ''}`}
                    style={{ opacity: samplingState.isRequired ? 0.5 : 1, pointerEvents: samplingState.isRequired ? 'none' : 'auto' }}>
                    <div className="section-header-flex">
                        <h3>Class B</h3>
                        <span className="section-total">Total: {totals.classBTotal} bxs</span>
                    </div>

                    <h4 style={{ marginTop: '0.75rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Regular Hands (RHB)</h4>
                    <div className="hands-grid">
                        <div className="form-group">
                            <label className="label text-xs">4H</label>
                            <input type="number" name="classB.rhb4" className="input-field" min="0" placeholder="0" value={formData.classB.rhb4} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label text-xs">5H</label>
                            <input type="number" name="classB.rhb5" className="input-field" min="0" placeholder="0" value={formData.classB.rhb5} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label text-xs">6H</label>
                            <input type="number" name="classB.rhb6" className="input-field" min="0" placeholder="0" value={formData.classB.rhb6} onChange={handleChange} />
                        </div>
                    </div>

                    <h4 style={{ marginTop: '1.25rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Small Hands (SHB)</h4>
                    <div className="hands-grid">
                        <div className="form-group">
                            <label className="label text-xs">7H</label>
                            <input type="number" name="classB.shb7" className="input-field" min="0" placeholder="0" value={formData.classB.shb7} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label text-xs">8H</label>
                            <input type="number" name="classB.shb8" className="input-field" min="0" placeholder="0" value={formData.classB.shb8} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label text-xs">9H</label>
                            <input type="number" name="classB.shb9" className="input-field" min="0" placeholder="0" value={formData.classB.shb9} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label text-xs">CLB</label>
                            <input type="number" name="classB.shbCLB" className="input-field" min="0" placeholder="0" value={formData.classB.shbCLB} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label className="label text-xs">FP</label>
                            <input type="number" name="classB.shbFP" className="input-field" min="0" placeholder="0" value={formData.classB.shbFP} onChange={handleChange} />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="form-actions" style={{ justifyContent: 'space-between' }}>
                    <div className="grand-total-display">
                        Overall Total: <strong>{totals.grandTotal} boxes</strong>
                    </div>
                    <div className="btn-group">
                        <button type="button" className="btn-secondary" onClick={handleClear}>Clear</button>
                        <button type="submit" className="btn-primary" disabled={totals.grandTotal === 0 || samplingState.isRequired}>Save Batch Arrival</button>
                    </div>
                </div>
            </form >
        </div >
    );
};

export default ArrivalForm;
