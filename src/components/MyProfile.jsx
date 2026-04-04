import React, { useState, useEffect, useMemo } from 'react';
import { User, Heart, GraduationCap, Briefcase, Star, Users, ChevronDown, X, Save, Plus, Trash2, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import './MyProfile.css';

const EMPTY_PROFILE = {
    // Personal Information
    date_of_birth: '',
    place_of_birth: '',
    sex: '',
    civil_status: '',
    nationality: 'Filipino',
    religion: '',
    height: '',
    weight: '',
    blood_type: '',
    contact_number: '',
    home_address: '',
    bir_tin: '',
    pagibig_number: '',
    philhealth_number: '',
    sss_number: '',
    // Family Background
    father_name: '',
    father_occupation: '',
    mother_name: '',
    mother_occupation: '',
    spouse_name: '',
    spouse_occupation: '',
    children: [],
    // Education
    education: {
        elementary: { school: '', year: '', honors: '' },
        secondary: { school: '', year: '', honors: '' },
        tertiary: { school: '', year: '', honors: '' },
        vocational: { school: '', year: '', honors: '' },
    },
    trainings: [],
    // Employment
    employment_history: [],
    // Skills
    skills: '',
    // References
    character_references: [],
};

const SECTIONS = [
    { id: 'personal', label: 'Personal Information', icon: User, color: '#3b82f6', bg: '#eff6ff', subtitle: 'Basic details, government IDs, contact' },
    { id: 'family', label: 'Family Background', icon: Heart, color: '#ec4899', bg: '#fdf2f8', subtitle: 'Parents, spouse, children' },
    { id: 'education', label: 'Educational Background', icon: GraduationCap, color: '#8b5cf6', bg: '#f5f3ff', subtitle: 'Schools, trainings, honors' },
    { id: 'employment', label: 'Employment History', icon: Briefcase, color: '#f59e0b', bg: '#fffbeb', subtitle: 'Previous companies and positions' },
    { id: 'skills', label: 'Skills & Qualifications', icon: Star, color: '#10b981', bg: '#f0fdf4', subtitle: 'Competencies and certifications' },
    { id: 'references', label: 'Character References', icon: Users, color: '#6366f1', bg: '#eef2ff', subtitle: 'Professional references' },
];

const MyProfile = ({ isOpen, onClose, userProfile }) => {
    const [formData, setFormData] = useState(EMPTY_PROFILE);
    const [openSections, setOpenSections] = useState(['personal']);
    const [saving, setSaving] = useState(false);
    const [loaded, setLoaded] = useState(false);

    // Load existing CV data from Supabase on open
    useEffect(() => {
        if (isOpen && userProfile?.id) {
            loadProfile();
        }
    }, [isOpen, userProfile?.id]);

    const loadProfile = async () => {
        try {
            const { data, error } = await supabase
                .from('employee_cv')
                .select('*')
                .eq('user_id', userProfile.id)
                .maybeSingle();

            if (data) {
                setFormData(prev => ({
                    ...prev,
                    ...data.cv_data,
                }));
            }
            setLoaded(true);
        } catch (e) {
            console.error('Failed to load CV:', e);
            setLoaded(true);
        }
    };

    // Completion percentage
    const completionPct = useMemo(() => {
        const checks = [
            formData.date_of_birth,
            formData.place_of_birth,
            formData.sex,
            formData.civil_status,
            formData.contact_number,
            formData.home_address,
            formData.bir_tin,
            formData.sss_number,
            formData.philhealth_number,
            formData.pagibig_number,
            formData.father_name,
            formData.mother_name,
            formData.education?.elementary?.school,
            formData.education?.secondary?.school,
            formData.skills,
            (formData.character_references || []).length > 0,
        ];
        const filled = checks.filter(Boolean).length;
        return Math.round((filled / checks.length) * 100);
    }, [formData]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleNestedChange = (section, field, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: { ...prev[section], [field]: value }
        }));
    };

    const handleEducationChange = (level, field, value) => {
        setFormData(prev => ({
            ...prev,
            education: {
                ...prev.education,
                [level]: { ...prev.education[level], [field]: value }
            }
        }));
    };

    // Repeater helpers
    const addRepeaterItem = (field, template) => {
        setFormData(prev => ({
            ...prev,
            [field]: [...(prev[field] || []), { ...template, _id: Date.now() }]
        }));
    };
    const updateRepeaterItem = (field, index, key, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].map((item, i) => i === index ? { ...item, [key]: value } : item)
        }));
    };
    const removeRepeaterItem = (field, index) => {
        setFormData(prev => ({
            ...prev,
            [field]: prev[field].filter((_, i) => i !== index)
        }));
    };

    const toggleSection = (id) => {
        setOpenSections(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const handleSave = async () => {
        if (!userProfile?.id) return;
        setSaving(true);
        try {
            const payload = {
                user_id: userProfile.id,
                full_name: userProfile.full_name,
                cv_data: formData,
                completion_pct: completionPct,
                updated_at: new Date().toISOString(),
            };
            const { error } = await supabase
                .from('employee_cv')
                .upsert(payload, { onConflict: 'user_id' });

            if (error) throw error;
            toast.success('Profile saved successfully!');
        } catch (e) {
            console.error('Save error:', e);
            toast.error(`Failed to save profile: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const renderField = (label, field, type = 'text', options = {}) => (
        <div className={`profile-field ${options.fullWidth ? 'full-width' : ''}`}>
            <label>{label}</label>
            {type === 'select' ? (
                <select value={formData[field] || ''} onChange={e => handleChange(field, e.target.value)}>
                    <option value="">Select...</option>
                    {(options.choices || []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            ) : type === 'textarea' ? (
                <textarea
                    value={formData[field] || ''}
                    onChange={e => handleChange(field, e.target.value)}
                    placeholder={options.placeholder || ''}
                    rows={options.rows || 3}
                />
            ) : (
                <input
                    type={type}
                    value={formData[field] || ''}
                    onChange={e => handleChange(field, e.target.value)}
                    placeholder={options.placeholder || ''}
                />
            )}
        </div>
    );

    const renderEducationRow = (level, label) => (
        <div key={level} style={{ marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>{label}</div>
            <div className="profile-form-grid" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
                <div className="profile-field">
                    <label>School / Institution</label>
                    <input value={formData.education?.[level]?.school || ''} onChange={e => handleEducationChange(level, 'school', e.target.value)} placeholder="School name" />
                </div>
                <div className="profile-field">
                    <label>Year Graduated</label>
                    <input value={formData.education?.[level]?.year || ''} onChange={e => handleEducationChange(level, 'year', e.target.value)} placeholder="e.g. 2018" />
                </div>
                <div className="profile-field">
                    <label>Honors</label>
                    <input value={formData.education?.[level]?.honors || ''} onChange={e => handleEducationChange(level, 'honors', e.target.value)} placeholder="If any" />
                </div>
            </div>
        </div>
    );

    return (
        <div className="my-profile-overlay" onClick={onClose}>
            <div className="my-profile-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="profile-modal-header">
                    <div>
                        <h2><Shield size={22} /> Employee Profile</h2>
                        <div className="subtitle">Curriculum Vitae — {userProfile?.full_name || 'Team Member'}</div>
                    </div>
                    <button className="profile-close-btn" onClick={onClose}><X size={18} /></button>
                </div>

                {/* Completion Bar */}
                <div className="profile-completion-bar">
                    <span style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>Profile Completion</span>
                    <div className="bar-track">
                        <div className="bar-fill" style={{
                            width: `${completionPct}%`,
                            background: completionPct >= 80 ? 'linear-gradient(90deg, #10b981, #059669)' : completionPct >= 50 ? 'linear-gradient(90deg, #f59e0b, #d97706)' : 'linear-gradient(90deg, #ef4444, #dc2626)',
                        }} />
                    </div>
                    <span className="bar-label" style={{
                        color: completionPct >= 80 ? '#059669' : completionPct >= 50 ? '#d97706' : '#dc2626'
                    }}>{completionPct}%</span>
                </div>

                {completionPct < 50 && (
                    <div style={{ padding: '0.75rem 2rem', background: '#fffbeb', borderBottom: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: '#92400e' }}>
                        <AlertCircle size={16} />
                        <span>Please complete your profile — HR requires this information for your employment records.</span>
                    </div>
                )}

                {/* Body — Accordion Sections */}
                <div className="profile-modal-body">
                    {SECTIONS.map(section => {
                        const isOpen = openSections.includes(section.id);
                        const Icon = section.icon;

                        return (
                            <div className="profile-section" key={section.id}>
                                <button className="profile-section-header" onClick={() => toggleSection(section.id)}>
                                    <div className="section-icon" style={{ background: section.bg, color: section.color }}>
                                        <Icon size={18} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3>{section.label}</h3>
                                        <div className="section-subtitle">{section.subtitle}</div>
                                    </div>
                                    <ChevronDown size={18} className={`chevron ${isOpen ? 'open' : ''}`} />
                                </button>

                                {isOpen && (
                                    <div className="profile-section-body">
                                        {/* PERSONAL INFORMATION */}
                                        {section.id === 'personal' && (
                                            <>
                                                <div className="profile-form-grid">
                                                    {renderField('Date of Birth', 'date_of_birth', 'date')}
                                                    {renderField('Place of Birth', 'place_of_birth', 'text', { placeholder: 'City, Province' })}
                                                    {renderField('Sex', 'sex', 'select', { choices: ['Male', 'Female'] })}
                                                    {renderField('Civil Status', 'civil_status', 'select', { choices: ['Single', 'Married', 'Widowed', 'Separated'] })}
                                                    {renderField('Nationality', 'nationality', 'text', { placeholder: 'Filipino' })}
                                                    {renderField('Religion', 'religion', 'text', { placeholder: 'e.g. Roman Catholic' })}
                                                    {renderField('Height', 'height', 'text', { placeholder: `e.g. 5'7"` })}
                                                    {renderField('Weight', 'weight', 'text', { placeholder: 'e.g. 65 kg' })}
                                                    {renderField('Blood Type', 'blood_type', 'select', { choices: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] })}
                                                    {renderField('Contact Number', 'contact_number', 'tel', { placeholder: '09XX XXX XXXX' })}
                                                    {renderField('Email Address', 'email_address', 'email', { placeholder: 'name@company.com' })}
                                                </div>
                                                <div className="profile-form-grid" style={{ marginTop: '0.75rem' }}>
                                                    {renderField('Home Address', 'home_address', 'text', { placeholder: 'House No., Street, Brgy, City', fullWidth: true })}
                                                </div>
                                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #e2e8f0' }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Government ID Numbers</div>
                                                    <div className="profile-form-grid">
                                                        {renderField('BIR TIN Number', 'bir_tin', 'text', { placeholder: 'XXX-XXX-XXX-000' })}
                                                        {renderField('Pag-IBIG Number', 'pagibig_number', 'text', { placeholder: 'XXXX-XXXX-XXXX' })}
                                                        {renderField('PhilHealth Number', 'philhealth_number', 'text', { placeholder: 'XX-XXXXXXXXX-X' })}
                                                        {renderField('SSS Number', 'sss_number', 'text', { placeholder: 'XX-XXXXXXX-X' })}
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {/* FAMILY BACKGROUND */}
                                        {section.id === 'family' && (
                                            <>
                                                <div className="profile-form-grid two-col">
                                                    {renderField(`Father's Name`, 'father_name', 'text', { placeholder: 'Full Name' })}
                                                    {renderField(`Father's Occupation`, 'father_occupation')}
                                                    {renderField(`Mother's Name`, 'mother_name', 'text', { placeholder: 'Full Maiden Name' })}
                                                    {renderField(`Mother's Occupation`, 'mother_occupation')}
                                                    {renderField(`Spouse's Name`, 'spouse_name', 'text', { placeholder: 'If married' })}
                                                    {renderField(`Spouse's Occupation`, 'spouse_occupation')}
                                                </div>

                                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #e2e8f0' }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Children</div>
                                                    {(formData.children || []).map((child, i) => (
                                                        <div className="profile-repeater-item" key={child._id || i}>
                                                            <div className="fields">
                                                                <div className="profile-field">
                                                                    <label>Name</label>
                                                                    <input value={child.name || ''} onChange={e => updateRepeaterItem('children', i, 'name', e.target.value)} placeholder="Child's full name" />
                                                                </div>
                                                                <div className="profile-field">
                                                                    <label>Age</label>
                                                                    <input type="number" value={child.age || ''} onChange={e => updateRepeaterItem('children', i, 'age', e.target.value)} placeholder="Age" />
                                                                </div>
                                                            </div>
                                                            <button className="profile-remove-btn" onClick={() => removeRepeaterItem('children', i)}><Trash2 size={16} /></button>
                                                        </div>
                                                    ))}
                                                    <button className="profile-add-btn" onClick={() => addRepeaterItem('children', { name: '', age: '' })}>
                                                        <Plus size={14} /> Add Child
                                                    </button>
                                                </div>
                                            </>
                                        )}

                                        {/* EDUCATIONAL BACKGROUND */}
                                        {section.id === 'education' && (
                                            <>
                                                {renderEducationRow('elementary', 'Elementary')}
                                                {renderEducationRow('secondary', 'Secondary / High School')}
                                                {renderEducationRow('tertiary', 'Tertiary / College')}
                                                {renderEducationRow('vocational', 'Vocational')}

                                                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #e2e8f0' }}>
                                                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trainings / Seminars</div>
                                                    {(formData.trainings || []).map((t, i) => (
                                                        <div className="profile-repeater-item" key={t._id || i}>
                                                            <div className="fields" style={{ gridTemplateColumns: '2fr 1fr' }}>
                                                                <div className="profile-field">
                                                                    <label>Training / Seminar</label>
                                                                    <input value={t.name || ''} onChange={e => updateRepeaterItem('trainings', i, 'name', e.target.value)} placeholder="Name of training" />
                                                                </div>
                                                                <div className="profile-field">
                                                                    <label>Year</label>
                                                                    <input value={t.year || ''} onChange={e => updateRepeaterItem('trainings', i, 'year', e.target.value)} placeholder="Year" />
                                                                </div>
                                                            </div>
                                                            <button className="profile-remove-btn" onClick={() => removeRepeaterItem('trainings', i)}><Trash2 size={16} /></button>
                                                        </div>
                                                    ))}
                                                    <button className="profile-add-btn" onClick={() => addRepeaterItem('trainings', { name: '', year: '' })}>
                                                        <Plus size={14} /> Add Training
                                                    </button>
                                                </div>
                                            </>
                                        )}

                                        {/* EMPLOYMENT HISTORY */}
                                        {section.id === 'employment' && (
                                            <>
                                                {(formData.employment_history || []).map((emp, i) => (
                                                    <div className="profile-repeater-item" key={emp._id || i} style={{ gridTemplateColumns: '1fr auto' }}>
                                                        <div className="fields" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                                            <div className="profile-field">
                                                                <label>Company</label>
                                                                <input value={emp.company || ''} onChange={e => updateRepeaterItem('employment_history', i, 'company', e.target.value)} placeholder="Company name" />
                                                            </div>
                                                            <div className="profile-field">
                                                                <label>Position</label>
                                                                <input value={emp.position || ''} onChange={e => updateRepeaterItem('employment_history', i, 'position', e.target.value)} placeholder="Job title" />
                                                            </div>
                                                            <div className="profile-field">
                                                                <label>Inclusive Dates</label>
                                                                <input value={emp.dates || ''} onChange={e => updateRepeaterItem('employment_history', i, 'dates', e.target.value)} placeholder="e.g. Jan 2020 - Dec 2022" />
                                                            </div>
                                                            <div className="profile-field">
                                                                <label>Reason for Leaving</label>
                                                                <input value={emp.reason || ''} onChange={e => updateRepeaterItem('employment_history', i, 'reason', e.target.value)} placeholder="e.g. Career growth" />
                                                            </div>
                                                        </div>
                                                        <button className="profile-remove-btn" onClick={() => removeRepeaterItem('employment_history', i)}><Trash2 size={16} /></button>
                                                    </div>
                                                ))}
                                                <button className="profile-add-btn" onClick={() => addRepeaterItem('employment_history', { company: '', position: '', dates: '', reason: '' })}>
                                                    <Plus size={14} /> Add Employment Record
                                                </button>
                                                {(formData.employment_history || []).length === 0 && (
                                                    <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', padding: '1.5rem', border: '1px dashed #e2e8f0', borderRadius: '10px', marginTop: '0.5rem' }}>
                                                        No employment records yet. Click "Add Employment Record" to start.
                                                    </div>
                                                )}
                                            </>
                                        )}

                                        {/* SKILLS & QUALIFICATIONS */}
                                        {section.id === 'skills' && (
                                            <div className="profile-field full-width">
                                                <label>List your skills, certifications, and qualifications</label>
                                                <textarea
                                                    value={formData.skills || ''}
                                                    onChange={e => handleChange('skills', e.target.value)}
                                                    rows={5}
                                                    placeholder="e.g. Forklift Operation, HACCP Certified, MS Office, Heavy Equipment Operator..."
                                                />
                                            </div>
                                        )}

                                        {/* CHARACTER REFERENCES */}
                                        {section.id === 'references' && (
                                            <>
                                                {(formData.character_references || []).map((ref, i) => (
                                                    <div className="profile-repeater-item" key={ref._id || i} style={{ gridTemplateColumns: '1fr auto' }}>
                                                        <div className="fields" style={{ gridTemplateColumns: '1fr 1fr' }}>
                                                            <div className="profile-field">
                                                                <label>Name</label>
                                                                <input value={ref.name || ''} onChange={e => updateRepeaterItem('character_references', i, 'name', e.target.value)} placeholder="Full name" />
                                                            </div>
                                                            <div className="profile-field">
                                                                <label>Position</label>
                                                                <input value={ref.position || ''} onChange={e => updateRepeaterItem('character_references', i, 'position', e.target.value)} placeholder="Job title" />
                                                            </div>
                                                            <div className="profile-field">
                                                                <label>Company</label>
                                                                <input value={ref.company || ''} onChange={e => updateRepeaterItem('character_references', i, 'company', e.target.value)} placeholder="Company name" />
                                                            </div>
                                                            <div className="profile-field">
                                                                <label>Contact Number</label>
                                                                <input value={ref.contact || ''} onChange={e => updateRepeaterItem('character_references', i, 'contact', e.target.value)} placeholder="Phone number" />
                                                            </div>
                                                        </div>
                                                        <button className="profile-remove-btn" onClick={() => removeRepeaterItem('character_references', i)}><Trash2 size={16} /></button>
                                                    </div>
                                                ))}
                                                <button className="profile-add-btn" onClick={() => addRepeaterItem('character_references', { name: '', position: '', company: '', contact: '' })}>
                                                    <Plus size={14} /> Add Reference
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Save Footer */}
                <div className="profile-save-footer">
                    <button className="btn-save" onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-flex' }}>⟳</span> Saving...</>
                        ) : (
                            <><Save size={16} /> Save Profile</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MyProfile;
