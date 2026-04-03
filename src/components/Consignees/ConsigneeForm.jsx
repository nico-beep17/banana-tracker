import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Globe, AlertCircle, Edit3, Trash2, CheckCircle2 } from 'lucide-react';

const ConsigneeForm = ({
    isFormOpen,
    editId,
    newConsignee,
    handleInputChange,
    handleBananaTypeToggle,
    handleSaveConsignee,
    handleDeleteConsignee,
    resetForm
}) => {
    return (
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
                                            <option value="5% OPEN">5% OPEN</option>
                                            <option value="10% OPEN">10% OPEN</option>
                                            <option value="15% OPEN">15% OPEN</option>
                                            <option value="20% OPEN">20% OPEN</option>
                                            <option value="25% OPEN">25% OPEN</option>
                                            <option value="30% OPEN">30% OPEN</option>
                                            <option value="35% OPEN">35% OPEN</option>
                                            <option value="40% OPEN">40% OPEN</option>
                                            <option value="45% OPEN">45% OPEN</option>
                                            <option value="50% OPEN">50% OPEN</option>
                                            <option value="FULLY OPEN">FULLY OPEN</option>
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
    );
};

export default ConsigneeForm;
