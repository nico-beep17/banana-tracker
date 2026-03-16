import React, { useState } from 'react';
import './FarmsAndGrowers.css';
import { supabase } from '../supabaseClient';

const FarmsAndGrowers = ({ farms = [], setFarms, weeklyRates = [], setWeeklyRates }) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editGrowerId, setEditGrowerId] = useState(null);

    // Weekly Rates Modal State
    const [showRatesModal, setShowRatesModal] = useState(false);
    const [activeFarmForRates, setActiveFarmForRates] = useState(null);

    // Determine current ISO week to pre-fill the form
    const getCurrentWeek = () => {
        const currentDate = new Date();
        const startDate = new Date(currentDate.getFullYear(), 0, 1);
        var days = Math.floor((currentDate - startDate) /
            (24 * 60 * 60 * 1000));
        var weekNumber = Math.ceil((currentDate.getDay() + 1 + days) / 7);
        return weekNumber;
    };

    const [newWeeklyRate, setNewWeeklyRate] = useState({
        year: new Date().getFullYear(),
        week_number: getCurrentWeek(),
        rates_matrix: {
            'classA.rha4': '', 'classA.rha5': '', 'classA.rha6': '',
            'classA.sha7': '', 'classA.sha8': '', 'classA.sha9': '', 'classA.cla': '',
            'classB.rhb4': '', 'classB.rhb5': '', 'classB.rhb6': '',
            'classB.shb7': '', 'classB.shb8': '', 'classB.shb9': '', 'classB.clb': '', 'classB.fp': ''
        }
    });

    // New Grower Form State
    const [newGrower, setNewGrower] = useState({
        farmCode: '', name: '', prodHas: '', activeHas: '', location: '',
        elevation: 'LOW LAND', farmType: 'DIRECT', company: 'OWN FARM',
        pointOfDelivery: 'CARMEN CY', status: 'ACTIVE',
        physicalPhName: '', physicalPhAddress: '',
        bankName: '', accountName: '', accountNumber: ''
    });

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewGrower(prev => ({ ...prev, [name]: value }));
    };

    const handleWeeklyRateChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('rates_matrix.')) {
            const key = name.split('.')[1] + '.' + name.split('.')[2]; // classA.rha4
            setNewWeeklyRate(prev => ({
                ...prev,
                rates_matrix: {
                    ...prev.rates_matrix,
                    [key]: value === '' ? '' : Number(value)
                }
            }));
        } else {
            setNewWeeklyRate(prev => ({ ...prev, [name]: name === 'year' || name === 'week_number' ? Number(value) : value }));
        }
    };

    const handleAddWeeklyRate = async (e) => {
        e.preventDefault();

        const payload = {
            farm_id: activeFarmForRates.id,
            year: newWeeklyRate.year,
            week_number: newWeeklyRate.week_number,
            rates_matrix: newWeeklyRate.rates_matrix
        };

        const { data, error } = await supabase
            .from('weekly_rates')
            .upsert([payload], { onConflict: 'farm_id,year,week_number' })
            .select();

        if (error) {
            console.error("Supabase error (Weekly Rate):", error);
            alert(`⚠️ Database Insert Failed: ${error.message || error.details || 'Unknown constraint error.'}\n\nPlease check your input format or conflicting entries.`);
            return;
        }

        // Upsert may return empty data on conflict updates in some Supabase versions
        const savedRate = (data && data.length > 0) ? data[0] : { ...payload, id: `local-${Date.now()}`, created_at: new Date().toISOString() };
        setWeeklyRates(prev => {
            const filtered = prev.filter(r => !(r.farm_id === payload.farm_id && r.year === payload.year && r.week_number === payload.week_number));
            return [savedRate, ...filtered];
        });
        setShowRatesModal(false);
    };

    const handleAddGrower = async (e) => {
        e.preventDefault();

        const growerData = {
            ...newGrower,
            prodHas: Number(newGrower.prodHas),
            activeHas: Number(newGrower.activeHas),
            lastModified: new Date().toISOString()
        };

        if (editGrowerId) {
            // Update existing grower
            const { data, error } = await supabase
                .from('farms')
                .update(growerData)
                .eq('id', editGrowerId)
                .select();

            if (error) {
                console.error("Supabase error (Edit Farm):", error);
                alert("Failed to update grower.");
                return;
            }
            if (data && data.length > 0) {
                setFarms(prev => prev.map(farm => farm.id === editGrowerId ? data[0] : farm));
            }
        } else {
            // Add new grower. We purposefully EXCLUDE 'id' property 
            // from growerData because Supabase handles UUID creation.
            // eslint-disable-next-line no-unused-vars
            const { id, ...newGrowerDataWithoutId } = growerData;
            const { data, error } = await supabase
                .from('farms')
                .insert([newGrowerDataWithoutId])
                .select();

            if (error) {
                console.error("Supabase error (New Farm):", error);
                alert("Failed to register new grower.");
                return;
            }
            if (data && data.length > 0) {
                setFarms(prev => [...prev, data[0]]);
            }
        }

        // Reset and close form
        resetForm();
    };

    const handleEditClick = (farm) => {
        setNewGrower({
            ...farm
        });
        setEditGrowerId(farm.id);
        setIsFormOpen(true);
    };

    const handleManageRates = (farm) => {
        setActiveFarmForRates(farm);

        // Reset the form modal
        setNewWeeklyRate({
            year: new Date().getFullYear(),
            week_number: getCurrentWeek(),
            rates_matrix: {
                'classA.rha4': '', 'classA.rha5': '', 'classA.rha6': '',
                'classA.sha7': '', 'classA.sha8': '', 'classA.sha9': '', 'classA.cla': '',
                'classB.rhb4': '', 'classB.rhb5': '', 'classB.rhb6': '',
                'classB.shb7': '', 'classB.shb8': '', 'classB.shb9': '', 'classB.clb': '', 'classB.fp': ''
            }
        });
        setShowRatesModal(true);
    };

    const resetForm = () => {
        setNewGrower({
            farmCode: '', name: '', prodHas: '', activeHas: '', location: '',
            elevation: 'LOW LAND', farmType: 'DIRECT', company: 'OWN FARM',
            pointOfDelivery: 'CARMEN CY', status: 'ACTIVE',
            physicalPhName: '', physicalPhAddress: '',
            bankName: '', accountName: '', accountNumber: ''
        });
        setEditGrowerId(null);
        setIsFormOpen(false);
    };

    return (
        <div className="farms-container">
            {/* Header Area */}
            <div className="farms-header">
                <div>
                    <h2>Grower Registry</h2>
                    <p className="subtitle">Manage the central database of supplier farms.</p>
                </div>
                <button
                    className="btn-primary"
                    onClick={() => {
                        if (isFormOpen) {
                            resetForm();
                        } else {
                            setIsFormOpen(true);
                        }
                    }}
                >
                    {isFormOpen ? 'Cancel' : '+ Register New Farm'}
                </button>
            </div>

            {/* Registration Form Panel */}
            {isFormOpen && (
                <div className="card registration-card slide-down">
                    <h3>{editGrowerId ? 'Edit Grower Details' : 'New Grower Details'}</h3>
                    <form onSubmit={handleAddGrower} className="grower-form">

                        <div className="form-section">
                            <h4>Basic Information</h4>
                            <div className="grid-3">
                                <div className="form-group">
                                    <label className="label">Farm Code</label>
                                    <input type="text" name="farmCode" className="input-field" required value={newGrower.farmCode} onChange={handleInputChange} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Grower Name</label>
                                    <input type="text" name="name" className="input-field" required value={newGrower.name} onChange={handleInputChange} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Location</label>
                                    <input type="text" name="location" className="input-field" required value={newGrower.location} onChange={handleInputChange} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Elevation</label>
                                    <select name="elevation" className="input-field" value={newGrower.elevation} onChange={handleInputChange}>
                                        <option value="LOW LAND">LOW LAND</option>
                                        <option value="MID LAND">MID LAND</option>
                                        <option value="HIGH LAND">HIGH LAND</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Status</label>
                                    <select name="status" className="input-field" value={newGrower.status} onChange={handleInputChange}>
                                        <option value="ACTIVE">ACTIVE</option>
                                        <option value="INACTIVE">INACTIVE</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="form-section">
                            <h4>Operations & Facilities</h4>
                            <div className="grid-3">
                                <div className="form-group">
                                    <label className="label">Production Hectares</label>
                                    <input type="number" step="0.01" name="prodHas" className="input-field" required value={newGrower.prodHas} onChange={handleInputChange} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Active Hectares</label>
                                    <input type="number" step="0.01" name="activeHas" className="input-field" required value={newGrower.activeHas} onChange={handleInputChange} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Farm Type</label>
                                    <input type="text" name="farmType" className="input-field" value={newGrower.farmType} onChange={handleInputChange} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Company</label>
                                    <input type="text" name="company" className="input-field" value={newGrower.company} onChange={handleInputChange} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Point of Delivery (POD)</label>
                                    <input type="text" name="pointOfDelivery" className="input-field" value={newGrower.pointOfDelivery} onChange={handleInputChange} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Other Grouping</label>
                                    <input type="text" name="otherGrouping" className="input-field" value={newGrower.otherGrouping} onChange={handleInputChange} />
                                </div>
                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                    <label className="label">Physical PH Name</label>
                                    <input type="text" name="physicalPhName" className="input-field" required value={newGrower.physicalPhName} onChange={handleInputChange} />
                                </div>
                                <div className="form-group" style={{ gridColumn: 'span 3' }}>
                                    <label className="label">Physical PH Address</label>
                                    <input type="text" name="physicalPhAddress" className="input-field" required value={newGrower.physicalPhAddress} onChange={handleInputChange} />
                                </div>
                            </div>
                        </div>

                        <div className="form-section highlight-green">
                            <h4>Bank Details</h4>
                            <div className="grid-3">
                                <div className="form-group">
                                    <label className="label">Bank Name</label>
                                    <input type="text" name="bankName" className="input-field" value={newGrower.bankName} onChange={handleInputChange} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Account Name</label>
                                    <input type="text" name="accountName" className="input-field" value={newGrower.accountName} onChange={handleInputChange} />
                                </div>
                                <div className="form-group">
                                    <label className="label">Account Number</label>
                                    <input type="text" name="accountNumber" className="input-field" value={newGrower.accountNumber} onChange={handleInputChange} />
                                </div>
                            </div>
                        </div>

                        <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: '2rem' }}>
                            <button type="submit" className="btn-primary">
                                {editGrowerId ? 'Update Grower' : 'Save Grower'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Data Table */}
            <div className="banana-table-container shadow-lg animation-fade-in">
                <div className="table-responsive">
                    <table className="banana-table">
                        <thead>
                            <tr>
                                <th>Farm Code</th>
                                <th>Grower Name</th>
                                <th>Location</th>
                                <th>PH Name</th>
                                <th className="text-center">Active Has.</th>
                                <th className="text-center">Status</th>
                                <th>Last Modified</th>
                                <th className="text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {farms.map((farm) => (
                                <tr key={farm.id}>
                                    <td data-label="Farm Code">
                                        <div className="cell-primary" style={{ fontWeight: '700' }}>{farm.farmCode}</div>
                                    </td>
                                    <td data-label="Grower">
                                        <div className="cell-primary" style={{ fontWeight: '700', color: 'var(--color-primary-dark)' }}>{farm.name}</div>
                                        <div className="cell-secondary">{farm.company}</div>
                                    </td>
                                    <td data-label="Location">
                                        <div className="cell-primary truncate" style={{ fontSize: '0.85rem' }}>{farm.location}</div>
                                    </td>
                                    <td data-label="PH Name">
                                        <div className="cell-primary" style={{ fontWeight: '600' }}>{farm.physicalPhName}</div>
                                        <div className="cell-secondary truncate">{farm.physicalPhAddress}</div>
                                    </td>
                                    <td data-label="Active Has." className="text-center">
                                        <div className="badge-neutral" style={{ fontWeight: '700' }}>{farm.activeHas} ha</div>
                                    </td>
                                    <td data-label="Status" className="text-center">
                                        <span className="status-badge" style={farm.status === 'ACTIVE' ? { background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white' } : { background: '#f1f5f9', color: '#64748b' }}>
                                            {farm.status}
                                        </span>
                                    </td>
                                    <td data-label="Modified">
                                        <div className="cell-secondary" style={{ fontSize: '0.8rem', fontWeight: '500' }}>
                                            {farm.lastModified ? new Date(farm.lastModified).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                        </div>
                                    </td>
                                    <td data-label="" className="text-center">
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                            {(() => {
                                                const currentYear = new Date().getFullYear();
                                                const currentWk = getCurrentWeek();
                                                const hasCurrentWeekRate = weeklyRates.some(
                                                    r => r.farm_id === farm.id && r.year === currentYear && r.week_number === currentWk
                                                );
                                                return (
                                                    <div style={{ position: 'relative', display: 'inline-block' }}>
                                                        <button
                                                            className="btn-primary"
                                                            onClick={() => handleManageRates(farm)}
                                                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem', backgroundColor: 'var(--color-primary-main)' }}
                                                        >
                                                            Weekly Rates
                                                        </button>
                                                        {hasCurrentWeekRate && (
                                                            <span style={{
                                                                position: 'absolute', top: '-6px', right: '-6px',
                                                                background: '#10b981', color: 'white',
                                                                borderRadius: '50%', width: '14px', height: '14px',
                                                                fontSize: '9px', display: 'flex', alignItems: 'center',
                                                                justifyContent: 'center', fontWeight: '700', lineHeight: 1
                                                            }} title={`Week ${currentWk} rate already set`}>✓</span>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                            <button
                                                className="btn-secondary"
                                                onClick={() => handleEditClick(farm)}
                                                style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
                                            >
                                                Edit
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Weekly Rates Modal */}
            {showRatesModal && activeFarmForRates && (
                <div className="modal-backdrop">
                    <div className="modal-content" style={{ maxWidth: '900px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div className="modal-header">
                            <h2>Weekly Pricing Contracts</h2>
                            <p className="subtitle">Manage rates for <strong>{activeFarmForRates.farmCode} - {activeFarmForRates.name}</strong></p>
                            <button className="close-btn" onClick={() => setShowRatesModal(false)}>×</button>
                        </div>

                        <div className="modal-body">
                            {/* Form to Add/Edit a Weekly Rate */}
                            <form onSubmit={handleAddWeeklyRate} className="grower-form" style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <h4>Define New Weekly Rate</h4>
                                {/* Current week indicator */}
                                {(() => {
                                    const currentYear = new Date().getFullYear();
                                    const currentWk = getCurrentWeek();
                                    const existingRate = weeklyRates.find(
                                        r => r.farm_id === activeFarmForRates.id && r.year === currentYear && r.week_number === currentWk
                                    );
                                    return existingRate ? (
                                        <div style={{ marginBottom: '1rem', padding: '0.65rem 1rem', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', color: '#166534', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '1rem' }}>✅</span>
                                            <span><strong>Week {currentWk}, {currentYear}</strong> rate is already set for this farm. You can overwrite it by submitting new values below.</span>
                                        </div>
                                    ) : (
                                        <div style={{ marginBottom: '1rem', padding: '0.65rem 1rem', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', color: '#92400e', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '1rem' }}>⚠️</span>
                                            <span><strong>Week {currentWk}, {currentYear}</strong> rate has <strong>not yet been defined</strong> for this farm.</span>
                                        </div>
                                    );
                                })()}
                                <div className="grid-3" style={{ marginBottom: '1rem' }}>
                                    <div className="form-group">
                                        <label className="label">Year</label>
                                        <input type="number" name="year" className="input-field" value={newWeeklyRate.year} onChange={handleWeeklyRateChange} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="label">Week Number (1-53)</label>
                                        <input type="number" name="week_number" min="1" max="53" className="input-field" value={newWeeklyRate.week_number} onChange={handleWeeklyRateChange} required />
                                    </div>
                                </div>

                                <div className="pricing-matrix" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                                    {/* Class A Rates */}
                                    <div className="matrix-column" style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <h5 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#16a34a' }}>Class A Rates (PHP)</h5>
                                        <div className="grid-2">
                                            <div className="form-group"><label className="label text-xs">4H</label><input type="number" step="0.01" name="rates_matrix.classA.rha4" className="input-field" value={newWeeklyRate.rates_matrix['classA.rha4']} onChange={handleWeeklyRateChange} /></div>
                                            <div className="form-group"><label className="label text-xs">5H</label><input type="number" step="0.01" name="rates_matrix.classA.rha5" className="input-field" value={newWeeklyRate.rates_matrix['classA.rha5']} onChange={handleWeeklyRateChange} /></div>
                                            <div className="form-group"><label className="label text-xs">6H</label><input type="number" step="0.01" name="rates_matrix.classA.rha6" className="input-field" value={newWeeklyRate.rates_matrix['classA.rha6']} onChange={handleWeeklyRateChange} /></div>
                                            <div className="form-group"><label className="label text-xs">7H</label><input type="number" step="0.01" name="rates_matrix.classA.sha7" className="input-field" value={newWeeklyRate.rates_matrix['classA.sha7']} onChange={handleWeeklyRateChange} /></div>
                                            <div className="form-group"><label className="label text-xs">8H</label><input type="number" step="0.01" name="rates_matrix.classA.sha8" className="input-field" value={newWeeklyRate.rates_matrix['classA.sha8']} onChange={handleWeeklyRateChange} /></div>
                                            <div className="form-group"><label className="label text-xs">9H</label><input type="number" step="0.01" name="rates_matrix.classA.sha9" className="input-field" value={newWeeklyRate.rates_matrix['classA.sha9']} onChange={handleWeeklyRateChange} /></div>
                                            <div className="form-group"><label className="label text-xs">CLA</label><input type="number" step="0.01" name="rates_matrix.classA.cla" className="input-field" value={newWeeklyRate.rates_matrix['classA.cla']} onChange={handleWeeklyRateChange} /></div>
                                        </div>
                                    </div>

                                    {/* Class B Rates */}
                                    <div className="matrix-column" style={{ background: '#ffffff', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                        <h5 style={{ borderBottom: '2px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '1rem', color: '#ca8a04' }}>Class B Rates (PHP)</h5>
                                        <div className="grid-2">
                                            <div className="form-group"><label className="label text-xs">4H</label><input type="number" step="0.01" name="rates_matrix.classB.rhb4" className="input-field" value={newWeeklyRate.rates_matrix['classB.rhb4']} onChange={handleWeeklyRateChange} /></div>
                                            <div className="form-group"><label className="label text-xs">5H</label><input type="number" step="0.01" name="rates_matrix.classB.rhb5" className="input-field" value={newWeeklyRate.rates_matrix['classB.rhb5']} onChange={handleWeeklyRateChange} /></div>
                                            <div className="form-group"><label className="label text-xs">6H</label><input type="number" step="0.01" name="rates_matrix.classB.rhb6" className="input-field" value={newWeeklyRate.rates_matrix['classB.rhb6']} onChange={handleWeeklyRateChange} /></div>
                                            <div className="form-group"><label className="label text-xs">7H</label><input type="number" step="0.01" name="rates_matrix.classB.shb7" className="input-field" value={newWeeklyRate.rates_matrix['classB.shb7']} onChange={handleWeeklyRateChange} /></div>
                                            <div className="form-group"><label className="label text-xs">8H</label><input type="number" step="0.01" name="rates_matrix.classB.shb8" className="input-field" value={newWeeklyRate.rates_matrix['classB.shb8']} onChange={handleWeeklyRateChange} /></div>
                                            <div className="form-group"><label className="label text-xs">9H</label><input type="number" step="0.01" name="rates_matrix.classB.shb9" className="input-field" value={newWeeklyRate.rates_matrix['classB.shb9']} onChange={handleWeeklyRateChange} /></div>
                                            <div className="form-group"><label className="label text-xs">CLB</label><input type="number" step="0.01" name="rates_matrix.classB.clb" className="input-field" value={newWeeklyRate.rates_matrix['classB.clb']} onChange={handleWeeklyRateChange} /></div>
                                            <div className="form-group"><label className="label text-xs">FP</label><input type="number" step="0.01" name="rates_matrix.classB.fp" className="input-field" value={newWeeklyRate.rates_matrix['classB.fp']} onChange={handleWeeklyRateChange} /></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                                    <button type="submit" className="btn-primary">Save Weekly Rate</button>
                                </div>
                            </form>

                            {/* Table of Existing Weekly Rates */}
                            <h4>Historical Weekly Contracts</h4>
                            <div className="table-responsive" style={{ marginTop: '1rem' }}>
                                <table className="banana-table" style={{ fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr>
                                            <th>Year</th>
                                            <th>Week No.</th>
                                            <th className="text-right">A: 4H Rate</th>
                                            <th className="text-right">A: 7H Rate</th>
                                            <th className="text-right">B: 4H Rate</th>
                                            <th>Last Updated</th>
                                            <th className="text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {weeklyRates.filter(r => r.farm_id === activeFarmForRates.id).length === 0 ? (
                                            <tr><td colSpan="7" className="text-center">No weekly rates found for this farm.</td></tr>
                                        ) : (
                                            weeklyRates.filter(r => r.farm_id === activeFarmForRates.id)
                                                .sort((a, b) => b.year - a.year || b.week_number - a.week_number)
                                                .map(rate => (
                                                    <tr key={rate.id}>
                                                        <td style={{ fontWeight: 'bold' }}>{rate.year}</td>
                                                        <td>
                                                            <span className="badge-neutral">Wk {rate.week_number}</span>
                                                        </td>
                                                        <td className="text-right">₱{Number(rate.rates_matrix['classA.rha4'] || 0).toFixed(2)}</td>
                                                        <td className="text-right">₱{Number(rate.rates_matrix['classA.sha7'] || 0).toFixed(2)}</td>
                                                        <td className="text-right">₱{Number(rate.rates_matrix['classB.rhb4'] || 0).toFixed(2)}</td>
                                                        <td className="cell-secondary">{new Date(rate.created_at).toLocaleDateString()}</td>
                                                        <td className="text-center">
                                                            <button
                                                                className="btn-secondary"
                                                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                                onClick={() => {
                                                                    setNewWeeklyRate({
                                                                        year: rate.year,
                                                                        week_number: rate.week_number,
                                                                        rates_matrix: {
                                                                            ...newWeeklyRate.rates_matrix, // maintain all keys
                                                                            ...rate.rates_matrix // overlay existing values
                                                                        }
                                                                    });
                                                                }}
                                                            >
                                                                Load into Form
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FarmsAndGrowers;
