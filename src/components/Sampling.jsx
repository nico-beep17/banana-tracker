import React, { useState } from 'react';
import './ArrivalForm.css';
import { supabase } from '../supabaseClient';

const Sampling = ({ farms = [], samplings = [], setSamplings, onNavigate, initialFarmCode }) => {
    const [formData, setFormData] = useState({
        farmCode: initialFarmCode || '',
        dateOfPacking: new Date().toISOString().split('T')[0],
        qualityInspector: '',
        brand: ''
    });

    // Dynamic array for individual box evaluations
    const [boxEvaluations, setBoxEvaluations] = useState([
        { id: 1, evaluationDetails: '', decision: 'A- Clean no defect', handsType: '' },
        { id: 2, evaluationDetails: '', decision: 'A- Clean no defect', handsType: '' },
        { id: 3, evaluationDetails: '', decision: 'A- Clean no defect', handsType: '' },
        { id: 4, evaluationDetails: '', decision: 'A- Clean no defect', handsType: '' },
        { id: 5, evaluationDetails: '', decision: 'A- Clean no defect', handsType: '' }
    ]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleBoxChange = (id, field, value) => {
        setBoxEvaluations(prev => prev.map(box =>
            box.id === id ? { ...box, [field]: value } : box
        ));
    };

    const handleAddBox = () => {
        setBoxEvaluations(prev => [
            ...prev,
            // Use Date.now() for unique IDs when appending dynamically
            { id: Date.now(), evaluationDetails: '', decision: 'A- Clean no defect', handsType: '' }
        ]);
    };

    const handleRemoveBox = (idToRemove) => {
        setBoxEvaluations(prev => prev.filter(box => box.id !== idToRemove));
    };

    const handleSaveSampling = async (e) => {
        e.preventDefault();

        if (!formData.farmCode) {
            alert("Please select a farm first.");
            return;
        }

        const newSamplingLog = {
            id: `SAMP-${Date.now()}`,
            farmCode: formData.farmCode,
            farmName: farms.find(f => f.farmCode === formData.farmCode)?.name || '',
            date: formData.dateOfPacking,
            inspector: formData.qualityInspector,
            brand: formData.brand,
            totalBoxes: boxEvaluations.length,
            boxes: boxEvaluations,
            overallDecision: boxEvaluations.some(b => b.decision.startsWith('C-')) ? 'REJECTED' : 'PROCEED',
            encodedAt: new Date().toISOString()
        };

        const { data, error } = await supabase
            .from('samplings')
            .insert([newSamplingLog])
            .select();

        if (error) {
            console.error("Supabase error (Sampling):", error);
            alert(`Failed to save daily sampling: ${error.message || 'Unknown error'}`);
            return;
        }

        if (data && data.length > 0) {
            setSamplings(prev => [...prev, data[0]]);
            alert("Sampling logged successfully.");

            if (onNavigate) {
                onNavigate('log-arrival');
            }
        }
    };

    return (
        <div className="card form-container">
            <div className="form-header">
                <h2>Daily Quality Sampling</h2>
                <p className="subtitle">Evaluate the first delivery of the day for a specific farm to unlock their Arrival Log.</p>
            </div>

            <form onSubmit={handleSaveSampling} className="arrival-form" style={{ marginTop: '2rem' }}>
                <div className="form-section highlight-yellow" style={{ borderLeft: '4px solid var(--warning)' }}>
                    <div className="grid-2">
                        <div className="form-group">
                            <label className="label">Target Farm</label>
                            <select name="farmCode" className="input-field" value={formData.farmCode} onChange={handleChange} required>
                                <option value="" disabled>Select a farm...</option>
                                {farms.map(farm => (
                                    <option key={farm.id} value={farm.farmCode}>{farm.name} ({farm.farmCode})</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="label">Date of Packing</label>
                            <input type="date" name="dateOfPacking" className="input-field" value={formData.dateOfPacking} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label className="label">Quality Inspector</label>
                            <input type="text" name="qualityInspector" className="input-field" placeholder="E.g. John Doe" value={formData.qualityInspector} onChange={handleChange} required />
                        </div>
                        <div className="form-group">
                            <label className="label">Brand</label>
                            <input type="text" name="brand" className="input-field" placeholder="E.g. LFJ" value={formData.brand} onChange={handleChange} required />
                        </div>
                    </div>
                </div>

                {/* Dynamic Box Evaluations */}
                <div className="box-evaluations" style={{ marginTop: '2rem' }}>
                    <div className="section-header-flex" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                        <h3 style={{ margin: 0 }}>Per-Box Evaluations</h3>
                        <button type="button" className="btn-secondary" onClick={handleAddBox} style={{ padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}>
                            + Evaluate another box
                        </button>
                    </div>

                    {boxEvaluations.map((box, index) => (
                        <div key={box.id} className="box-card" style={{ backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-md)', padding: '1rem', marginBottom: '1rem', position: 'relative' }}>
                            <div className="section-header-flex" style={{ marginBottom: '1rem' }}>
                                <h4 style={{ color: 'var(--text-secondary)', margin: 0 }}>Box {index + 1}</h4>
                                {index >= 5 && (
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                                        onClick={() => handleRemoveBox(box.id)}
                                    >
                                        Remove Box
                                    </button>
                                )}
                            </div>

                            <div className="grid-2">
                                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                    <label className="label">Evaluation Details & Remarks</label>
                                    <textarea
                                        className="input-field"
                                        rows="2"
                                        placeholder={`Describe any defects found in Box ${index + 1}...`}
                                        value={box.evaluationDetails}
                                        onChange={(e) => handleBoxChange(box.id, 'evaluationDetails', e.target.value)}
                                        required
                                    ></textarea>
                                </div>
                                <div className="form-group">
                                    <label className="label">Hands Class Type</label>
                                    <select
                                        className="input-field"
                                        value={box.handsType}
                                        onChange={(e) => handleBoxChange(box.id, 'handsType', e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>Select Type...</option>
                                        <option value="4H">4H</option>
                                        <option value="5H">5H</option>
                                        <option value="6H">6H</option>
                                        <option value="7H">7H</option>
                                        <option value="8H">8H</option>
                                        <option value="9H">9H</option>
                                        <option value="CL">Cluster (CL)</option>
                                        <option value="FP">Finger Pack (FP)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="label">Upload Defect Image (Optional)</label>
                                    <input type="file" className="input-field" accept="image/*" />
                                </div>
                                <div className="form-group">
                                    <label className="label">Box Decision (Grading)</label>
                                    <select
                                        className="input-field"
                                        value={box.decision}
                                        onChange={(e) => handleBoxChange(box.id, 'decision', e.target.value)}
                                        required
                                    >
                                        <option value="A- Clean no defect">A - Clean no defect</option>
                                        <option value="B- with defect within tolerance">B - With defect within tolerance</option>
                                        <option value="C- defect without tolerance">C - Defect without tolerance</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="form-actions" style={{ marginTop: '2rem', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn-primary">Save Sampling Result</button>
                </div>
            </form>

            {/* View Historical Logs */}
            <div className="form-section" style={{ marginTop: '2rem' }}>
                <h3>Today's Sampling Logs</h3>
                {samplings.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>No samplings have been recorded yet.</p>
                ) : (
                    <div className="table-responsive" style={{ marginTop: '1rem' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Farm Code</th>
                                    <th>Date</th>
                                    <th>Result</th>
                                    <th>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {samplings.map(samp => (
                                    <tr key={samp.id}>
                                        <td className="font-medium">{samp.farmCode}</td>
                                        <td>{samp.date || samp.dateOfPacking}</td>
                                        <td>
                                            <span className={`status-badge ${samp.overallDecision === 'PROCEED' ? 'status-received' : 'status-draft'}`} style={{ backgroundColor: samp.overallDecision === 'REJECTED' || String(samp.decision).startsWith('C-') ? '#fee2e2' : undefined, color: samp.overallDecision === 'REJECTED' || String(samp.decision).startsWith('C-') ? '#dc2626' : undefined }}>
                                                {samp.overallDecision || samp.decision}
                                            </span>
                                        </td>
                                        <td className="truncate" style={{ maxWidth: '200px' }}>
                                            {samp.boxes && samp.boxes.length > 0 ? samp.boxes[0].evaluationDetails : (samp.evaluationDetails || '-')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Sampling;
