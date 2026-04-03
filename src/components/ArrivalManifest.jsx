import React from 'react';

const ArrivalManifest = React.forwardRef(({ arrival, samplings = [], allArrivals = [], style }, ref) => {
    if (!arrival) return null;

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr === 'N/A' || dateStr === '-') return 'Pending';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;
            return date.toLocaleString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (e) {
            return dateStr;
        }
    };

    const isApproved = arrival.approval_status === 'APPROVED';
    const statusLabel = isApproved ? 'APPROVED' : 'PENDING';

    const matchedSampling = samplings.find(
        s => s.farmCode === arrival.farmCode && (s.date === arrival.dateOfPacking || s.dateOfPacking === arrival.dateOfPacking)
    );

    const formatClassType = (typeId, ccClass) => {
        if (!typeId) return ccClass || 'N/A';
        const parts = typeId.split('.');
        if (parts.length !== 2) return typeId.replace('.', ' ');

        const [cls, type] = parts;
        const classStr = cls.replace('class', 'Class ');

        const typeMap = {
            rha4: 'RHA 4H', rha5: 'RHA 5H', rha6: 'RHA 6H',
            sha7: 'SHA 7H', sha8: 'SHA 8H', sha9: 'SHA 9H', shaCLA: 'Cluster',
            rhb4: 'RHB 4H', rhb5: 'RHB 5H', rhb6: 'RHB 6H',
            shb7: 'SHB 7H', shb8: 'SHB 8H', shb9: 'SHB 9H', shbCLB: 'Cluster', shbFP: 'Finger Pack'
        };

        const niceType = typeMap[type] || type.toUpperCase();
        return `${classStr} - ${niceType}`;
    };

    return (
        <div ref={ref} style={{ padding: '50px', fontFamily: '"Inter", "Segoe UI", Arial, sans-serif', color: '#1e293b', backgroundColor: '#fff', ...style }}>
            <div style={{ borderBottom: '3px solid #166534', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ margin: '0 0 5px 0', fontSize: '32px', color: '#0f172a', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '-0.5px' }}>
                        Arrival Manifest
                    </h1>
                    <div style={{ display: 'inline-block', backgroundColor: '#166534', color: 'white', padding: '4px 12px', borderRadius: '4px', fontSize: '14px', fontWeight: '700' }}>
                        DR: {arrival.deliveryReceipt || 'N/A'} • {statusLabel}
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#1e293b', fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>LFJ AGRI-VENTURES CORPORATION</div>
                    <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '1px' }}>Purok 3, San Vicente, Panabo City, Davao del Norte, Philippines 8105</div>
                    <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '8px' }}>Tel # (084) 823-5317 | Email: lfjagriventurescorp@gmail.com</div>
                    <div style={{ fontSize: '14px' }}><strong>Date Printed:</strong> {new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
                <div style={{ border: '1px solid #e2e8f0', overflow: 'hidden', borderRadius: '8px' }}>
                    <h3 style={{ margin: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 15px', fontSize: '16px', color: '#0f172a' }}>Source Details</h3>
                    <div style={{ padding: '15px' }}>
                        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Farm Name:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{arrival.farmName || 'N/A'}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Farm Code:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{arrival.farmCode || 'N/A'}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Driver Name:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{arrival.driverName || 'N/A'}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Plate Number:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{arrival.plateNumber || 'N/A'}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div style={{ border: '1px solid #e2e8f0', overflow: 'hidden', borderRadius: '8px' }}>
                    <h3 style={{ margin: 0, backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 15px', fontSize: '16px', color: '#0f172a' }}>Timings & Status</h3>
                    <div style={{ padding: '15px' }}>
                        <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
                            <tbody>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Delivery Date:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{formatDate(arrival.dateOfPacking)}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Arrival Hub:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{formatDate(arrival.dateTimeArrive)}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Encoded At:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{formatDate(arrival.dateTimeEncoded)}</td></tr>
                                <tr><td style={{ padding: '6px 0', color: '#64748b' }}>Approval Status:</td><td style={{ fontWeight: '700', padding: '6px 0' }}>{arrival.approval_status || 'PENDING'}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {(() => {
                // Group the related arrivals to show a breakdown
                const relatedArrivals = allArrivals.filter(a => a.batchId === arrival.batchId);
                const isGrouped = relatedArrivals.length > 0;

                if (!isGrouped) {
                    return (
                        <>
                            <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Payload Summary</h3>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '14px', marginBottom: '20px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8fafc' }}>
                                        <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Batch ID / Reference</th>
                                        <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Description</th>
                                        <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Total Boxes Received</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td style={{ padding: '10px 15px', borderBottom: 'none' }}>{arrival.batchId || arrival.id || 'N/A'}</td>
                                        <td style={{ padding: '10px 15px', borderBottom: 'none', color: '#64748b' }}>Harvested Bananas from Farm</td>
                                        <td style={{ padding: '10px 15px', textAlign: 'right', fontWeight: '700', borderBottom: 'none' }}>{arrival.totalQuantity?.toLocaleString() || arrival.quantity?.toLocaleString() || 0}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </>
                    );
                }

                const classAItems = relatedArrivals.filter(a => a.typeId ? a.typeId.startsWith('classA') : (a.ccClass === 'A' || a.ccClass === 'Class A' || a.ccClass === 'SH' || a.ccClass === 'A (Cluster)'));
                const classBItems = relatedArrivals.filter(a => a.typeId ? a.typeId.startsWith('classB') : (a.ccClass === 'B' || a.ccClass === 'Class B' || a.ccClass === 'B (Cluster)' || a.ccClass === 'B (Finger Pack)'));

                // Sort them nicely
                classAItems.sort((a, b) => (a.typeId || a.ccClass || '').localeCompare(b.typeId || b.ccClass || ''));
                classBItems.sort((a, b) => (a.typeId || a.ccClass || '').localeCompare(b.typeId || b.ccClass || ''));

                const renderTable = (items, title) => {
                    if (items.length === 0) return null;
                    const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
                    return (
                        <div style={{ marginBottom: '30px' }}>
                            <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#1e293b' }}>{title}</h4>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#166534', backgroundColor: '#f0fdf4', padding: '4px 10px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                    Subtotal: {subtotal.toLocaleString()} Boxes
                                </span>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '14px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8fafc' }}>
                                        <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Class & Type</th>
                                        <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Description</th>
                                        <th style={{ padding: '12px 15px', textAlign: 'right', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Count Received</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((arr, idx) => (
                                        <tr key={arr.id || idx}>
                                            <td style={{ padding: '10px 15px', borderBottom: idx === items.length - 1 ? 'none' : '1px solid #f1f5f9', fontWeight: '700', color: '#1e293b' }}>
                                                {formatClassType(arr.typeId, arr.ccClass)}
                                            </td>
                                            <td style={{ padding: '10px 15px', borderBottom: idx === items.length - 1 ? 'none' : '1px solid #f1f5f9', color: '#64748b' }}>
                                                Harvested Bananas
                                            </td>
                                            <td style={{ padding: '10px 15px', textAlign: 'right', fontWeight: '700', borderBottom: idx === items.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                                {arr.quantity?.toLocaleString() || 0}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                };

                return (
                    <>
                        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>Payload Summary Breakdown</h3>
                        </div>
                        {renderTable(classAItems, 'Class A Breakdown')}
                        {renderTable(classBItems, 'Class B Breakdown')}
                    </>
                );
            })()}

            {matchedSampling && matchedSampling.boxes && matchedSampling.boxes.length > 0 && (
                <>
                    <div style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '30px' }}>
                        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>Quality Evaluation (Sampled Batch Remarks)</h3>
                        <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Overall Decision: <strong style={{ color: matchedSampling.overallDecision === 'REJECTED' ? '#dc2626' : '#166534' }}>{matchedSampling.overallDecision || matchedSampling.decision}</strong></span>
                    </div>
                    {matchedSampling.comments && (
                        <div style={{ marginBottom: '15px', padding: '12px 15px', backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', color: '#92400e', fontSize: '14px' }}>
                            <strong>Inspector Comments:</strong> {matchedSampling.comments}
                        </div>
                    )}
                    <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '14px', marginBottom: '20px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8fafc' }}>
                                <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Box #</th>
                                <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Hands Type</th>
                                <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Defects / Remarks</th>
                                <th style={{ padding: '12px 15px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: '700' }}>Grading Decision</th>
                            </tr>
                        </thead>
                        <tbody>
                            {matchedSampling.boxes.map((box, idx) => (
                                <tr key={box.id || idx}>
                                    <td style={{ padding: '10px 15px', borderBottom: idx === matchedSampling.boxes.length - 1 ? 'none' : '1px solid #f1f5f9' }}>{idx + 1}</td>
                                    <td style={{ padding: '10px 15px', borderBottom: idx === matchedSampling.boxes.length - 1 ? 'none' : '1px solid #f1f5f9', fontWeight: '600' }}>{box.handsType || 'N/A'}</td>
                                    <td style={{ padding: '10px 15px', borderBottom: idx === matchedSampling.boxes.length - 1 ? 'none' : '1px solid #f1f5f9', color: '#64748b' }}>{box.evaluationDetails || 'Clean'}</td>
                                    <td style={{ padding: '10px 15px', borderBottom: idx === matchedSampling.boxes.length - 1 ? 'none' : '1px solid #f1f5f9' }}>
                                        <span style={{ color: box.decision.startsWith('C') ? '#dc2626' : (box.decision.startsWith('B') ? '#d97706' : '#166534'), fontWeight: '600' }}>
                                            {box.decision}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {matchedSampling.media && matchedSampling.media.length > 0 && (
                        <div style={{ marginTop: '20px' }}>
                            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#475569' }}>Attached Inspection Media:</h4>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {matchedSampling.media.map((imgUrl, i) => (
                                    <img key={i} src={imgUrl} alt={`Sample ${i + 1}`} style={{ height: '120px', borderRadius: '8px', border: '1px solid #e2e8f0', objectFit: 'cover' }} />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px' }}>
                <div style={{ textAlign: 'right', minWidth: '240px', padding: '20px', backgroundColor: '#f0fdf4', border: '2px solid #166534', borderRadius: '12px' }}>
                    <div style={{ color: '#166534', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', marginBottom: '4px' }}>Total Quantity Confirmed</div>
                    <div style={{ color: '#14532d', fontSize: '24px', fontWeight: '800' }}>
                        {arrival.totalQuantity?.toLocaleString() || arrival.quantity?.toLocaleString() || 0} <span style={{ fontSize: '16px', color: '#166534', fontWeight: '600' }}>Boxes</span>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '100px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '100px' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '2px solid #0f172a', paddingTop: '10px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700' }}>Receiver / Quality Inspector</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>Operations Personnel</div>
                    </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ borderTop: '2px solid #0f172a', paddingTop: '10px' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700' }}>Driver Signature</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>Delivery Personnel</div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '40px', textAlign: 'center', color: '#94a3b8', fontSize: '10px', borderTop: '1px dashed #e2e8f0', paddingTop: '10px' }}>
                Generated by LFJ ERP Banana Tracker | Arrival Record ID: {arrival.id || arrival.batchId}
            </div>
        </div>
    );
});

export default ArrivalManifest;
