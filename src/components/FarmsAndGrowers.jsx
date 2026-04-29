import React, { useState, useMemo } from 'react';
import './FarmsAndGrowers.css';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Plus, Edit, Settings, FileSpreadsheet, Save, X, CheckCircle, AlertTriangle, Download, TrendingUp, TrendingDown, Minus, BarChart2, Printer } from 'lucide-react';
import { exportXlsx } from '../utils/exportXlsx';
import { LAvcLogo } from '../assets/logoBase64';
import { toast } from 'sonner';
import GrowerProfileModal from './FarmsAndGrowers/GrowerProfileModal';
import { useQueryClient } from '@tanstack/react-query';
import { useFarmsQuery, useWeeklyRatesQuery, useArrivalsQuery, useSamplingsQuery } from '../queries/hooks';

const FarmsAndGrowers = () => {
    const queryClient = useQueryClient();
    const { data: farms = [] } = useFarmsQuery();
    const { data: weeklyRates = [] } = useWeeklyRatesQuery();
    const { data: arrivals = [] } = useArrivalsQuery();
    const { data: samplings = [] } = useSamplingsQuery();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editGrowerId, setEditGrowerId] = useState(null);

    // Weekly Rates Modal State
    const [showRatesModal, setShowRatesModal] = useState(false);
    const [activeFarmForRates, setActiveFarmForRates] = useState(null);

    // Grower Profile Modal
    const [growerProfile, setGrowerProfile] = useState(null);

    // Determine current ISO week to pre-fill the form
    const getCurrentWeek = () => {
        const currentDate = new Date();
        const startDate = new Date(currentDate.getFullYear(), 0, 1);
        var days = Math.floor((currentDate - startDate) / (24 * 60 * 60 * 1000));
        var weekNumber = Math.ceil((currentDate.getDay() + 1 + days) / 7);
        return weekNumber;
    };

    // Generate week options from Week 8 (start of operations) to Week 52
    // Future weeks are allowed so pricing agreements can be entered in advance
    const OPERATION_START_WEEK = 8;
    const generateWeekOptions = (year) => {
        const startWk = year === new Date().getFullYear() ? OPERATION_START_WEEK : 1;
        const endWk = 52; // Allow all weeks — incl. future for advance pricing
        const opts = [];
        for (let w = startWk; w <= endWk; w++) opts.push(w);
        return opts.reverse(); // newest first
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

    const FIELDS = [
        { key: 'classA.rha4', label: 'A-4H' }, { key: 'classA.rha5', label: 'A-5H' },
        { key: 'classA.rha6', label: 'A-6H' }, { key: 'classA.sha7', label: 'A-7H' },
        { key: 'classA.sha8', label: 'A-8H' }, { key: 'classA.sha9', label: 'A-9H' },
        { key: 'classA.cla', label: 'A-CL' },
        { key: 'classB.rhb4', label: 'B-4H' }, { key: 'classB.rhb5', label: 'B-5H' },
        { key: 'classB.rhb6', label: 'B-6H' }, { key: 'classB.shb7', label: 'B-7H' },
        { key: 'classB.shb8', label: 'B-8H' }, { key: 'classB.shb9', label: 'B-9H' },
        { key: 'classB.clb', label: 'B-CL' }, { key: 'classB.fp', label: 'B-FP' },
    ];

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
            toast.error(`⚠️ Database Insert Failed: ${error.message || error.details || 'Unknown constraint error.'}\n\nPlease check your input format or conflicting entries.`);
            return;
        }

        // Sync fresh data via React Query cache invalidation
        queryClient.invalidateQueries({ queryKey: ['weekly_rates'] });
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
            // Update existing grower safely by stripping protected fields
            const { id, created_at, ...updatePayload } = growerData;
            const { data, error } = await supabase
                .from('farms')
                .update(updatePayload)
                .eq('id', editGrowerId)
                .select();

            if (error) {
                console.error("Supabase error (Edit Farm):", error);
                toast.error("Failed to update grower.");
                return;
            }
            queryClient.invalidateQueries({ queryKey: ['farms'] });
            toast.success('Grower updated successfully.');
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
                toast.error("Failed to register new grower.");
                return;
            }
            queryClient.invalidateQueries({ queryKey: ['farms'] });
            toast.success('New grower registered.');
        }

        // Reset form to clear inputs right after saving
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
        const curWk = getCurrentWeek();
        const curYear = new Date().getFullYear();

        // Try to auto-load existing rate for current week
        const existing = weeklyRates.find(r => r.farm_id === farm.id && r.year === curYear && r.week_number === curWk);
        setNewWeeklyRate({
            year: curYear,
            week_number: curWk,
            rates_matrix: existing ? { ...existing.rates_matrix } : {
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

    const handleExportGrowerRegistry = async () => {
        try {
            const { default: ExcelJS } = await import('exceljs');
            const wb = new ExcelJS.Workbook();
            const ws = wb.addWorksheet('Grower Registry');

            ws.columns = [
                { header: 'Farm Code', key: 'farmCode', width: 14 },
                { header: 'Grower Name', key: 'name', width: 28 },
                { header: 'Location', key: 'location', width: 30 },
                { header: 'Company', key: 'company', width: 20 },
                { header: 'Farm Type', key: 'farmType', width: 14 },
                { header: 'Elevation', key: 'elevation', width: 14 },
                { header: 'Prod. Has.', key: 'prodHas', width: 12 },
                { header: 'Active Has.', key: 'activeHas', width: 12 },
                { header: 'Point of Delivery', key: 'pointOfDelivery', width: 20 },
                { header: 'Status', key: 'status', width: 12 },
                { header: 'PH Name', key: 'physicalPhName', width: 24 },
                { header: 'PH Address', key: 'physicalPhAddress', width: 30 },
                { header: 'Bank Name', key: 'bankName', width: 20 },
                { header: 'Account Name', key: 'accountName', width: 24 },
                { header: 'Account Number', key: 'accountNumber', width: 20 },
            ];

            // Style header row
            ws.getRow(1).eachCell(cell => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            farms.forEach(f => ws.addRow(f));

            await exportXlsx(wb, `GrowerRegistry_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (err) {
            console.error('Export failed:', err);
            toast.error('Export failed: ' + err.message);
        }
    };

    return (
        <div className="farms-container animate-fade-in">
            <div className="farms-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button 
                        onClick={() => window.history.back()} 
                        className="btn-icon" 
                        style={{ padding: '0.6rem', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Back to Dashboard"
                    >
                        <ArrowLeft size={20} color="var(--text-secondary)" />
                    </button>
                    <div>
                        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Grower Registry</h2>
                        <p className="subtitle" style={{ margin: '2px 0 0' }}>Manage the central database of supplier farms.</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                        className="btn-secondary"
                        onClick={handleExportGrowerRegistry}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        title="Export to Excel"
                    >
                        <Download size={16} /> Export
                    </button>
                    <button
                        className={`btn-primary ${isFormOpen ? 'btn-danger' : ''}`}
                        onClick={() => {
                            if (isFormOpen) {
                                resetForm();
                            } else {
                                setIsFormOpen(true);
                            }
                        }}
                        style={{ background: isFormOpen ? 'var(--color-error)' : undefined, boxShadow: isFormOpen ? '0 4px 10px -2px rgba(239, 68, 68, 0.4)' : undefined }}
                    >
                        {isFormOpen ? <><X size={18} /> Cancel</> : <><Plus size={18} /> Register New Farm</>}
                    </button>
                </div>
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

                        <div className="form-actions" style={{ justifyContent: 'flex-end', marginTop: '2rem', gap: '1rem', display: 'flex' }}>
                            <button 
                                type="button" 
                                className="btn-secondary" 
                                onClick={resetForm}
                            >
                                <X size={18} /> Cancel
                            </button>
                            <button type="submit" className="btn-primary">
                                <Save size={18} /> {editGrowerId ? 'Update Grower Details' : 'Save New Grower'}
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
                                <tr key={farm.id}
                                    onClick={() => setGrowerProfile(farm)}
                                    style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                                    onMouseLeave={e => e.currentTarget.style.background = ''}
                                >
                                    <td data-label="Farm Code">
                                        <div className="cell-primary" style={{ fontWeight: '700' }}>{farm.farmCode}</div>
                                    </td>
                                    <td data-label="Grower">
                                        <div className="cell-primary" style={{ fontWeight: '700', color: 'var(--color-primary-dark)' }}>
                                            {farm.name}
                                        </div>
                                        <div className="cell-secondary">{farm.company}</div>
                                    </td>
                                    <td data-label="Location">
                                        <div className="cell-primary truncate" style={{ fontSize: '0.85rem', maxWidth: '140px' }}>{farm.location}</div>
                                    </td>
                                    <td data-label="PH Name">
                                        <div className="cell-primary truncate" style={{ fontWeight: '600', maxWidth: '140px' }}>{farm.physicalPhName}</div>
                                        <div className="cell-secondary truncate" style={{ maxWidth: '140px' }}>{farm.physicalPhAddress}</div>
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
                                        <div className="cell-secondary" style={{ fontSize: '0.85rem', fontWeight: '500' }}>{farm.lastModified ? new Date(farm.lastModified).toLocaleDateString() : 'Mar 17, 2026'}</div>
                                    </td>
                                    <td data-label="" className="text-center" style={{ paddingBottom: '2.5rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9' }}>
                                        <div className="action-cell" style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                            {(() => {
                                                const currentYear = new Date().getFullYear();
                                                const currentWk = getCurrentWeek();
                                                const hasCurrentWeekRate = weeklyRates.some(
                                                    r => r.farm_id === farm.id && r.year === currentYear && r.week_number === currentWk
                                                );
                                                return (
                                                    <div style={{ position: 'relative', width: '100%' }}>
                                                        <button
                                                            className="btn-primary"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleManageRates(farm);
                                                            }}
                                                            style={{ 
                                                                padding: '1rem', 
                                                                width: '100%',
                                                                fontSize: '1rem', 
                                                                backgroundColor: 'var(--color-primary-main)',
                                                                borderRadius: '12px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                gap: '8px'
                                                            }}
                                                        >
                                                            <Settings size={18} />
                                                            <span>Manage Weekly Rates</span>
                                                            {hasCurrentWeekRate && (
                                                                <span style={{
                                                                    background: 'rgba(255,255,255,0.2)', 
                                                                    padding: '2px 8px', 
                                                                    borderRadius: '20px', 
                                                                    fontSize: '0.75rem',
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px'
                                                                }}><CheckCircle size={12} /> Set</span>
                                                            )}
                                                        </button>
                                                    </div>
                                                );
                                            })()}
                                            <button
                                                className="btn-secondary"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditClick(farm);
                                                }}
                                                style={{ 
                                                    padding: '0.85rem', 
                                                    width: '100%',
                                                    fontSize: '0.95rem',
                                                    borderRadius: '12px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px'
                                                }}
                                            >
                                                <Edit size={16} /> Edit Farm Details
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
                <div className="modal-backdrop" style={{ zIndex: 9999 }}>
                    <div className="modal-content rates-modal-content" style={{ 
                        display: 'flex', 
                        flexDirection: 'column',
                        overflow: 'hidden'
                    }}>
                        <div className="modal-header" style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border-color)', background: 'white', flexShrink: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ padding: '0.5rem', background: '#f1f5f9', borderRadius: '8px', color: 'var(--color-primary-main)' }}>
                                        <FileSpreadsheet size={24} />
                                    </div>
                                    <div>
                                        <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-family-heading)', fontWeight: '700' }}>Weekly Pricing</h2>
                                        <p className="subtitle" style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>{activeFarmForRates.farmCode} - {activeFarmForRates.physicalPhName}</p>
                                    </div>
                                </div>
                                <button className="close-btn" onClick={() => setShowRatesModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={24} /></button>
                            </div>
                        </div>

                        <div className="modal-body" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: '#f8fafc' }}>
                            <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                                <h4>Define New Weekly Rate</h4>
                                {(() => {
                                    const currentYear = new Date().getFullYear();
                                    const currentWk = getCurrentWeek();
                                    const existingRate = weeklyRates.find(
                                        r => r.farm_id === activeFarmForRates.id && r.year === currentYear && r.week_number === currentWk
                                    );
                                    return existingRate ? (
                                        <div style={{ margin: '1rem 0', padding: '0.75rem', background: '#f0fdf4', color: '#166534', borderRadius: '8px', fontSize: '0.85rem' }}>
                                            ✅ Week {currentWk}, {currentYear} rate is already set. You can overwrite it below.
                                        </div>
                                    ) : (
                                        <div style={{ margin: '1rem 0', padding: '0.75rem', background: '#fffbeb', color: '#92400e', borderRadius: '8px', fontSize: '0.85rem' }}>
                                            ⚠️ Week {currentWk}, {currentYear} rate is NOT defined yet.
                                        </div>
                                    );
                                })()}

                                <form onSubmit={handleAddWeeklyRate} id="weekly-rate-form">
                                    <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                                        <div className="form-group">
                                            <label className="label">Year</label>
                                            <select name="year" className="input-field" value={newWeeklyRate.year}
                                                onChange={e => {
                                                    const yr = Number(e.target.value);
                                                    const wk = yr === new Date().getFullYear() ? getCurrentWeek() : 1;
                                                    const existing = weeklyRates.find(r => r.farm_id === activeFarmForRates?.id && r.year === yr && r.week_number === wk);
                                                    setNewWeeklyRate(prev => ({
                                                        ...prev, year: yr, week_number: wk,
                                                        rates_matrix: existing ? { ...existing.rates_matrix } : prev.rates_matrix
                                                    }));
                                                }}
                                            >
                                                <option value={2026}>2026</option>
                                                <option value={2027}>2027</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Week Number</label>
                                            <select name="week_number" className="input-field" value={newWeeklyRate.week_number}
                                                onChange={e => {
                                                    const wk = Number(e.target.value);
                                                    const existing = weeklyRates.find(r => r.farm_id === activeFarmForRates?.id && r.year === newWeeklyRate.year && r.week_number === wk);
                                                    setNewWeeklyRate(prev => ({
                                                        ...prev, week_number: wk,
                                                        rates_matrix: existing ? { ...existing.rates_matrix } : {
                                                            'classA.rha4': '', 'classA.rha5': '', 'classA.rha6': '',
                                                            'classA.sha7': '', 'classA.sha8': '', 'classA.sha9': '', 'classA.cla': '',
                                                            'classB.rhb4': '', 'classB.rhb5': '', 'classB.rhb6': '',
                                                            'classB.shb7': '', 'classB.shb8': '', 'classB.shb9': '', 'classB.clb': '', 'classB.fp': ''
                                                        }
                                                    }));
                                                }}
                                            >
                                                {generateWeekOptions(newWeeklyRate.year).map(w => (
                                                    <option key={w} value={w}>
                                                        Week {w}{w === getCurrentWeek() && newWeeklyRate.year === new Date().getFullYear() ? ' (Current)' : w > getCurrentWeek() && newWeeklyRate.year === new Date().getFullYear() ? ' (Future)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="pricing-matrix" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
                                        <div className="matrix-column" style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <h5 style={{ color: '#16a34a', borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Class A Rates (PHP)</h5>
                                            <div className="grid-2">
                                                <div className="form-group"><label className="label">4H</label><input type="number" step="0.01" name="rates_matrix.classA.rha4" className="input-field" value={newWeeklyRate.rates_matrix['classA.rha4']} onChange={handleWeeklyRateChange} /></div>
                                                <div className="form-group"><label className="label">5H</label><input type="number" step="0.01" name="rates_matrix.classA.rha5" className="input-field" value={newWeeklyRate.rates_matrix['classA.rha5']} onChange={handleWeeklyRateChange} /></div>
                                                <div className="form-group"><label className="label">6H</label><input type="number" step="0.01" name="rates_matrix.classA.rha6" className="input-field" value={newWeeklyRate.rates_matrix['classA.rha6']} onChange={handleWeeklyRateChange} /></div>
                                                <div className="form-group"><label className="label">7H</label><input type="number" step="0.01" name="rates_matrix.classA.sha7" className="input-field" value={newWeeklyRate.rates_matrix['classA.sha7']} onChange={handleWeeklyRateChange} /></div>
                                                <div className="form-group"><label className="label">8H</label><input type="number" step="0.01" name="rates_matrix.classA.sha8" className="input-field" value={newWeeklyRate.rates_matrix['classA.sha8']} onChange={handleWeeklyRateChange} /></div>
                                                <div className="form-group"><label className="label">9H</label><input type="number" step="0.01" name="rates_matrix.classA.sha9" className="input-field" value={newWeeklyRate.rates_matrix['classA.sha9']} onChange={handleWeeklyRateChange} /></div>
                                                <div className="form-group"><label className="label">CLA</label><input type="number" step="0.01" name="rates_matrix.classA.cla" className="input-field" value={newWeeklyRate.rates_matrix['classA.cla']} onChange={handleWeeklyRateChange} /></div>
                                            </div>
                                        </div>

                                        <div className="matrix-column" style={{ background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <h5 style={{ color: '#ca8a04', borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Class B Rates (PHP)</h5>
                                            <div className="grid-2">
                                                <div className="form-group"><label className="label">4H</label><input type="number" step="0.01" name="rates_matrix.classB.rhb4" className="input-field" value={newWeeklyRate.rates_matrix['classB.rhb4']} onChange={handleWeeklyRateChange} /></div>
                                                <div className="form-group"><label className="label">5H</label><input type="number" step="0.01" name="rates_matrix.classB.rhb5" className="input-field" value={newWeeklyRate.rates_matrix['classB.rhb5']} onChange={handleWeeklyRateChange} /></div>
                                                <div className="form-group"><label className="label">6H</label><input type="number" step="0.01" name="rates_matrix.classB.rhb6" className="input-field" value={newWeeklyRate.rates_matrix['classB.rhb6']} onChange={handleWeeklyRateChange} /></div>
                                                <div className="form-group"><label className="label">7H</label><input type="number" step="0.01" name="rates_matrix.classB.shb7" className="input-field" value={newWeeklyRate.rates_matrix['classB.shb7']} onChange={handleWeeklyRateChange} /></div>
                                                <div className="form-group"><label className="label">8H</label><input type="number" step="0.01" name="rates_matrix.classB.shb8" className="input-field" value={newWeeklyRate.rates_matrix['classB.shb8']} onChange={handleWeeklyRateChange} /></div>
                                                <div className="form-group"><label className="label">9H</label><input type="number" step="0.01" name="rates_matrix.classB.shb9" className="input-field" value={newWeeklyRate.rates_matrix['classB.shb9']} onChange={handleWeeklyRateChange} /></div>
                                                <div className="form-group"><label className="label">CLB</label><input type="number" step="0.01" name="rates_matrix.classB.clb" className="input-field" value={newWeeklyRate.rates_matrix['classB.clb']} onChange={handleWeeklyRateChange} /></div>
                                                <div className="form-group"><label className="label">FP</label><input type="number" step="0.01" name="rates_matrix.classB.fp" className="input-field" value={newWeeklyRate.rates_matrix['classB.fp']} onChange={handleWeeklyRateChange} /></div>
                                            </div>
                                        </div>
                                    </div>
                                </form>
                            </div>

                            <div className="card" style={{ padding: '1.5rem', width: '100%', overflow: 'hidden' }}>
                                <h4 style={{ margin: '0 0 1rem 0' }}>📊 Price History — All Weeks</h4>
                                <div style={{ overflowX: 'auto', width: '100%', paddingBottom: '0.5rem' }}>
                                    <table className="banana-table" style={{ fontSize: '0.82rem' }}>
                                        <thead>
                                            <tr>
                                                <th>Year</th>
                                                <th>Week</th>
                                                {FIELDS.map(f => (
                                                    <th key={f.key} className="text-right">{f.label}</th>
                                                ))}
                                                <th className="text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {weeklyRates.filter(r => r.farm_id === activeFarmForRates.id).length === 0 ? (
                                                <tr><td colSpan="10" className="text-center" style={{ padding: '2rem', color: 'var(--text-tertiary)' }}>No weekly rates recorded yet.</td></tr>
                                            ) : (
                                                weeklyRates.filter(r => r.farm_id === activeFarmForRates.id)
                                                    .sort((a, b) => b.year - a.year || b.week_number - a.week_number)
                                                    .map((rate, idx, arr) => {
                                                        const prev = arr[idx + 1];
                                                        const curA4 = Number(rate.rates_matrix?.['classA.rha4'] || 0);
                                                        const prevA4 = prev ? Number(prev.rates_matrix?.['classA.rha4'] || 0) : null;
                                                        const trend = prevA4 !== null ? (curA4 > prevA4 ? 'up' : curA4 < prevA4 ? 'down' : 'flat') : null;
                                                        const isCurrentWk = rate.week_number === getCurrentWeek() && rate.year === new Date().getFullYear();
                                                        return (
                                                            <tr key={rate.id} style={{ background: isCurrentWk ? '#f0fdf4' : undefined }}>
                                                                <td style={{ fontWeight: isCurrentWk ? 700 : 400 }}>{rate.year}</td>
                                                                <td>
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                                                                        <span className="badge-neutral" style={{ background: isCurrentWk ? '#dcfce7' : undefined, color: isCurrentWk ? '#166534' : undefined }}>Wk {rate.week_number}</span>
                                                                        {trend === 'up' && <span style={{ color: '#16a34a', fontSize: '0.75rem' }}>↑</span>}
                                                                        {trend === 'down' && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>↓</span>}
                                                                        {trend === 'flat' && <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>→</span>}
                                                                    </span>
                                                                </td>
                                                                {FIELDS.map(f => (
                                                                    <td key={f.key} className="text-right" style={{ color: Number(rate.rates_matrix?.[f.key]) > 0 ? '#0f172a' : '#cbd5e1' }}>
                                                                        {Number(rate.rates_matrix?.[f.key] || 0) > 0 ? `₱${Number(rate.rates_matrix[f.key]).toFixed(2)}` : '—'}
                                                                    </td>
                                                                ))}
                                                                <td className="text-center">
                                                                    <button
                                                                        className="btn-secondary"
                                                                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                                                        onClick={() => {
                                                                            setNewWeeklyRate({ year: rate.year, week_number: rate.week_number, rates_matrix: { ...rate.rates_matrix } });
                                                                            document.querySelector('.modal-body')?.scrollTo({ top: 0, behavior: 'smooth' });
                                                                        }}
                                                                    >
                                                                        Load
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <div className="modal-footer" style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border-color)', background: 'white', display: 'flex', justifyContent: 'flex-end', gap: '1rem', flexShrink: 0 }}>
                            <button type="button" className="btn-secondary" onClick={() => setShowRatesModal(false)} style={{ padding: '0.75rem 1.5rem', color: '#64748b' }}>Cancel</button>
                            <button type="submit" form="weekly-rate-form" className="btn-primary" style={{ padding: '0.75rem 2rem', fontSize: '1rem', fontWeight: 'bold' }}>
                                <Save size={18} /> Save Weekly Rate
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Grower Profile Modal */}
            {growerProfile && (
                <GrowerProfileModal
                    farm={growerProfile}
                    weeklyRates={weeklyRates}
                    arrivals={arrivals}
                    samplings={samplings}
                    onClose={() => setGrowerProfile(null)}
                />
            )}
        </div>
    );
};

export default FarmsAndGrowers;
