import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, Globe, DollarSign, Calendar, 
    Search, Plus, Edit3, Trash2, Download,
    ArrowLeft, Copy, CheckCircle2, 
    Building2, Mail, Phone, MapPin,
    AlertCircle, Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import './Consignees.css';
import { supabase } from '../supabaseClient';
import { exportXlsx } from '../utils/exportXlsx';
import emptyIllustration from '../assets/consignee_registry_empty_illustration.png';
import ConsigneeForm from './Consignees/ConsigneeForm';
import PricingModal from './Consignees/PricingModal';
import { useQueryClient } from '@tanstack/react-query';
import { useConsigneesQuery, useConsigneeWeeklyRatesQuery } from '../queries/hooks';

const Consignees = () => {
    const queryClient = useQueryClient();
    const { data: consignees = [] } = useConsigneesQuery();
    const { data: consigneeWeeklyRates = [] } = useConsigneeWeeklyRatesQuery();
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
            toast.error(`⚠️ Database Insert Failed: ${error.message || error.details || 'Unknown constraint error.'}`);
            return;
        }

        queryClient.invalidateQueries({ queryKey: ['consignee_weekly_rates'] });
        setShowRatesModal(false);
    };

    const handleSaveConsignee = async (e) => {
        e.preventDefault();

        const consigneeData = {
            ...newConsignee,
            last_modified: new Date().toISOString()
        };

        if (editId) {
            const { id, created_at, ...updatePayload } = consigneeData;
            const { data, error } = await supabase
                .from('consignees')
                .update(updatePayload)
                .eq('id', editId)
                .select();

            if (error) {
                console.error("Supabase error (Edit Consignee):", error);
                toast.error("Failed to update consignee.");
                return;
            }
            queryClient.invalidateQueries({ queryKey: ['consignees'] });
            resetForm();
        } else {
            const { id, ...dataWithoutId } = consigneeData;
            const { data, error } = await supabase
                .from('consignees')
                .insert([dataWithoutId])
                .select();

            if (error) {
                console.error("Supabase error (New Consignee):", error);
                toast.error("Failed to register new consignee.");
                return;
            }
            if (data && data.length > 0) {
                queryClient.invalidateQueries({ queryKey: ['consignees'] });
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
            toast.error("Failed to delete consignee.");
            return;
        }

        queryClient.invalidateQueries({ queryKey: ['consignees'] });
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
            toast.warning("No previous rates found to copy.");
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
            <ConsigneeForm
                isFormOpen={isFormOpen}
                editId={editId}
                newConsignee={newConsignee}
                handleInputChange={handleInputChange}
                handleBananaTypeToggle={handleBananaTypeToggle}
                handleSaveConsignee={handleSaveConsignee}
                handleDeleteConsignee={handleDeleteConsignee}
                resetForm={resetForm}
            />

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
                                } catch (err) { toast.error('Export failed: ' + err.message); }
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
            <PricingModal
                showRatesModal={showRatesModal}
                setShowRatesModal={setShowRatesModal}
                activeConsigneeForRates={activeConsigneeForRates}
                newWeeklyRate={newWeeklyRate}
                handleWeeklyRateChange={handleWeeklyRateChange}
                handleAddWeeklyRate={handleAddWeeklyRate}
                handleCopyPreviousWeek={handleCopyPreviousWeek}
            />
        </motion.div>
    );
};

export default Consignees;
