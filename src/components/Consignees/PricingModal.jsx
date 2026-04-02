import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, CheckCircle2, Copy, AlertCircle } from 'lucide-react';

const PricingModal = ({
    showRatesModal,
    setShowRatesModal,
    activeConsigneeForRates,
    newWeeklyRate,
    handleWeeklyRateChange,
    handleAddWeeklyRate,
    handleCopyPreviousWeek
}) => {
    return (
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
    );
};

export default PricingModal;
