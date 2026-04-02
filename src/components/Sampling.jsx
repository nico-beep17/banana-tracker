import React, { useState, useRef } from 'react';
import './ArrivalForm.css';
import { supabase } from '../supabaseClient';
import { exportXlsx } from '../utils/exportXlsx';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useFarmsQuery, useSamplingsQuery } from '../queries/hooks';

const isNative = window.Capacitor && window.Capacitor.isNativePlatform();

// Opens native photo gallery on APK, file picker on web
async function pickDefectImage(fileInputRef, onPicked) {
    if (isNative) {
        try {
            const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
            const photo = await Camera.getPhoto({
                resultType: CameraResultType.DataUrl,
                source: CameraSource.Photos,
                quality: 80,
            });
            onPicked(photo.dataUrl, null);
        } catch (e) {
            if (!String(e).includes('cancelled')) {
                toast.error('Could not open gallery: ' + e);
            }
        }
    } else {
        fileInputRef.current?.click();
    }
}

const LABEL_DEFECTS = [
    { code: 'CS', name: 'Corky Scab', aTol: 'Max 1/2 LABEL SIZE/Hand scattered (No other defect)', bTol: 'Max 1 LABEL SIZE/Hand scattered', clfpTol: 'Max 1/4 LABEL SIZE/CL-FP scattered (No other defect)' },
    { code: 'CRS', name: 'Crown Ride Scar', aTol: 'Max 2 Fingers/Hand with 1/2 LABEL SIZE (No other defect)', bTol: 'Max 2 Fingers/Hand with 1 LABEL SIZE', clfpTol: 'Max 1 Finger/CL-FP with 1/4 LABEL SIZE (No other defect)' },
    { code: 'FK', name: 'Freckles', aTol: 'Max 1/2 LABEL SIZE/Hand scattered (No other defect)', bTol: 'Max 1 LABEL SIZE/Hand scattered', clfpTol: 'Max 1/2 LABEL SIZE/CL-FP scattered (No other defect)' },
    { code: 'LSN', name: 'Latex Stain New', aTol: 'Max 2 Fingers/Hand with 1/2 LABEL SIZE (No other defect)', bTol: 'Max 2 Fingers/Hand with 1 LABEL SIZE', clfpTol: 'Max 1 Finger/CL-FP with 1/4 LABEL SIZE (No other defect)' },
    { code: 'LSO', name: 'Latex Stain Old', aTol: 'Max 2 Fingers/Hand with 1/2 LABEL SIZE (No other defect)', bTol: 'Max 2 Fingers/Hand with 1 LABEL SIZE', clfpTol: 'Max 1 Finger/CL-FP with 1/4 LABEL SIZE (No other defect)' },
    { code: 'LF', name: 'Leaf Scar', aTol: 'Max 2 Fingers/Hand with 1/2 LABEL SIZE (No other defect)', bTol: 'Max 2 Fingers/Hand with 1 LABEL SIZE', clfpTol: 'Max 1 Finger/CL-FP with 1/4 LABEL SIZE (No other defect)' },
    { code: 'MS', name: 'Maturity Stain', aTol: 'Max 2 Fingers/Hand with 1/2 LABEL SIZE (No other defect)', bTol: 'Max 2 Fingers/Hand with 1 LABEL SIZE', clfpTol: 'Max 1 Finger/CL-FP with 1/4 LABEL SIZE (No other defect)' },
    { code: 'PS', name: 'Point Scar', aTol: 'Max 2 Fingers/Hand with 1/2 LABEL SIZE (No other defect)', bTol: 'Max 2 Fingers/Hand with 1 LABEL SIZE', clfpTol: 'Max 1 Finger/CL-FP with 1/4 LABEL SIZE (No other defect)' },
    { code: 'SRN', name: 'Scarring New', aTol: 'Max 2 Fingers/Hand with 1/2 LABEL SIZE (No other defect)', bTol: 'Max 2 Fingers/Hand with 1 LABEL SIZE', clfpTol: 'Max 1 Finger/CL-FP with 1/4 LABEL SIZE (No other defect)' },
    { code: 'SRO', name: 'Scarring Old', aTol: 'Max 2 Fingers/Hand with 1/2 LABEL SIZE (No other defect)', bTol: 'Max 2 Fingers/Hand with 1 LABEL SIZE', clfpTol: 'Max 1 Finger/CL-FP with 1/4 LABEL SIZE (No other defect)' },
    { code: 'SK', name: 'Speckling', aTol: 'Max 1/2 LABEL SIZE/Hand scattered (No other defect)', bTol: 'Max 1 LABEL SIZE/Hand scattered', clfpTol: 'Max 1/2 LABEL SIZE/CL-FP scattered (No other defect)' }
];

const REJECT_DEFECTS = [
    { code: 'BM', name: 'Beetle Mark' }, { code: 'BCR', name: 'Broken Crown' },
    { code: 'BCP', name: 'Brown Cracked Peel' }, { code: 'BR', name: 'Bruise' },
    { code: 'CB', name: 'Chemical Burn' }, { code: 'CH', name: 'Chimera' },
    { code: 'CE', name: 'Cigar End' }, { code: 'CM', name: 'Crown Mold' },
    { code: 'CRB', name: 'Crown Ride Bruise' }, { code: 'CRM', name: 'Crown Ride Mutilated' },
    { code: 'CR', name: 'Crown Rot' }, { code: 'DT', name: 'Dirt' },
    { code: 'FR', name: 'Finger Rot' }, { code: 'FL', name: 'Flowers' },
    { code: 'DS', name: 'Fruit Spot (Diamond Spot)' }, { code: 'PD', name: 'Fruit Spot (Pitting Disease)' },
    { code: 'FG', name: 'Full Grade' }, { code: 'FSC', name: 'Fungal Scald' },
    { code: 'FF', name: 'Fused Fingers' }, { code: 'GL', name: 'Gel Latex' },
    { code: 'GR', name: 'Grease' }, { code: 'ID', name: 'Injection Damage' },
    { code: 'CT', name: 'Knife Cut Fresh' }, { code: 'KT', name: 'Knife Cut Old' },
    { code: 'ML', name: 'Malformed Fingers' }, { code: 'MH', name: 'Malformed Hand' },
    { code: 'MB', name: 'Mealy Bug' }, { code: 'MF', name: 'Mutilated Finger' },
    { code: 'NI', name: 'Neck Injury' }, { code: 'NR', name: 'Neck Rot' },
    { code: 'NS', name: 'Neck Stumps' }, { code: 'NL', name: 'Nipple Like' },
    { code: 'OC', name: 'Overcal' }, { code: 'PR', name: 'Peel Rot' },
    { code: 'RE', name: 'Residue' }, { code: 'RT', name: 'Ripe and Turning' },
    { code: 'SI', name: 'Scale Insect' }, { code: 'SC', name: 'Scratches' },
    { code: 'SG', name: 'Soft Green' }, { code: 'SM', name: 'Sooty Mold' },
    { code: 'SP', name: 'Split Peel' }, { code: 'SU', name: 'Sunburn' },
    { code: 'TC', name: 'Tip Constriction' }, { code: 'TF', name: 'Too Few Fingers' },
    { code: 'TS', name: 'Too Short' }, { code: 'UC', name: 'Undercal' },
    { code: 'WP', name: 'Withered Pedicel' }, { code: 'YB', name: 'Yellow Blossom End' }
];

const Sampling = ({ onNavigate, initialFarmCode }) => {
    const queryClient = useQueryClient();
    const { data: farms = [] } = useFarmsQuery();
    const { data: samplings = [] } = useSamplingsQuery();
    const [formData, setFormData] = useState({
        farmCode: initialFarmCode || '',
        dateOfPacking: new Date().toISOString().split('T')[0],
        qualityInspector: '',
        brand: ''
    });

    // Dynamic array for individual box evaluations
    const [boxEvaluations, setBoxEvaluations] = useState([
        { id: 1, evaluationDetails: '', decision: 'A- Clean no defect', handsType: '', defectCode: '' },
        { id: 2, evaluationDetails: '', decision: 'A- Clean no defect', handsType: '', defectCode: '' },
        { id: 3, evaluationDetails: '', decision: 'A- Clean no defect', handsType: '', defectCode: '' },
        { id: 4, evaluationDetails: '', decision: 'A- Clean no defect', handsType: '', defectCode: '' },
        { id: 5, evaluationDetails: '', decision: 'A- Clean no defect', handsType: '', defectCode: '' }
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
            { id: Date.now(), evaluationDetails: '', decision: 'A- Clean no defect', handsType: '', defectCode: '' }
        ]);
    };

    const handleRemoveBox = (idToRemove) => {
        setBoxEvaluations(prev => prev.filter(box => box.id !== idToRemove));
    };

    const handleSaveSampling = async (e) => {
        e.preventDefault();

        if (!formData.farmCode) {
            toast.warning("Please select a farm first.");
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
            toast.error(`Failed to save daily sampling: ${error.message || 'Unknown error'}`);
            return;
        }

        if (data && data.length > 0) {
            queryClient.invalidateQueries({ queryKey: ['samplings'] });
            toast.success("Sampling logged successfully.");

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
                <div style={{ padding: '12px 16px', background: '#eff6ff', borderLeft: '4px solid #3b82f6', marginBottom: '1.5rem', fontSize: '0.8rem', borderRadius: '4px' }}>
                    <strong style={{ color: '#1e3a8a', display: 'block', marginBottom: '4px' }}>📘 Strict Finger Removal Limits</strong>
                    <div style={{ color: '#1e40af', display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        <span><strong>4HP:</strong> Max 5 fingers (2/3 In/Out, not adjacent)</span>
                        <span><strong>5HP:</strong> Max 3 fingers (2/1 In/Out, not adjacent)</span>
                        <span><strong>6-9HP:</strong> Max 1 finger only at the outer whorl</span>
                    </div>
                </div>

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
                                    <label className="label">Defect Image (Optional)</label>
                                    <DefectImagePicker
                                        onPicked={(dataUrl) => handleBoxChange(box.id, 'defectImageUrl', dataUrl)}
                                        current={box.defectImageUrl}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="label">Box Decision (Grading)</label>
                                    <select
                                        className="input-field"
                                        value={box.decision}
                                        onChange={(e) => {
                                            handleBoxChange(box.id, 'decision', e.target.value);
                                            handleBoxChange(box.id, 'defectCode', ''); // reset defect code
                                        }}
                                        required
                                    >
                                        <option value="A- Clean no defect">A - Clean (No defect)</option>
                                        <option value="A- with defect within tolerance">A - Defect within Class A tolerance</option>
                                        <option value="B- with defect within tolerance">B - Defect within Class B tolerance</option>
                                        <option value="C- defect without tolerance">C - Defect without tolerance (REJECT)</option>
                                    </select>
                                </div>
                                
                                {/* Specific Defect Type Dropdown + UI */}
                                {box.decision !== 'A- Clean no defect' && (
                                    <div className="form-group" style={{ gridColumn: '1 / -1', background: box.decision.startsWith('C') ? '#fef2f2' : '#fefce8', padding: '1rem', borderRadius: '8px', border: `1px solid ${box.decision.startsWith('C') ? '#fecaca' : '#fef08a'}` }}>
                                        <label className="label">Specific Defect Type</label>
                                        <select
                                            className="input-field"
                                            value={box.defectCode}
                                            onChange={(e) => {
                                                const code = e.target.value;
                                                handleBoxChange(box.id, 'defectCode', code);
                                                
                                                const selectedDefect = box.decision.startsWith('C') 
                                                    ? REJECT_DEFECTS.find(d => d.code === code)
                                                    : LABEL_DEFECTS.find(d => d.code === code);
                                                    
                                                if (selectedDefect && !box.evaluationDetails.includes(selectedDefect.name)) {
                                                    const newRemarks = box.evaluationDetails 
                                                        ? `${box.evaluationDetails} | ${selectedDefect.name}` 
                                                        : `${selectedDefect.name}`;
                                                    handleBoxChange(box.id, 'evaluationDetails', newRemarks);
                                                }
                                            }}
                                            required
                                        >
                                            <option value="" disabled>Select Defect...</option>
                                            {box.decision.startsWith('C') ? (
                                                REJECT_DEFECTS.map(d => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)
                                            ) : (
                                                LABEL_DEFECTS.map(d => <option key={d.code} value={d.code}>{d.name} ({d.code})</option>)
                                            )}
                                        </select>
                                        
                                        {/* Dynamic Tolerance Label */}
                                        {box.defectCode && !box.decision.startsWith('C') && (
                                            <div style={{ marginTop: '0.65rem', fontSize: '0.82rem', color: '#854d0e', fontWeight: 600, background: 'rgba(255,255,255,0.6)', padding: '6px 10px', borderRadius: '6px' }}>
                                                <strong>LAVC Rule:</strong> {box.decision.startsWith('A') 
                                                    ? (box.handsType === 'CL' || box.handsType === 'FP' ? LABEL_DEFECTS.find(d => d.code === box.defectCode)?.clfpTol : LABEL_DEFECTS.find(d => d.code === box.defectCode)?.aTol) 
                                                    : LABEL_DEFECTS.find(d => d.code === box.defectCode)?.bTol}
                                            </div>
                                        )}
                                        {box.defectCode && box.decision.startsWith('C') && (
                                            <div style={{ marginTop: '0.65rem', fontSize: '0.82rem', color: '#991b1b', fontWeight: 600, background: 'rgba(255,255,255,0.6)', padding: '6px 10px', borderRadius: '6px' }}>
                                                <strong>LAVC Rule:</strong> Not Acceptable (REJECT)
                                            </div>
                                        )}
                                    </div>
                                )}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>Today's Sampling Logs</h3>
                    {samplings.length > 0 && (
                        <button
                            type="button"
                            className="btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                            onClick={async () => {
                                try {
                                    const { default: ExcelJS } = await import('exceljs');
                                    const wb = new ExcelJS.Workbook();
                                    const ws = wb.addWorksheet('Sampling Results');
                                    ws.columns = [
                                        { header: 'Farm Code', key: 'farmCode', width: 14 },
                                        { header: 'Farm Name', key: 'farmName', width: 26 },
                                        { header: 'Date', key: 'date', width: 14 },
                                        { header: 'Inspector', key: 'inspector', width: 22 },
                                        { header: 'Brand', key: 'brand', width: 12 },
                                        { header: 'Total Boxes', key: 'totalBoxes', width: 12 },
                                        { header: 'Overall Decision', key: 'overallDecision', width: 18 },
                                    ];
                                    ws.getRow(1).eachCell(cell => {
                                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } };
                                    });
                                    samplings.forEach(s => ws.addRow({
                                        farmCode: s.farmCode, farmName: s.farmName, date: s.date || s.dateOfPacking,
                                        inspector: s.inspector, brand: s.brand, totalBoxes: s.totalBoxes,
                                        overallDecision: s.overallDecision || s.decision
                                    }));
                                    await exportXlsx(wb, `SamplingResults_${new Date().toISOString().split('T')[0]}.xlsx`);
                                } catch (err) { toast.error('Export failed: ' + err.message); }
                            }}
                        >
                            ⬇️ Export Excel
                        </button>
                    )}
                </div>
                {samplings.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>No samplings have been recorded yet.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
                        {[...samplings].reverse().map(samp => {
                            const isReject = samp.overallDecision === 'REJECTED' || String(samp.decision).startsWith('C-');
                            const isProceed = samp.overallDecision === 'PROCEED' || samp.overallDecision === 'PASSED';
                            const boxCount = samp.boxes?.length || 0;
                            const note = samp.boxes?.[0]?.evaluationDetails || samp.evaluationDetails || '';
                            return (
                                <div key={samp.id} style={{ background: 'var(--bg-card)', border: `1px solid ${isReject ? '#fecaca' : isProceed ? '#bbf7d0' : 'var(--border-color)'}`, borderLeft: `4px solid ${isReject ? '#ef4444' : isProceed ? '#10b981' : '#f59e0b'}`, borderRadius: '10px', padding: '0.9rem 1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: note ? '0.5rem' : 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                                            <strong style={{ fontSize: '0.93rem' }}>{samp.farmCode}</strong>
                                            {samp.farmName && <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{samp.farmName}</span>}
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{samp.date || samp.dateOfPacking}</span>
                                            {samp.inspector && <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>by {samp.inspector}</span>}
                                            {boxCount > 0 && <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>{boxCount} box{boxCount > 1 ? 'es' : ''}</span>}
                                        </div>
                                        <span style={{ padding: '0.2rem 0.65rem', borderRadius: '999px', fontSize: '0.78rem', fontWeight: 700, background: isReject ? '#fee2e2' : isProceed ? '#dcfce7' : '#fef3c7', color: isReject ? '#dc2626' : isProceed ? '#16a34a' : '#92400e' }}>
                                            {samp.overallDecision || samp.decision}
                                        </span>
                                    </div>
                                    {note && <p style={{ margin: 0, fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{note}</p>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

// ----- DefectImagePicker Component -----
function DefectImagePicker({ onPicked, current }) {
    const fileRef = useRef(null);
    return (
        <div>
            <button
                type="button"
                onClick={() => pickDefectImage(fileRef, onPicked)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', border: '1px dashed var(--border-color)', borderRadius: '8px', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.85rem' }}
            >
                <span>📷</span> {current ? 'Change Photo' : 'Choose from Gallery'}
            </button>
            {!isNative && (
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = ev => onPicked(ev.target.result);
                        reader.readAsDataURL(file);
                    }}
                />
            )}
            {current && (
                <img src={current} alt="defect" style={{ marginTop: '0.5rem', width: '80px', height: '80px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--border-color)' }} />
            )}
        </div>
    );
}

export default Sampling;
