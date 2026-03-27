import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, Globe, DollarSign, Calendar, 
    Search, Plus, Edit3, Trash2, Download,
    ArrowLeft, Copy, CheckCircle2, 
    Building2, Mail, Phone, MapPin,
    AlertCircle, Briefcase
} from 'lucide-react';
import './Consignees.css';
import { supabase } from '../supabaseClient';
import { exportXlsx } from '../utils/exportXlsx';
import emptyIllustration from '../assets/consignee_registry_empty_illustration.png';

const Consignees = ({ consignees = [], setConsignees, consigneeWeeklyRates = [], setConsigneeWeeklyRates }) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editId, setEditId] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Weekly Rates Modal State
    const [showRatesModal, setShowRatesModal] = useState(false);
    const [activeConsigneeForRates, setActiveConsigneeForRates] = useState(null);

    const getCurrentWeek = () => {
        const currentDate = new Date();
        const startDate = new Date(currentDate.getFullYear(), 0, 1);
        const days = Math.floor((currentDate - startDate) / (24 * 60 * 60 * 1000));
        return Math.ceil((currentDate.getDay() + 1 + days) / 7);
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

    // New Consignee Form State
    const [newConsignee, setNewConsignee] = useState({
        company_name: '', contact_person: '', email: '', phone: '',
        country: '', default_port: '', payment_terms: 'TT',
        currency: 'USD', status: 'ACTIVE', notes: '',
        preferred_banana_types: [], sgrt_tolerance: '3%',
        spec_piw: '', spec_packaging: '', spec_requirement: '', spec_temperature: '', spec_ventilation: '', payment_percentage: ''
    });

    const handleBananaTypeToggle = (type) => {
        setNewConsignee(prev => {
            const types = prev.preferred_banana_types || [];
            if (types.includes(type)) {
                return { ...prev, preferred_banana_types: types.filter(t => t !== type) };
            } else {
                return { ...prev, preferred_banana_types: [...types, type] };
            }
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewConsignee(prev => ({ ...prev, [name]: value }));
    };

    const handleWeeklyRateChange = (e) => {
        const { name, value } = e.target;
        if (name.startsWith('rates_matrix.')) {
            const key = name.split('.')[1] + '.' + name.split('.')[2];
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
            consignee_id: activeConsigneeForRates.id,
            year: newWeeklyRate.year,
            week_number: newWeeklyRate.week_number,
            rates_matrix: newWeeklyRate.rates_matrix
        };

        const { data, error } = await supabase
            .from('consignee_weekly_rates')
            .upsert([payload], { onConflict: 'consignee_id,year,week_number' })
            .select();

        if (error) {
            console.error("Supabase error (Consignee Weekly Rate):", error);
            alert(`⚠️ Database Insert Failed: ${error.message || error.details || 'Unknown constraint error.'}`);
            return;
        }

        const savedRate = (data && data.length > 0) ? data[0] : { ...payload, id: `local-${Date.now()}`, created_at: new Date().toISOString() };
        setConsigneeWeeklyRates(prev => {
            const filtered = prev.filter(r => !(r.consignee_id === payload.consignee_id && r.year === payload.year && r.week_number === payload.week_number));
            return [savedRate, ...filtered];
        });
        setShowRatesModal(false);
    };

    const handleSaveConsignee = async (e) => {
        e.preventDefault();

        const consigneeData = {
            ...newConsignee,
            last_modified: new Date().toISOString()
        };

        if (editId) {
            const { data, error } = await supabase
                .from('consignees')
                .update(consigneeData)
                .eq('id', editId)
                .select();

            if (error) {
                console.error("Supabase error (Edit Consignee):", error);
                alert("Failed to update consignee.");
                return;
            }
            if (data && data.length > 0) {
                setConsignees(prev => prev.map(c => c.id === editId ? data[0] : c));
            }
            resetForm();
        } else {
            const { id, ...dataWithoutId } = consigneeData;
            const { data, error } = await supabase
                .from('consignees')
                .insert([dataWithoutId])
                .select();

            if (error) {
                console.error("Supabase error (New Consignee):", error);
                alert("Failed to register new consignee.");
                return;
            }
            if (data && data.length > 0) {
                setConsignees(prev => [...prev, data[0]]);
                resetForm();
                
                // Immediately prompt to set weekly pricing
                setTimeout(() => {
                    handleManageRates(data[0]);
                }, 300);
            }
        }
    };

    const handleEditClick = (consignee) => {
        setNewConsignee({ ...consignee });
        setEditId(consignee.id);
        setIsFormOpen(true);
    };

    const handleDeleteConsignee = async () => {
        if (!editId) return;
        if (!window.confirm("Are you sure you want to delete this buyer profile? This action will permanently remove all associated contracts.")) return;

        const { error } = await supabase
            .from('consignees')
            .delete()
            .eq('id', editId);

        if (error) {
            console.error("Supabase error (Delete Consignee):", error);
            alert("Failed to delete consignee.");
            return;
        }

        setConsignees(prev => prev.filter(c => c.id !== editId));
        resetForm();
    };

    const handleManageRates = (consignee) => {
        setActiveConsigneeForRates(consignee);
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

    const handleCopyPreviousWeek = () => {
        if (!activeConsigneeForRates) return;
        
        const previousRates = consigneeWeeklyRates
            .filter(r => r.consignee_id === activeConsigneeForRates.id)
            .sort((a, b) => b.year - a.year || b.week_number - a.week_number)[0];

        if (previousRates) {
            setNewWeeklyRate(prev => ({
                ...prev,
                rates_matrix: { ...prev.rates_matrix, ...previousRates.rates_matrix }
            }));
        } else {
            alert("No previous rates found to copy.");
        }
    };

    const resetForm = () => {
        setNewConsignee({
            company_name: '', contact_person: '', email: '', phone: '',
            country: '', default_port: '', payment_terms: 'TT',
            currency: 'USD', status: 'ACTIVE', notes: '',
            preferred_banana_types: [], sgrt_tolerance: '3%',
            spec_piw: '', spec_packaging: '', spec_requirement: '', spec_temperature: '', spec_ventilation: '', payment_percentage: ''
        });
        setEditId(null);
        setIsFormOpen(false);
    };

    const filteredConsignees = consignees.filter(c => {
        const term = searchTerm.toLowerCase();
        return (
            (c.company_name || '').toLowerCase().includes(term) ||
            (c.contact_person || '').toLowerCase().includes(term) ||
            (c.country || '').toLowerCase().includes(term) ||
            (c.default_port || '').toLowerCase().includes(term)
        );
    });

    const activeCount = consignees.filter(c => c.status === 'ACTIVE').length;
    const countries = new Set(consignees.map(c => c.country).filter(Boolean));

    const getCountryEmoji = (country) => {
        const map = {
            'Japan': '🇯🇵', 'China': '🇨🇳', 'Saudi Arabia': '🇸🇦',
            'UAE': '🇦🇪', 'Qatar': '🇶🇦', 'South Korea': '🇰🇷',
            'Philippines': '🇵🇭', 'Singapore': '🇸🇬'
        };
        return map[country] || '🌐';
    };

    return (
        <motion.div 
            className="consignees-container"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            {/* Ultra-Premium Hero Header */}
            <header className="consignees-hero">
                <div className="hero-content">
                    <h1 className="hero-title"><Users size={36} color="var(--brand-blue)" style={{ filter: 'drop-shadow(0 0 10px rgba(37,99,235,0.5))' }} /> Buyer Registry</h1>
                    <p className="hero-subtitle">Manage strategic buyer profiles, regional contracts, and pricing matrix.</p>
                </div>
                <div className="hero-action">
                    <button
                        className={`btn-hero ${isFormOpen ? 'btn-hero-danger' : ''}`}
                        onClick={() => {
                            if (isFormOpen) {
                                resetForm();
                            } else {
                                setEditId(null);
                                setNewConsignee({
                                    company_name: '', contact_person: '', email: '', phone: '',
                                    country: '', default_port: '', payment_terms: 'TT',
                                    currency: 'USD', status: 'ACTIVE', notes: '',
                                    preferred_banana_types: [], sgrt_tolerance: '3%',
                                    spec_piw: '', spec_packaging: '', spec_requirement: '', spec_temperature: '', spec_ventilation: '', payment_percentage: ''
                                });
                                setIsFormOpen(true);
                            }
                        }}
                    >
                        {isFormOpen ? (
                            <><ArrowLeft size={18} /> Cancel Registration</>
                        ) : (
                            <><Plus size={18} /> Onboard Consignee</>
                        )}
                    </button>
                </div>
            </header>

            {/* Premium Metrics Indicators */}
            <div className="consignees-metrics">
                {[
                    { label: 'Total Buyers', value: consignees.length, icon: Building2, color: '#2563eb', bg: '#eff6ff' },
                    { label: 'Active Partners', value: activeCount, icon: CheckCircle2, color: '#16a34a', bg: '#f0fdf4' },
                    { label: 'Global Reach', value: countries.size, icon: Globe, color: '#7c3aed', bg: '#f5f3ff' },
                    { label: 'Active Contracts', value: consigneeWeeklyRates.length, icon: DollarSign, color: '#d97706', bg: '#fffbeb' }
                ].map((m, idx) => (
                    <motion.div 
                        key={idx} 
                        className="metric-card-premium"
                        style={{ '--mc-color': m.color, '--mc-bg-color': m.bg }}
                    >
                        <div className="metric-icon-glass"><m.icon size={28} /></div>
                        <div className="metric-content-premium">
                            <span className="metric-val">{m.value}</span>
                            <span className="metric-lab">{m.label}</span>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Registration Form (Glassmorphic) */}
            <AnimatePresence>
                {isFormOpen && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0, y: -20 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -20 }}
                        style={{ overflow: 'hidden' }}
                    >
                        <div className="form-section-premium" style={{ borderTop: '4px solid var(--brand-blue)' }}>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1.5rem', color: 'var(--brand-dark)' }}>
                                {editId ? 'Update Buyer Profile' : 'New Buyer Initialization'}
                            </h3>
                            
                            <form onSubmit={handleSaveConsignee}>
                                <div className="form-section-premium" style={{ boxShadow: 'none', border: '1px solid #f1f5f9', background: '#f8fafc' }}>
                                    <h4><Briefcase size={20} color="var(--brand-blue)" /> Corporate Identity</h4>
                                    <div className="registration-grid">
                                        <div>
                                            <label className="label-premium">Company Name *</label>
                                            <input type="text" name="company_name" className="input-premium" required value={newConsignee.company_name} onChange={handleInputChange} placeholder="Tokyo Fresh Trading Co." />
                                        </div>
                                        <div>
                                            <label className="label-premium">Primary Contact</label>
                                            <input type="text" name="contact_person" className="input-premium" value={newConsignee.contact_person} onChange={handleInputChange} placeholder="Mr. Tanaka" />
                                        </div>
                                        <div>
                                            <label className="label-premium">Country of Operation</label>
                                            <select name="country" className="input-premium" value={newConsignee.country} onChange={handleInputChange}>
                                                <option value="">Select Country...</option>
                                                <option value="Japan">Japan</option>
                                                <option value="China">China</option>
                                                <option value="South Korea">South Korea</option>
                                                <option value="Saudi Arabia">Saudi Arabia</option>
                                                <option value="UAE">UAE</option>
                                                <option value="Qatar">Qatar</option>
                                                <option value="Singapore">Singapore</option>
                                                <option value="Philippines">Philippines</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label-premium">Corporate Email</label>
                                            <input type="email" name="email" className="input-premium" value={newConsignee.email} onChange={handleInputChange} placeholder="procurement@example.com" />
                                        </div>
                                        <div>
                                            <label className="label-premium">Direct Phone</label>
                                            <input type="text" name="phone" className="input-premium" value={newConsignee.phone} onChange={handleInputChange} placeholder="+81 3 1234 5678" />
                                        </div>
                                        <div>
                                            <label className="label-premium">Partnership Status</label>
                                            <select name="status" className="input-premium" value={newConsignee.status} onChange={handleInputChange} style={{ fontWeight: '700' }}>
                                                <option value="ACTIVE">● ACTIVE</option>
                                                <option value="INACTIVE">○ INACTIVE</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-section-premium" style={{ boxShadow: 'none', border: '1px solid #f1f5f9', background: '#f8fafc', marginTop: '1.5rem' }}>
                                    <h4><Globe size={20} color="var(--brand-blue)" /> Logistics & Financials</h4>
                                    <div className="registration-grid">
                                        <div>
                                            <label className="label-premium">Default Destination Port</label>
                                            <select name="default_port" className="input-premium" value={newConsignee.default_port} onChange={handleInputChange}>
                                                <option value="">Select Port...</option>
                                                <option value="Dalian">Dalian, China</option>
                                                <option value="Hakata">Hakata, Japan</option>
                                                <option value="Kawasaki">Kawasaki, Japan</option>
                                                <option value="Kobe">Kobe, Japan</option>
                                                <option value="Yokohama">Yokohama, Japan</option>
                                                <option value="Nagoya">Nagoya, Japan</option>
                                                <option value="Qingdao">Qingdao, China</option>
                                                <option value="Shanghai">Shanghai, China</option>
                                                <option value="Shekou">Shekou, China</option>
                                                <option value="Xingang">Xingang, China</option>
                                                <option value="Damman, Saudi Arabia">Damman, Saudi Arabia</option>
                                                <option value="Jebbel Ali">Jebbel Ali</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label-premium">Payment Agreement</label>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <select name="payment_terms" className="input-premium" value={newConsignee.payment_terms} onChange={handleInputChange} style={{ flex: 1 }}>
                                                    <option value="TT">TT (Telegraphic Transfer)</option>
                                                    <option value="LC">LC (Letter of Credit)</option>
                                                    <option value="NET-30">NET-30 Terms</option>
                                                    <option value="NET-60">NET-60 Terms</option>
                                                    <option value="100% advance">100% Advance</option>
                                                    <option value="Percentage Agreed upon">Percentage Agreed upon</option>
                                                    <option value="Payment Upon Arrival">Payment Upon Arrival</option>
                                                </select>
                                                
                                                {newConsignee.payment_terms === 'Percentage Agreed upon' && (
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        min="1" 
                                                        max="100" 
                                                        name="payment_percentage" 
                                                        className="input-premium" 
                                                        value={newConsignee.payment_percentage || ''} 
                                                        onChange={handleInputChange} 
                                                        placeholder="e.g., 50" 
                                                        style={{ width: '120px' }}
                                                        required
                                                    />
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="label-premium">Settlement Currency</label>
                                            <select name="currency" className="input-premium" value={newConsignee.currency} onChange={handleInputChange}>
                                                <option value="USD">USD - US Dollar</option>
                                                <option value="JPY">JPY - Japanese Yen</option>
                                                <option value="CNY">CNY - Chinese Yuan</option>
                                            </select>
                                        </div>
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <label className="label-premium">Strategic Notes</label>
                                            <textarea name="notes" className="input-premium" value={newConsignee.notes} onChange={handleInputChange} rows="2" placeholder="Private internal notes regarding this buyer..." />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-section-premium" style={{ boxShadow: 'none', border: '1px solid #f1f5f9', background: '#f8fafc', marginTop: '1.5rem' }}>
                                    <h4><AlertCircle size={20} color="var(--brand-blue)" /> Contract & Product Specs</h4>
                                    <div className="registration-grid">
                                        <div style={{ gridColumn: '1 / -1' }}>
                                            <label className="label-premium">Preferred Produce Types (Multi-select)</label>
                                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                                                {['Cavendish', 'Cardava', 'Senorita', 'Pineapple'].map(type => (
                                                    <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', background: 'white', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                        <input 
                                                            type="checkbox" 
                                                            checked={(newConsignee.preferred_banana_types || []).includes(type)}
                                                            onChange={() => handleBananaTypeToggle(type)}
                                                            style={{ width: '16px', height: '16px', accentColor: 'var(--brand-blue)' }}
                                                        />
                                                        <span style={{ fontSize: '0.9rem', fontWeight: '500', color: '#334155' }}>{type}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="label-premium">Packed In Weight (PIW)</label>
                                            <input type="number" step="0.1" name="spec_piw" className="input-premium" value={newConsignee.spec_piw || ''} onChange={handleInputChange} placeholder="e.g., 13.5" />
                                        </div>
                                        <div>
                                            <label className="label-premium">Packaging Type</label>
                                            <select name="spec_packaging" className="input-premium" value={newConsignee.spec_packaging || ''} onChange={handleInputChange}>
                                                <option value="">Select Packaging...</option>
                                                <option value="Vacuum Packed (VP)">Vacuum Packed (VP)</option>
                                                <option value="Polybag (PB)">Polybag (PB)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label-premium">Target Market Requirement</label>
                                            <select name="spec_requirement" className="input-premium" value={newConsignee.spec_requirement || ''} onChange={handleInputChange}>
                                                <option value="">Select Requirement...</option>
                                                <option value="Japan Specification">Japan Specification</option>
                                                <option value="Middle East Specification">Middle East Specification</option>
                                                <option value="Korea Specification">Korea Specification</option>
                                                <option value="China Specification">China Specification</option>
                                                <option value="Local Market">Local Market</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="label-premium">SGRT Tolerance</label>
                                            <input type="text" name="sgrt_tolerance" className="input-premium" value={newConsignee.sgrt_tolerance || '3%'} onChange={handleInputChange} placeholder="3%" />
                                        </div>
                                        <div>
                                            <label className="label-premium">Reefer Temperature (°C)</label>
                                            <input type="text" name="spec_temperature" className="input-premium" value={newConsignee.spec_temperature || ''} onChange={handleInputChange} placeholder="e.g. 14.0" />
                                        </div>
                                        <div>
                                            <label className="label-premium">Ventilation Status</label>
                                            <select name="spec_ventilation" className="input-premium" value={newConsignee.spec_ventilation || ''} onChange={handleInputChange}>
                                                <option value="">Select Status...</option>
                                                <option value="CLOSED">CLOSED</option>
                                                <option value="15% OPEN">15% OPEN</option>
                                                <option value="25% OPEN">25% OPEN</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '2rem' }}>
                                    {editId && (
                                        <button type="button" className="btn-secondary" onClick={handleDeleteConsignee} style={{ padding: '0.8rem 2rem', borderRadius: '999px', color: '#ef4444', borderColor: '#fee2e2', background: '#fef2f2', marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <Trash2 size={20} /> Delete Profile
                                        </button>
                                    )}
                                    <button type="button" className="btn-secondary" onClick={resetForm} style={{ padding: '0.8rem 2rem', borderRadius: '999px' }}>Discard Details</button>
                                    <button type="submit" className="btn-primary" style={{ padding: '0.8rem 2.5rem', borderRadius: '999px', fontSize: '1rem' }}>
                                        {editId ? <><Edit3 size={20} /> Update Profile</> : <><CheckCircle2 size={20} /> Finalize Registration</>}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Premium Action Bar */}
            <div className="consignees-action-bar">
                <div className="search-premium">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder="Search global buyers, ports, or regions..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>
                        Showing {filteredConsignees.length} partner{filteredConsignees.length !== 1 ? 's' : ''}
                    </div>
                    {consignees.length > 0 && (
                        <button
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}
                            onClick={async () => {
                                try {
                                    const { default: ExcelJS } = await import('exceljs');
                                    const wb = new ExcelJS.Workbook();
                                    const ws = wb.addWorksheet('Consignees');
                                    ws.columns = [
                                        { header: 'Company Name', key: 'company_name', width: 28 },
                                        { header: 'Contact Person', key: 'contact_person', width: 22 },
                                        { header: 'Email', key: 'email', width: 28 },
                                        { header: 'Phone', key: 'phone', width: 18 },
                                        { header: 'Country', key: 'country', width: 16 },
                                        { header: 'Port', key: 'default_port', width: 18 },
                                        { header: 'Payment Terms', key: 'payment_terms', width: 16 },
                                        { header: 'Currency', key: 'currency', width: 10 },
                                        { header: 'Status', key: 'status', width: 12 },
                                    ];
                                    ws.getRow(1).eachCell(cell => {
                                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1e3a5f' } };
                                    });
                                    consignees.forEach(c => ws.addRow(c));
                                    await exportXlsx(wb, `Consignees_${new Date().toISOString().split('T')[0]}.xlsx`);
                                } catch (err) { alert('Export failed: ' + err.message); }
                            }}
                        >
                            <Download size={15} /> Export Excel
                        </button>
                    )}
                </div>
            </div>

            {/* Modern List View */}
            <div className="consignee-list-container">
                {filteredConsignees.length === 0 ? (
                    <div className="consignee-empty-state" style={{ background: 'white', borderRadius: '24px', border: '1px dashed #cbd5e1' }}>
                        <img src={emptyIllustration} alt="No Consignees" className="empty-state-illustration" />
                        <h3 className="empty-state-title">No Buyers Registered</h3>
                        <p className="empty-state-text">
                            {consignees.length === 0 
                                ? "Your global network starts here. Onboard your first strategic partner to unlock contract management and automated pricing."
                                : "No partners match your current search parameters."}
                        </p>
                    </div>
                ) : (
                    filteredConsignees.map((consignee, index) => (
                        <motion.div 
                            key={consignee.id}
                            className="consignee-list-item"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05, duration: 0.3 }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                                <div className="company-avatar">
                                    {(consignee.company_name || '??').substring(0, 2).toUpperCase()}
                                </div>
                                <div className="list-cell">
                                    <span className="list-primary" style={{ fontSize: '1.05rem', letterSpacing: '-0.01em' }}>{consignee.company_name}</span>
                                    <span className="list-secondary"><Mail size={14}/> {consignee.email || 'No email on file'}</span>
                                </div>
                            </div>

                            <div className="list-cell">
                                <span className="list-primary" style={{ fontSize: '0.95rem' }}>
                                    <span style={{ fontSize: '1.2rem', marginRight: '6px' }}>{getCountryEmoji(consignee.country)}</span>
                                    {consignee.contact_person || 'Unknown Contact'}
                                </span>
                                <span className="list-secondary"><MapPin size={14}/> {consignee.default_port || 'Unassigned Port'}, {consignee.country}</span>
                            </div>

                            <div className="list-cell" style={{ alignItems: 'flex-start' }}>
                                <span className="badge-pill badge-inactive" style={{ background: '#f8fafc' }}>
                                    <Briefcase size={12} /> {consignee.payment_terms}
                                </span>
                                <span className="list-secondary" style={{ marginTop: '0.35rem', fontWeight: '600' }}>{consignee.currency} Settlement</span>
                            </div>

                            <div className="list-cell">
                                <span className={`badge-pill ${consignee.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}`}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'currentColor' }}></span>
                                    {consignee.status}
                                </span>
                            </div>

                            <div className="list-actions">
                                <button className="btn-prices" onClick={() => handleManageRates(consignee)} title="Manage Pricing Contracts">
                                    <DollarSign size={16} /> Prices
                                </button>
                                <button className="btn-icon" onClick={() => handleEditClick(consignee)} title="Edit Configuration">
                                    <Edit3 size={16} />
                                </button>
                            </div>
                        </motion.div>
                    ))
                )}
            </div>

            {/* Ultra-Glass Pricing Modal */}
            <AnimatePresence>
                {showRatesModal && activeConsigneeForRates && (
                    <motion.div 
                        className="modal-backdrop-premium" 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div 
                            className="modal-glass-premium"
                            initial={{ scale: 0.95, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.95, y: 20, opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        >
                            <div className="modal-header-premium">
                                <div>
                                    <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--brand-dark)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem', letterSpacing: '-0.02em' }}>
                                        <div style={{ padding: '8px', background: 'rgba(37,99,235,0.1)', borderRadius: '12px', color: 'var(--brand-blue)' }}>
                                            <DollarSign size={28} />
                                        </div>
                                        Dynamic Pricing Matrix
                                    </h2>
                                    <p style={{ color: '#64748b', fontSize: '1.05rem', margin: 0 }}>
                                        <strong style={{ color: 'var(--brand-blue)' }}>{activeConsigneeForRates.company_name}</strong> • Week {newWeeklyRate.week_number}, {newWeeklyRate.year}
                                    </p>
                                </div>
                                <button onClick={() => setShowRatesModal(false)} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', color: '#64748b' }}>
                                    <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>×</span>
                                </button>
                            </div>

                            <div className="modal-body-premium">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: 'white', padding: '1.25rem 2rem', borderRadius: '20px', boxShadow: 'var(--shadow-soft)', border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <label className="label-premium" style={{ margin: 0 }}>Fiscal Year</label>
                                            <input type="number" name="year" className="input-premium" value={newWeeklyRate.year} onChange={handleWeeklyRateChange} style={{ width: '100px', padding: '0.5rem 1rem' }} />
                                        </div>
                                        <div style={{ width: '1px', height: '24px', background: '#e2e8f0' }}></div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <label className="label-premium" style={{ margin: 0 }}>Week Sequence No.</label>
                                            <input type="number" name="week_number" className="input-premium" value={newWeeklyRate.week_number} onChange={handleWeeklyRateChange} style={{ width: '100px', padding: '0.5rem 1rem' }} />
                                        </div>
                                    </div>
                                    <button className="btn-secondary" onClick={handleCopyPreviousWeek} style={{ background: 'white', border: '1px solid var(--border-input)', color: 'var(--brand-dark)', padding: '0.75rem 1.5rem', borderRadius: '999px', fontSize: '0.9rem' }}>
                                        <Copy size={16} color="var(--brand-blue)" /> Auto-Fill Previous Week
                                    </button>
                                </div>

                                <div className="price-matrix-grid-premium">
                                    {/* Class A Section */}
                                    <div className="price-card-v2" style={{ '--card-accent': '#2563eb' }}>
                                        <h5 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--brand-dark)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <CheckCircle2 size={22} color="#2563eb" /> Class A <span style={{ fontWeight: '500', color: '#64748b', fontSize: '1rem' }}>(Premium Export)</span>
                                        </h5>
                                        
                                        <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '16px' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.75rem' }}>Regular Hands</span>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                                <div><label className="label-premium">4H</label><input type="number" step="0.01" name="rates_matrix.classA.rha4" className="input-premium" style={{ background: 'white' }} value={newWeeklyRate.rates_matrix['classA.rha4']} onChange={handleWeeklyRateChange} placeholder="0.00" /></div>
                                                <div><label className="label-premium">5H</label><input type="number" step="0.01" name="rates_matrix.classA.rha5" className="input-premium" style={{ background: 'white' }} value={newWeeklyRate.rates_matrix['classA.rha5']} onChange={handleWeeklyRateChange} placeholder="0.00" /></div>
                                                <div><label className="label-premium">6H</label><input type="number" step="0.01" name="rates_matrix.classA.rha6" className="input-premium" style={{ background: 'white' }} value={newWeeklyRate.rates_matrix['classA.rha6']} onChange={handleWeeklyRateChange} placeholder="0.00" /></div>
                                            </div>
                                        </div>
                                        
                                        <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '16px' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.75rem' }}>Small Hands</span>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                                <div><label className="label-premium">7H</label><input type="number" step="0.01" name="rates_matrix.classA.sha7" className="input-premium" style={{ background: 'white' }} value={newWeeklyRate.rates_matrix['classA.sha7']} onChange={handleWeeklyRateChange} placeholder="0.00" /></div>
                                                <div><label className="label-premium">8H</label><input type="number" step="0.01" name="rates_matrix.classA.sha8" className="input-premium" style={{ background: 'white' }} value={newWeeklyRate.rates_matrix['classA.sha8']} onChange={handleWeeklyRateChange} placeholder="0.00" /></div>
                                                <div><label className="label-premium">9H</label><input type="number" step="0.01" name="rates_matrix.classA.sha9" className="input-premium" style={{ background: 'white' }} value={newWeeklyRate.rates_matrix['classA.sha9']} onChange={handleWeeklyRateChange} placeholder="0.00" /></div>
                                            </div>
                                        </div>
                                        
                                        <div style={{ background: '#f0f9ff', padding: '1.25rem', borderRadius: '16px', border: '1px solid #bae6fd' }}>
                                            <div><label className="label-premium" style={{ color: '#0369a1' }}>CLA (Special Class A)</label><input type="number" step="0.01" name="rates_matrix.classA.cla" className="input-premium" style={{ background: 'white', borderColor: '#7dd3fc' }} value={newWeeklyRate.rates_matrix['classA.cla']} onChange={handleWeeklyRateChange} placeholder="0.00" /></div>
                                        </div>
                                    </div>

                                    {/* Class B Section */}
                                    <div className="price-card-v2" style={{ '--card-accent': '#f59e0b' }}>
                                        <h5 style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--brand-dark)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <AlertCircle size={22} color="#f59e0b" /> Class B & Cluster
                                        </h5>
                                        
                                        <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '16px' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.75rem' }}>Regular Hands</span>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                                <div><label className="label-premium">RHB4</label><input type="number" step="0.01" name="rates_matrix.classB.rhb4" className="input-premium" style={{ background: 'white' }} value={newWeeklyRate.rates_matrix['classB.rhb4']} onChange={handleWeeklyRateChange} placeholder="0.00" /></div>
                                                <div><label className="label-premium">RHB5</label><input type="number" step="0.01" name="rates_matrix.classB.rhb5" className="input-premium" style={{ background: 'white' }} value={newWeeklyRate.rates_matrix['classB.rhb5']} onChange={handleWeeklyRateChange} placeholder="0.00" /></div>
                                                <div><label className="label-premium">RHB6</label><input type="number" step="0.01" name="rates_matrix.classB.rhb6" className="input-premium" style={{ background: 'white' }} value={newWeeklyRate.rates_matrix['classB.rhb6']} onChange={handleWeeklyRateChange} placeholder="0.00" /></div>
                                            </div>
                                        </div>
                                        
                                        <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '16px' }}>
                                            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.75rem' }}>Small Hands</span>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                <div><label className="label-premium">SHB7</label><input type="number" step="0.01" name="rates_matrix.classB.shb7" className="input-premium" style={{ background: 'white' }} value={newWeeklyRate.rates_matrix['classB.shb7']} onChange={handleWeeklyRateChange} placeholder="0.00" /></div>
                                                <div><label className="label-premium">SHB8/9</label><input type="number" step="0.01" name="rates_matrix.classB.shb8" className="input-premium" style={{ background: 'white' }} value={newWeeklyRate.rates_matrix['classB.shb8']} onChange={handleWeeklyRateChange} placeholder="0.00" /></div>
                                            </div>
                                        </div>
                                        
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                            <div style={{ background: '#fef3c7', padding: '1.25rem', borderRadius: '16px', border: '1px solid #fde68a' }}>
                                                <div><label className="label-premium" style={{ color: '#b45309' }}>CLB</label><input type="number" step="0.01" name="rates_matrix.classB.clb" className="input-premium" style={{ background: 'white', borderColor: '#fcd34d' }} value={newWeeklyRate.rates_matrix['classB.clb']} onChange={handleWeeklyRateChange} placeholder="0.00" /></div>
                                            </div>
                                            <div style={{ background: '#fef3c7', padding: '1.25rem', borderRadius: '16px', border: '1px solid #fde68a' }}>
                                                <div><label className="label-premium" style={{ color: '#b45309' }}>FP (Cluster)</label><input type="number" step="0.01" name="rates_matrix.classB.fp" className="input-premium" style={{ background: 'white', borderColor: '#fcd34d' }} value={newWeeklyRate.rates_matrix['classB.fp']} onChange={handleWeeklyRateChange} placeholder="0.00" /></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer-premium">
                                <button className="btn-secondary" onClick={() => setShowRatesModal(false)} style={{ padding: '0.8rem 2.5rem', borderRadius: '999px', background: '#f1f5f9', border: 'none' }}>Cancel</button>
                                <button className="btn-primary" onClick={handleAddWeeklyRate} style={{ padding: '0.8rem 3rem', borderRadius: '999px', fontSize: '1rem', background: 'linear-gradient(135deg, #2563eb, #1e40af)', border: 'none', boxShadow: '0 10px 20px -5px rgba(37,99,235,0.4)', color: 'white' }}>
                                    <CheckCircle2 size={20} /> Deploy Contract Pricing
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default Consignees;
