import React, { useState, useMemo } from 'react';
import '../FarmsAndGrowers.css';
import { supabase } from '../../supabaseClient';
import { ArrowLeft, Plus, Edit, Settings, FileSpreadsheet, Save, X, CheckCircle, AlertTriangle, Download, TrendingUp, TrendingDown, Minus, BarChart2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { LAvcLogo } from '../../assets/logoBase64';
import { useQueryClient } from '@tanstack/react-query';

// ============================================================
// Grower Profile Modal — Tabbed, Detail-Rich
// ============================================================
function GrowerProfileModal({ farm, weeklyRates, arrivals, samplings = [], onClose }) {
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('overview');
    const [saving, setSaving] = useState(false);
    const [expandedClass, setExpandedClass] = useState(null); // 'A' | 'B' | null

    // === DELIVERIES ===
    const farmArrivals = useMemo(() =>
        arrivals.filter(a => a.farmCode === farm.farmCode && a.approval_status === 'APPROVED'),
        [arrivals, farm]
    );

    const batches = useMemo(() => {
        const grouped = {};
        farmArrivals.forEach(a => {
            const key = a.batchId || a.id;
            if (!grouped[key]) {
                grouped[key] = {
                    ...a, totalQty: 0, grossAmount: 0,
                    classAQty: 0, classBQty: 0,
                    lockedRateA: a.locked_rate || 0, lockedRateB: 0
                };
            }
            const qty = Number(a.quantity || 0);
            const rate = Number(a.locked_rate || 0);
            const isA = a.typeId ? a.typeId.startsWith('classA') : (a.ccClass === 'A' || a.ccClass === 'Class A' || a.ccClass === 'SH');
            grouped[key].totalQty += qty;
            grouped[key].grossAmount += qty * rate;
            if (isA) { grouped[key].classAQty += qty; grouped[key].lockedRateA = rate || grouped[key].lockedRateA; }
            else { grouped[key].classBQty += qty; grouped[key].lockedRateB = rate || grouped[key].lockedRateB; }
        });
        return Object.values(grouped).sort((a, b) => new Date(b.dateOfPacking || b.dateTimeArrive || 0) - new Date(a.dateOfPacking || a.dateTimeArrive || 0));
    }, [farmArrivals]);

    const totalBoxes = batches.reduce((s, b) => s + b.totalQty, 0);
    const totalGross = batches.reduce((s, b) => s + b.grossAmount, 0);
    const totalPaid = batches.filter(b => b.payment_status === 'PAID').reduce((s, b) => s + b.grossAmount, 0);
    const totalPending = totalGross - totalPaid;
    const avgBoxes = batches.length ? Math.round(totalBoxes / batches.length) : 0;

    // === PER-HANDS breakdown (all arrivals aggregated by typeId) ===
    const HANDS_META = [
        { typeId: 'classA.rha4', label: '4H', class: 'A' },
        { typeId: 'classA.rha5', label: '5H', class: 'A' },
        { typeId: 'classA.rha6', label: '6H', class: 'A' },
        { typeId: 'classA.sha7', label: '7H', class: 'A' },
        { typeId: 'classA.sha8', label: '8H', class: 'A' },
        { typeId: 'classA.sha9', label: '9H', class: 'A' },
        { typeId: 'classA.cla',  label: 'CL', class: 'A' },
        { typeId: 'classB.rhb4', label: '4H', class: 'B' },
        { typeId: 'classB.rhb5', label: '5H', class: 'B' },
        { typeId: 'classB.rhb6', label: '6H', class: 'B' },
        { typeId: 'classB.shb7', label: '7H', class: 'B' },
        { typeId: 'classB.shb8', label: '8H', class: 'B' },
        { typeId: 'classB.shb9', label: '9H', class: 'B' },
        { typeId: 'classB.clb',  label: 'CL', class: 'B' },
        { typeId: 'classB.fp',   label: 'FP', class: 'B' },
    ];
    const handsBreakdown = useMemo(() => {
        const map = {};
        HANDS_META.forEach(h => { map[h.typeId] = { ...h, qty: 0 }; });
        farmArrivals.forEach(a => {
            if (a.typeId && map[a.typeId]) map[a.typeId].qty += Number(a.quantity || 0);
        });
        return map;
    }, [farmArrivals]);

    // === SAMPLINGS for this farm ===
    const farmSamplings = useMemo(() =>
        samplings.filter(s => s.farmCode === farm.farmCode)
            .sort((a, b) => new Date(b.date || b.encodedAt || 0) - new Date(a.date || a.encodedAt || 0)),
        [samplings, farm]
    );
    const samplingPassed = farmSamplings.filter(s => s.overallDecision === 'PROCEED').length;
    const samplingFailed = farmSamplings.filter(s => s.overallDecision === 'REJECTED').length;

    const handlePrintSampling = () => {
        if (!farmSamplings.length) return toast.warning('No sampling records to print.');
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Sampling Report - ${farm.name}</title>
                <style>
                    body { font-family: 'Inter', -apple-system, sans-serif; color: #111; padding: 20px; line-height: 1.4; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #166534; padding-bottom: 15px; margin-bottom: 20px; }
                    .brand h1 { margin: 0; font-size: 20px; color: #166534; text-transform: uppercase; }
                    .brand p { margin: 2px 0 0; font-size: 12px; color: #4b5563; }
                    .logo { height: 60px; object-fit: contain; }
                    .report-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; text-transform: uppercase; }
                    .meta-info { display: flex; gap: 20px; font-size: 13px; margin-bottom: 20px; flex-wrap: wrap; }
                    .meta-info div { background: #f3f4f6; padding: 8px 12px; border-radius: 4px; border: 1px solid #e5e7eb; min-width: 100px; }
                    .meta-info strong { display: block; font-size: 10px; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; }
                    
                    .log-card { border: 1.5px solid #d1d5db; border-radius: 8px; overflow: hidden; margin-bottom: 20px; page-break-inside: avoid; }
                    .log-header { background: #f3f4f6; padding: 10px 15px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #d1d5db; }
                    .log-meta { display: flex; gap: 20px; font-size: 12px; }
                    .log-meta div { text-align: left; }
                    .log-meta strong { display: block; font-size: 9px; color: #6b7280; text-transform: uppercase; }
                    .badge { font-weight: bold; padding: 4px 8px; border-radius: 4px; font-size: 11px; }
                    .badge.pass { background: #dcfce7; color: #166534; }
                    .badge.fail { background: #fee2e2; color: #991b1b; }
                    
                    .box-grid { padding: 10px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
                    .box-eval { padding: 8px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 11px; display: flex; gap: 10px; }
                    .box-eval.fail { background: #fef2f2; border-color: #fecaca; }
                    .box-eval.pass { background: #f0fdf4; border-color: #bbf7d0; }
                    .box-label { font-weight: bold; color: #374151; }
                    .box-decision { font-weight: bold; margin-bottom: 2px; }
                    .box-eval.pass .box-decision { color: #15803d; }
                    .box-eval.fail .box-decision { color: #991b1b; }
                    .box-details { color: #4b5563; font-size: 10px; }
                    
                    @media print {
                        body { padding: 0; }
                        @page { margin: 10mm; size: auto; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="brand">
                        <h1>LFJ AGRI-VENTURES CORPORATION</h1>
                        <p>Purok 3, San Vicente, Panabo City, Davao del Norte, Philippines 8105</p>
                        <p>Tel # (084) 823-5317 | Email: lfjagriventurescorp@gmail.com</p>
                    </div>
                    <div>
                        <img src="${LAvcLogo}" alt="LAVC Logo" class="logo" />
                    </div>
                </div>
                
                <div class="report-title">Farm Quality Sampling Report</div>
                
                <div class="meta-info">
                    <div><strong>Gower Name</strong>${farm.name}</div>
                    <div><strong>Farm Code</strong>${farm.farmCode}</div>
                    <div><strong>Location</strong>${farm.location}</div>
                    <div><strong>Total Logs</strong>${farmSamplings.length}</div>
                    <div><strong>Passed</strong>${samplingPassed}</div>
                    <div><strong>Rejected</strong>${samplingFailed}</div>
                </div>

                ${farmSamplings.map((samp) => {
                    const passed = (samp.boxes || []).filter(b => !b.decision?.startsWith('C-')).length;
                    const rejected = (samp.boxes || []).length - passed;
                    const isPassed = samp.overallDecision === 'PROCEED';
                    
                    return `
                    <div class="log-card">
                        <div class="log-header">
                            <div class="log-meta">
                                <div><strong>Date</strong>${samp.date ? new Date(samp.date).toLocaleDateString() : 'N/A'}</div>
                                <div><strong>Inspector</strong>${samp.inspector || 'N/A'}</div>
                                <div><strong>Brand</strong>${samp.brand || 'N/A'}</div>
                                <div><strong>Samples</strong>${samp.totalBoxes || (samp.boxes || []).length} boxes</div>
                                <div><strong>Result</strong>${passed} Pass / ${rejected} Reject</div>
                            </div>
                            <div class="badge ${isPassed ? 'pass' : 'fail'}">${isPassed ? 'PROCEED' : 'REJECTED'}</div>
                        </div>
                        <div class="box-grid">
                            ${(samp.boxes || []).map((box, bi) => {
                                const boxReject = box.decision?.startsWith('C-');
                                return `
                                <div class="box-eval ${boxReject ? 'fail' : 'pass'}">
                                    <div class="box-label">Box ${bi + 1}</div>
                                    <div>
                                        <div class="box-decision">${box.decision || 'N/A'}</div>
                                        ${box.handsType ? `<div class="box-details">Hands: ${box.handsType}</div>` : ''}
                                        ${box.evaluationDetails ? `<div class="box-details">${box.evaluationDetails}</div>` : ''}
                                    </div>
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                    `;
                }).join('')}
            </body>
            </html>
        `;

        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = 'none';
        
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow || iframe.contentDocument.document || iframe.contentDocument;
        
        doc.document.open();
        doc.document.write(printContent);
        doc.document.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => document.body.removeChild(iframe), 1000);
        }, 500);
    };

    // === PRICE RATES ===
    const farmRates = useMemo(() =>
        weeklyRates.filter(r => r.farm_id === farm.id)
            .sort((a, b) => b.year - a.year || b.week_number - a.week_number),
        [weeklyRates, farm]
    );

    // === BULK EDIT: spreadsheet grid from Week 8 to Week 52 (includes future weeks for advance pricing) ===
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

    const getCurrentWeekNum = () => {
        const d = new Date(); const s = new Date(d.getFullYear(), 0, 1);
        return Math.ceil((d.getDay() + 1 + Math.floor((d - s) / 86400000)) / 7);
    };

    const buildGrid = () => {
        const curWk = getCurrentWeekNum(); const curYr = new Date().getFullYear();
        const rows = [];
        const empty = FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {});

        if (farmRates.length === 0) {
            rows.push({ year: curYr, week: curWk, dirty: false, saved: false, isCurrent: true, isFuture: false, matrix: { ...empty } });
        } else {
            farmRates.forEach(rate => {
                rows.push({
                    year: rate.year,
                    week: rate.week_number,
                    dirty: false,
                    saved: true,
                    isCurrent: rate.week_number === curWk && rate.year === curYr,
                    isFuture: rate.year === curYr ? rate.week_number > curWk : rate.year > curYr,
                    matrix: { ...empty, ...rate.rates_matrix }
                });
            });
            if (!rows.some(r => r.year === curYr && r.week === curWk)) {
                rows.push({ year: curYr, week: curWk, dirty: false, saved: false, isCurrent: true, isFuture: false, matrix: { ...empty } });
            }
        }
        return rows.sort((a, b) => b.year - a.year || b.week - a.week);
    };

    const [grid, setGrid] = useState(() => buildGrid());
    const [showAllWeeks, setShowAllWeeks] = useState(false);
    const [bulkSaving, setBulkSaving] = useState(false);
    const [bulkResult, setBulkResult] = useState(null);

    const handleAddGridWeek = () => {
        const wkStr = window.prompt("Enter Week Number to add (1-52):", "");
        if (!wkStr) return;
        const wk = parseInt(wkStr, 10);
        if (isNaN(wk) || wk < 1 || wk > 52) return toast.warning("Invalid week number.");
        
        const yrStr = window.prompt("Enter Year (e.g. 2026):", new Date().getFullYear());
        if (!yrStr) return;
        const yr = parseInt(yrStr, 10);

        setGrid(prev => {
            if (prev.some(r => r.year === yr && r.week === wk)) {
                toast.warning("Week already exists in the grid!");
                return prev;
            }
            const curWk = getCurrentWeekNum();
            const curYr = new Date().getFullYear();
            const empty = FIELDS.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {});
            const newRow = {
                year: yr, week: wk, dirty: true, saved: false,
                isCurrent: wk === curWk && yr === curYr,
                isFuture: yr === curYr ? wk > curWk : yr > curYr,
                matrix: { ...empty }
            };
            return [newRow, ...prev].sort((a, b) => b.year - a.year || b.week - a.week);
        });
    };

    const updateCell = (weekIdx, fieldKey, value) => {
        setGrid(prev => prev.map((row, i) => i === weekIdx
            ? { ...row, dirty: true, matrix: { ...row.matrix, [fieldKey]: value } }
            : row
        ));
    };

    const handleBulkSave = async () => {
        const dirtyRows = grid.filter(r => r.dirty);
        if (!dirtyRows.length) { setBulkResult({ type: 'info', msg: 'No changes to save.' }); return; }
        setBulkSaving(true);
        try {
            const payloads = dirtyRows.map(r => ({
                farm_id: farm.id, year: r.year, week_number: r.week,
                rates_matrix: Object.fromEntries(Object.entries(r.matrix).map(([k, v]) => [k, v === '' ? 0 : Number(v)]))
            }));
            const { data, error } = await supabase.from('weekly_rates')
                .upsert(payloads, { onConflict: 'farm_id,year,week_number' }).select();
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['weekly_rates'] });
            setGrid(prev => prev.map(r => r.dirty ? { ...r, dirty: false, saved: true } : r));
            setBulkResult({ type: 'success', msg: `✅ Saved ${dirtyRows.length} week${dirtyRows.length > 1 ? 's' : ''} successfully.` });
        } catch (err) {
            setBulkResult({ type: 'error', msg: '❌ Save failed: ' + err.message });
        } finally { setBulkSaving(false); }
    };

    const dirtyCount = grid.filter(r => r.dirty).length;

    const tabs = [
        { id: 'overview',   label: '📊 Overview' },
        { id: 'prices',     label: '💲 Price History' },
        { id: 'bulk',       label: `✏️ Bulk Edit${dirtyCount ? ` (${dirtyCount}✱)` : ''}` },
        { id: 'deliveries', label: `📦 Deliveries (${batches.length})` },
        { id: 'sampling',   label: `🔬 Sampling (${farmSamplings.length})` },
    ];

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            <div style={{ background: 'white', borderRadius: '16px', width: '97%', maxWidth: '1000px', maxHeight: '93vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.4)' }}>

                {/* Header */}
                <div style={{ padding: '1.25rem 1.75rem', background: 'linear-gradient(135deg, #052e16, #064e3b)', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
                    <div>
                        <div style={{ fontSize: '0.72rem', opacity: 0.65, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                            {farm.farmCode} · {farm.company} · {farm.farmType} · {farm.elevation}
                        </div>
                        <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, letterSpacing: '-0.02em' }}>{farm.name}</h2>
                        <div style={{ fontSize: '0.82rem', opacity: 0.75, marginTop: '0.2rem' }}>
                            📍 {farm.location} · 🌿 {farm.activeHas} ha active · 🏦 {farm.bankName || 'No bank'} {farm.accountNumber ? `· ${farm.accountNumber}` : ''}
                        </div>
                    </div>
                    <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '8px', padding: '0.4rem 0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.82rem' }}>
                        <X size={16} /> Close
                    </button>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', background: '#f8fafc', flexShrink: 0, overflowX: 'auto' }}>
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
                            padding: '0.75rem 1.25rem', border: 'none', background: 'none', cursor: 'pointer',
                            fontWeight: activeTab === t.id ? 700 : 500, fontSize: '0.85rem',
                            color: activeTab === t.id ? '#065f46' : '#64748b',
                            borderBottom: activeTab === t.id ? '2px solid #065f46' : '2px solid transparent',
                            marginBottom: '-2px', whiteSpace: 'nowrap', transition: 'all 0.15s'
                        }}>{t.label}</button>
                    ))}
                </div>

                {/* Content */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '1.5rem 1.75rem' }}>

                    {/* ── OVERVIEW ── */}
                    {activeTab === 'overview' && (
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.85rem', marginBottom: '1.75rem' }}>
                                {[
                                    { label: 'Total Deliveries', value: batches.length, color: '#3b82f6', sub: `Avg ${avgBoxes} boxes/del.` },
                                    { label: 'Total Boxes', value: totalBoxes.toLocaleString(), color: '#10b981', sub: `${batches.filter(b => b.classAQty > 0).length} with Class A` },
                                    { label: 'Gross Revenue', value: `₱${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: '#f59e0b', sub: totalGross > 0 ? `₱${(totalGross / (totalBoxes || 1)).toFixed(2)} avg/box` : 'Rates may be missing' },
                                    { label: 'Collected', value: `₱${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, color: '#22c55e', sub: `₱${totalPending.toLocaleString(undefined, { minimumFractionDigits: 2 })} pending` },
                                    { label: 'Weeks on Record', value: farmRates.length, color: '#8b5cf6', sub: farmRates.length ? `Latest: Wk ${farmRates[0].week_number}` : 'None yet' },
                                    { label: 'Active Area', value: `${farm.activeHas} ha`, color: '#0ea5e9', sub: `Total: ${farm.prodHas} ha` },
                                ].map(s => (
                                    <div key={s.label} style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem', border: `1.5px solid ${s.color}22` }}>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>{s.label}</div>
                                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: s.color, marginBottom: '0.2rem' }}>{s.value}</div>
                                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{s.sub}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Class breakdown — clickable to expand per-hands */}
                            {batches.length > 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                    {[
                                        { cls: 'A', label: 'Class A Boxes', qty: batches.reduce((s, b) => s + b.classAQty, 0), color: '#10b981', pct: totalBoxes ? Math.round(batches.reduce((s, b) => s + b.classAQty, 0) / totalBoxes * 100) : 0 },
                                        { cls: 'B', label: 'Class B Boxes', qty: batches.reduce((s, b) => s + b.classBQty, 0), color: '#f59e0b', pct: totalBoxes ? Math.round(batches.reduce((s, b) => s + b.classBQty, 0) / totalBoxes * 100) : 0 },
                                    ].map(c => (
                                        <div key={c.label}>
                                            <div
                                                onClick={() => setExpandedClass(prev => prev === c.cls ? null : c.cls)}
                                                style={{ background: expandedClass === c.cls ? `${c.color}18` : '#f8fafc', borderRadius: '12px', padding: '1rem 1.25rem', border: `1.5px solid ${expandedClass === c.cls ? c.color : c.color + '33'}`, cursor: 'pointer', transition: 'all 0.2s', userSelect: 'none' }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: c.color }}>{c.label}</div>
                                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>{expandedClass === c.cls ? '▲ Hide' : '▼ Per Hands'}</div>
                                                </div>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>{c.qty.toLocaleString()}</div>
                                                <div style={{ marginTop: '0.5rem', background: '#e2e8f0', borderRadius: '99px', height: '5px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${c.pct}%`, background: c.color, height: '100%', borderRadius: '99px' }} />
                                                </div>
                                                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>{c.pct}% of total · click to expand</div>
                                            </div>
                                            {/* Per-hands breakdown */}
                                            {expandedClass === c.cls && (
                                                <div style={{ marginTop: '0.5rem', background: 'white', border: `1.5px solid ${c.color}44`, borderRadius: '10px', padding: '0.75rem 1rem' }}>
                                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '0.6rem', letterSpacing: '0.05em' }}>Breakdown by Hands Size</div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.4rem' }}>
                                                        {HANDS_META.filter(h => h.class === c.cls).map(h => {
                                                            const data = handsBreakdown[h.typeId];
                                                            const pct = c.qty > 0 ? Math.round((data?.qty || 0) / c.qty * 100) : 0;
                                                            return (
                                                                <div key={h.typeId} style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.5rem 0.6rem', border: `1px solid ${(data?.qty || 0) > 0 ? c.color + '55' : '#e2e8f0'}` }}>
                                                                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: c.color, marginBottom: '0.15rem' }}>{h.label}</div>
                                                                    <div style={{ fontSize: '1rem', fontWeight: 800, color: (data?.qty || 0) > 0 ? '#0f172a' : '#cbd5e1' }}>{(data?.qty || 0).toLocaleString()}</div>
                                                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{pct}%</div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Farm details */}
                            <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem 1.25rem', border: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', marginBottom: '0.75rem', textTransform: 'uppercase' }}>Farm Details</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem 1.5rem' }}>
                                    {[
                                        ['Point of Delivery', farm.pointOfDelivery],
                                        ['Farm Type', farm.farmType],
                                        ['Elevation', farm.elevation],
                                        ['PH Name', farm.physicalPhName],
                                        ['PH Address', farm.physicalPhAddress],
                                        ['Bank', farm.bankName],
                                        ['Account Name', farm.accountName],
                                        ['Account #', farm.accountNumber],
                                        ['Status', farm.status],
                                    ].map(([label, val]) => val ? (
                                        <div key={label}>
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>{label}</div>
                                            <div style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 600 }}>{val}</div>
                                        </div>
                                    ) : null)}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── PRICE HISTORY ── */}
                    {activeTab === 'prices' && (
                        <div>
                            {farmRates.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                                    No rates recorded yet. Use <strong>Bulk Edit</strong> to add past pricing history.
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="banana-table" style={{ fontSize: '0.81rem' }}>
                                        <thead>
                                            <tr>
                                                <th>Year</th><th>Week</th><th>Trend</th>
                                                <th className="text-right">A-4H</th><th className="text-right">A-5H</th><th className="text-right">A-6H</th>
                                                <th className="text-right">A-7H</th><th className="text-right">A-8H</th><th className="text-right">A-9H</th>
                                                <th className="text-right">B-4H</th><th className="text-right">B-5H</th><th className="text-right">B-6H</th>
                                                <th className="text-right">B-7H</th><th className="text-right">B-8H</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {farmRates.map((rate, idx) => {
                                                const prev = farmRates[idx + 1];
                                                const cur = Number(rate.rates_matrix?.['classA.rha4'] || 0);
                                                const pv = prev ? Number(prev.rates_matrix?.['classA.rha4'] || 0) : null;
                                                const diff = pv !== null ? cur - pv : null;
                                                const trend = diff === null ? '—' : diff > 0 ? `↑ +${diff.toFixed(2)}` : diff < 0 ? `↓ ${diff.toFixed(2)}` : '→ 0.00';
                                                const tc = diff === null ? '#94a3b8' : diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#94a3b8';
                                                const isCur = rate.week_number === getCurrentWeekNum() && rate.year === new Date().getFullYear();
                                                return (
                                                    <tr key={rate.id} style={{ background: isCur ? '#f0fdf4' : undefined }}>
                                                        <td style={{ fontWeight: 600 }}>{rate.year}</td>
                                                        <td><span className="badge-neutral" style={{ background: isCur ? '#dcfce7' : undefined, color: isCur ? '#166534' : undefined }}>Wk {rate.week_number}{isCur ? ' ●' : ''}</span></td>
                                                        <td style={{ color: tc, fontWeight: 700, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{trend}</td>
                                                        {['classA.rha4','classA.rha5','classA.rha6','classA.sha7','classA.sha8','classA.sha9','classB.rhb4','classB.rhb5','classB.rhb6','classB.shb7','classB.shb8'].map(k => (
                                                            <td key={k} className="text-right" style={{ color: Number(rate.rates_matrix?.[k]) > 0 ? '#0f172a' : '#cbd5e1' }}>
                                                                {Number(rate.rates_matrix?.[k] || 0) > 0 ? `₱${Number(rate.rates_matrix[k]).toFixed(2)}` : '—'}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── BULK EDIT ── */}
                    {activeTab === 'bulk' && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                <div>
                                    <h4 style={{ margin: 0, color: '#0f172a' }}>Bulk Price Entry — {farm.name}</h4>
                                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>Enter rates for all weeks since Week 8. Cells with existing data are pre-filled. Rows with an asterisk (✱) have unsaved changes.</p>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    {bulkResult && (
                                        <span style={{ fontSize: '0.82rem', color: bulkResult.type === 'success' ? '#166534' : bulkResult.type === 'error' ? '#dc2626' : '#64748b', fontWeight: 600 }}>
                                            {bulkResult.msg}
                                        </span>
                                    )}
                                    <button
                                        className="btn-secondary"
                                        onClick={() => setShowAllWeeks(!showAllWeeks)}
                                        style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                                    >
                                        {showAllWeeks ? '👓 Hide Past Weeks' : '📜 Show Past Weeks'}
                                    </button>
                                    <button
                                        className="btn-secondary"
                                        onClick={handleAddGridWeek}
                                        style={{ padding: '0.55rem 1rem', fontSize: '0.85rem' }}
                                    >
                                        ➕ Add Week
                                    </button>
                                    <button
                                        className="btn-primary"
                                        onClick={handleBulkSave}
                                        disabled={bulkSaving || dirtyCount === 0}
                                        style={{ padding: '0.55rem 1.25rem', fontSize: '0.85rem', opacity: dirtyCount === 0 ? 0.5 : 1 }}
                                    >
                                        {bulkSaving ? '⏳ Saving…' : `💾 Save ${dirtyCount > 0 ? `(${dirtyCount})` : ''} Changes`}
                                    </button>
                                </div>
                            </div>

                            <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f1f5f9' }}>
                                            <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: 700, color: '#475569', whiteSpace: 'nowrap', borderBottom: '2px solid #e2e8f0', position: 'sticky', left: 0, background: '#f1f5f9', zIndex: 1 }}>Week</th>
                                            {FIELDS.map(f => (
                                                <th key={f.key} style={{ padding: '0.5rem 0.4rem', textAlign: 'center', fontWeight: 700, color: f.key.startsWith('classA') ? '#166534' : '#92400e', borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap', minWidth: '72px' }}>{f.label}</th>
                                            ))}
                                            <th style={{ padding: '0.5rem 0.5rem', borderBottom: '2px solid #e2e8f0' }}></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {grid.map((row, rowIdx) => {
                                            const curWk = getCurrentWeekNum();
                                            const curYr = new Date().getFullYear();
                                            const isNextWeek = (row.year === curYr && row.week === curWk + 1) || 
                                                               (row.year === curYr + 1 && row.week === 1 && curWk === 52);

                                            if (!showAllWeeks && !row.isCurrent && !isNextWeek && !row.dirty) return null;
                                            return (
                                                <tr key={`${row.year}-${row.week}`} style={{ background: row.dirty ? '#fffbeb' : row.isFuture ? '#eff6ff' : row.saved ? '#f0fdf4' : 'white', borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '0.35rem 0.75rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: row.dirty ? '#fffbeb' : row.isFuture ? '#eff6ff' : row.saved ? '#f0fdf4' : 'white', zIndex: 1, borderRight: '1px solid #e2e8f0' }}>
                                                        {row.dirty ? '✱ ' : ''}<span style={{ color: row.isFuture ? '#1d4ed8' : row.isCurrent ? '#b45309' : '#065f46' }}>Wk {row.week}</span>
                                                        <span style={{ fontSize: '0.68rem', display: 'block' }}>
                                                            {row.isCurrent ? <span style={{ color: '#b45309', fontWeight: 700 }}>● Current</span> : row.isFuture ? <span style={{ color: '#1d4ed8', fontWeight: 700 }}>↑ Future</span> : <span style={{ color: '#94a3b8' }}>{row.year}</span>}
                                                        </span>
                                                    </td>
                                                    {FIELDS.map(f => (
                                                        <td key={f.key} style={{ padding: '0.2rem 0.25rem' }}>
                                                            <input
                                                                type="number"
                                                                step="0.01"
                                                                placeholder="—"
                                                                value={row.matrix[f.key]}
                                                                onChange={e => updateCell(rowIdx, f.key, e.target.value)}
                                                                style={{
                                                                    width: '68px', padding: '0.3rem 0.35rem', border: `1px solid ${row.dirty ? '#fcd34d' : '#e2e8f0'}`,
                                                                    borderRadius: '5px', fontSize: '0.78rem', textAlign: 'right',
                                                                    background: row.matrix[f.key] !== '' && row.matrix[f.key] !== '0' ? (f.key.startsWith('classA') ? '#f0fdf4' : '#fffbeb') : 'white'
                                                                }}
                                                            />
                                                        </td>
                                                    ))}
                                                    <td style={{ padding: '0.2rem 0.4rem' }}>
                                                        {row.saved && !row.dirty && (
                                                            <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>✓</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: '#94a3b8', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                <span><span style={{ background: '#f0fdf4', padding: '1px 6px', borderRadius: '4px', color: '#166534', fontWeight: 600 }}>Green row</span> = already saved</span>
                                <span><span style={{ background: '#fffbeb', padding: '1px 6px', borderRadius: '4px', color: '#92400e', fontWeight: 600 }}>Yellow row</span> = unsaved changes (✱)</span>
                                <span>Green cell = Class A price · Orange cell = Class B price</span>
                            </div>
                        </div>
                    )}

                    {/* ── DELIVERIES ── */}
                    {activeTab === 'deliveries' && (
                        <div>
                            {batches.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>No approved deliveries yet.</div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table className="banana-table" style={{ fontSize: '0.81rem' }}>
                                        <thead>
                                            <tr>
                                                <th>Packing Date</th>
                                                <th>Week #</th>
                                                <th>DR #</th>
                                                <th>Plate</th>
                                                <th className="text-right">Class A</th>
                                                <th className="text-right">Class B</th>
                                                <th className="text-right">Total Boxes</th>
                                                <th className="text-right">Rate A</th>
                                                <th className="text-right">Rate B</th>
                                                <th className="text-right">Gross Amount</th>
                                                <th className="text-center">Payment</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {batches.map(b => {
                                                const packDate = b.dateOfPacking || b.dateTimeArrive;
                                                const wkNum = (() => {
                                                    if (!packDate) return '—';
                                                    const d = new Date(packDate); const s = new Date(d.getFullYear(), 0, 1);
                                                    return Math.ceil((d.getDay() + 1 + Math.floor((d - s) / 86400000)) / 7);
                                                })();
                                                return (
                                                    <tr key={b.batchId || b.id}>
                                                        <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{packDate ? new Date(packDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
                                                        <td><span className="badge-neutral">Wk {wkNum}</span></td>
                                                        <td style={{ color: '#3b82f6', fontWeight: 600 }}>{b.deliveryReceipt || '—'}</td>
                                                        <td style={{ color: '#64748b' }}>{b.plateNumber || '—'}</td>
                                                        <td className="text-right" style={{ color: '#16a34a', fontWeight: 700 }}>{b.classAQty > 0 ? b.classAQty.toLocaleString() : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                                                        <td className="text-right" style={{ color: '#d97706', fontWeight: 700 }}>{b.classBQty > 0 ? b.classBQty.toLocaleString() : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                                                        <td className="text-right" style={{ fontWeight: 800 }}>{b.totalQty.toLocaleString()}</td>
                                                        <td className="text-right" style={{ color: '#16a34a' }}>{b.lockedRateA > 0 ? `₱${Number(b.lockedRateA).toFixed(2)}` : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                                                        <td className="text-right" style={{ color: '#d97706' }}>{b.lockedRateB > 0 ? `₱${Number(b.lockedRateB).toFixed(2)}` : <span style={{ color: '#cbd5e1' }}>—</span>}</td>
                                                        <td className="text-right" style={{ fontWeight: 800, color: b.grossAmount > 0 ? '#0f4c26' : '#94a3b8' }}>
                                                            {b.grossAmount > 0 ? `₱${b.grossAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                                                        </td>
                                                        <td className="text-center">
                                                            <span style={{
                                                                padding: '0.2rem 0.55rem', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 700,
                                                                background: b.payment_status === 'PAID' ? '#dcfce7' : '#fef3c7',
                                                                color: b.payment_status === 'PAID' ? '#166534' : '#92400e'
                                                            }}>{b.payment_status || 'PENDING'}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ background: '#f1f5f9', fontWeight: 800 }}>
                                                <td colSpan="4" style={{ padding: '0.6rem 1rem', color: '#64748b', fontSize: '0.8rem' }}>TOTALS</td>
                                                <td className="text-right" style={{ color: '#16a34a' }}>{batches.reduce((s, b) => s + b.classAQty, 0).toLocaleString()}</td>
                                                <td className="text-right" style={{ color: '#d97706' }}>{batches.reduce((s, b) => s + b.classBQty, 0).toLocaleString()}</td>
                                                <td className="text-right">{totalBoxes.toLocaleString()}</td>
                                                <td colSpan="2"></td>
                                                <td className="text-right" style={{ color: '#0f4c26' }}>₱{totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                <td></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── SAMPLING ── */}
                    {activeTab === 'sampling' && (
                        <div>
                            {/* Summary stats with Print button */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.85rem', flex: 1 }}>
                                    {[
                                        { label: 'Total QC Logs', value: farmSamplings.length, color: '#3b82f6' },
                                        { label: 'Passed (PROCEED)', value: samplingPassed, color: '#10b981' },
                                        { label: 'Rejected', value: samplingFailed, color: '#ef4444' },
                                        { label: 'Pass Rate', value: farmSamplings.length ? `${Math.round(samplingPassed / farmSamplings.length * 100)}%` : '—', color: '#8b5cf6' },
                                    ].map(s => (
                                        <div key={s.label} style={{ background: '#f8fafc', borderRadius: '12px', padding: '1rem', border: `1.5px solid ${s.color}22` }}>
                                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>{s.label}</div>
                                            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                    <button 
                                        className="btn-secondary" 
                                        onClick={handlePrintSampling}
                                        disabled={farmSamplings.length === 0}
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem' }}
                                    >
                                        <Printer size={18} /> Print Sampling Report
                                    </button>
                                </div>
                            </div>

                            {farmSamplings.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>No quality sampling logs recorded for this farm.</div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {farmSamplings.map((samp, si) => {
                                        const passed = (samp.boxes || []).filter(b => !b.decision?.startsWith('C-')).length;
                                        const rejected = (samp.boxes || []).length - passed;
                                        const isPassed = samp.overallDecision === 'PROCEED';
                                        return (
                                            <div key={samp.id || si} style={{ border: `1.5px solid ${isPassed ? '#bbf7d0' : '#fecaca'}`, borderRadius: '12px', overflow: 'hidden' }}>
                                                {/* Log header */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: isPassed ? '#f0fdf4' : '#fef2f2', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                                        <div>
                                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>DATE</div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{samp.date ? new Date(samp.date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>INSPECTOR</div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{samp.inspector || '—'}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>BRAND</div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{samp.brand || '—'}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>BOXES SAMPLED</div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{samp.totalBoxes || (samp.boxes || []).length}</div>
                                                        </div>
                                                        <div>
                                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>BOX RESULTS</div>
                                                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                                                                <span style={{ color: '#16a34a' }}>{passed} pass</span>
                                                                {rejected > 0 && <span style={{ color: '#dc2626' }}> · {rejected} reject</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span style={{ padding: '0.3rem 0.9rem', borderRadius: '99px', fontSize: '0.78rem', fontWeight: 800, background: isPassed ? '#dcfce7' : '#fee2e2', color: isPassed ? '#166534' : '#991b1b' }}>
                                                        {isPassed ? '✓ PROCEED' : '✗ REJECTED'}
                                                    </span>
                                                </div>
                                                {/* Per-box decisions */}
                                                {(samp.boxes || []).length > 0 && (
                                                    <div style={{ padding: '0.75rem 1rem', background: 'white' }}>
                                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Box Evaluations</div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.4rem' }}>
                                                            {(samp.boxes || []).map((box, bi) => {
                                                                const isReject = box.decision?.startsWith('C-');
                                                                return (
                                                                    <div key={bi} style={{ display: 'flex', gap: '0.5rem', padding: '0.4rem 0.6rem', borderRadius: '7px', background: isReject ? '#fef2f2' : '#f0fdf4', border: `1px solid ${isReject ? '#fecaca' : '#bbf7d0'}`, alignItems: 'flex-start' }}>
                                                                        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: isReject ? '#dc2626' : '#16a34a', whiteSpace: 'nowrap', minWidth: '40px' }}>Box {bi + 1}</span>
                                                                        <div style={{ flex: 1 }}>
                                                                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isReject ? '#991b1b' : '#15803d' }}>{box.decision || '—'}</div>
                                                                            {box.handsType && <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Hands: {box.handsType}</div>}
                                                                            {box.evaluationDetails && <div style={{ fontSize: '0.68rem', color: '#64748b', marginTop: '2px', lineHeight: 1.3 }}>{box.evaluationDetails}</div>}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default GrowerProfileModal;
