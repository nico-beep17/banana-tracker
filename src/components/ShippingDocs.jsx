import React, { useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { 
    CalendarClock, Clock, CheckCircle2, Circle, AlertCircle, FileText, 
    Ship, BookOpen, FileCheck, CheckSquare, Search, ChevronDown, ChevronUp, Anchor,
    Mails, CheckCircle, Printer, Mail, Loader2, Sparkles, ExternalLink
} from 'lucide-react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { useContainersQuery } from '../queries/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { searchGmailForContainer, getEmailHtmlForPrint } from '../utils/gmailScanner';
import './ShippingDocs.css';

const DEFAULT_DOCS_STATE = {
    preDeparture: {
        atwObtained: false,
        atwUsed: false,
        etradeRegistered: false,
        ciDone: false,
        plDone: false,
        lcuDone: false,
        phytoDone: false
    },
    certOfOrigin: {
        closedTicket: false,
        ed: false,
        bl: false,
        ci: false,
        pl: false,
        ctcPhyto: false
    }
};

const SCHED_REMINDERS = [
    { day: 'Monday', task: 'Packplan Sent by Supervisor', icon: <FileText size={24} />, bg: 'var(--color-primary-soft)', color: 'var(--color-primary-main)' },
    { day: 'Thursday', task: 'Send Shipping Instructions', icon: <BookOpen size={24} />, bg: '#fff7ed', color: '#ea580c' },
    { day: 'Friday', task: 'Book to Shipping Lines', icon: <Anchor size={24} />, bg: '#f0fdf4', color: '#16a34a' },
    { day: 'Notice', task: 'Book COSCO 2 weeks before', icon: <Clock size={24} />, bg: '#eff6ff', color: '#2563eb' }
];

const PRE_DEPARTURE_LIST = [
    { key: 'atwObtained', label: 'ATW obtained from shipping lines' },
    { key: 'atwUsed', label: 'ATW used to get Container from CY' },
    { key: 'etradeRegistered', label: 'Register to eTrade.net.ph & input details' },
    { key: 'ciDone', label: 'Commercial Invoice (CI) from BIR' },
    { key: 'plDone', label: 'Packing List (PL)' },
    { key: 'lcuDone', label: 'Letter of Commitment and Undertaking (LCU)' },
    { key: 'phytoDone', label: 'Phytosanitary Certificate' }
];

const CERT_OF_ORIGIN_LIST = [
    { key: 'closedTicket', label: 'Closed Ticket' },
    { key: 'ed', label: 'ED (Export Declaration)' },
    { key: 'bl', label: 'BL (Bill of Lading)' },
    { key: 'ci', label: 'CI (Commercial Invoice)' },
    { key: 'pl', label: 'PL (Packing List)' },
    { key: 'ctcPhyto', label: 'CTC PHYTO' }
];

// Inner component for the actual Google Login button
const GoogleAuthButton = ({ onToken }) => {
    const login = useGoogleLogin({
        scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        onSuccess: tokenResponse => {
            const token = tokenResponse.access_token;
            sessionStorage.setItem('lavc_company_gmail_token', token);
            onToken(token);
            toast.success("Connected to LFJ Google Workspace!");
        },
        onError: error => {
            console.error('Google Auth Failed:', error);
            toast.error("Failed to connect to Google Workspace.");
        }
    });

    return (
        <button className="btn-primary" onClick={() => login()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#3b82f6', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem' }}>
            <Mails size={16} />
            Connect Company Gmail
        </button>
    );
};

const ShippingDocs = () => {
    const queryClient = useQueryClient();
    const { data: containers = [] } = useContainersQuery();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [updating, setUpdating] = useState(false);
    
    // Auto-load company Gmail token from sessionStorage
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    const [gmailToken, setGmailToken] = useState(() => sessionStorage.getItem('lavc_company_gmail_token') || null);

    // Gmail scan results cache: { [containerId]: { matchedDocs, vesselInfo, messages, scanning, error } }
    const [scanResults, setScanResults] = useState({});
    const scanningRef = useRef(new Set()); // track in-flight scans

    // Only show active containers (not arrived)
    const activeContainers = useMemo(() => {
        return containers
            .filter(c => c.transit_status !== 'ARRIVED')
            .sort((a, b) => new Date(b.created_at || b.date) - new Date(a.created_at || a.date));
    }, [containers]);

    const filteredContainers = useMemo(() => {
        if (!searchQuery) return activeContainers;
        const q = searchQuery.toLowerCase();
        return activeContainers.filter(c => 
            (c.reeferNo || '').toLowerCase().includes(q) ||
            (c.brand || '').toLowerCase().includes(q) ||
            (c.destination || '').toLowerCase().includes(q)
        );
    }, [activeContainers, searchQuery]);

    // Scan Gmail for a specific container
    const scanContainerEmails = useCallback(async (containerId, reeferNo) => {
        if (!gmailToken || !reeferNo || scanningRef.current.has(containerId)) return;
        
        scanningRef.current.add(containerId);
        setScanResults(prev => ({ ...prev, [containerId]: { ...prev[containerId], scanning: true, error: null } }));
        
        const result = await searchGmailForContainer(gmailToken, reeferNo);
        
        if (result.error === 'TOKEN_EXPIRED') {
            sessionStorage.removeItem('lavc_company_gmail_token');
            setGmailToken(null);
            toast.error('Gmail token expired. Please reconnect.');
            scanningRef.current.delete(containerId);
            return;
        }
        
        setScanResults(prev => ({
            ...prev,
            [containerId]: {
                matchedDocs: result.matchedDocs || {},
                vesselInfo: result.vesselInfo || {},
                messages: result.messages || [],
                totalFound: result.totalFound || 0,
                scanning: false,
                error: result.error || null,
                scannedAt: new Date().toISOString(),
            }
        }));
        
        // Auto-fill vessel info if found
        if (result.vesselInfo && Object.keys(result.vesselInfo).length > 0) {
            await autoFillVesselInfo(containerId, result.vesselInfo);
        }
        
        scanningRef.current.delete(containerId);
    }, [gmailToken]);

    // Auto-fill vessel/shipping info from scanned emails into the container record
    // ALWAYS overwrites — newer emails may have corrections, delays, vessel changes
    const autoFillVesselInfo = async (containerId, vesselInfo) => {
        const container = containers.find(c => c.id === containerId);
        if (!container) return;

        const updates = {};
        const v = (field) => vesselInfo[field]?.value; // Extract .value from { value, source, date }
        
        if (v('vesselName')) updates.reeferName = v('vesselName');
        if (v('voyageNo')) updates.voyageNo = v('voyageNo');
        if (v('eta')) updates.eta = v('eta');
        if (v('etd')) updates.etd = v('etd');
        if (v('shippingLine')) updates.shippingLine = v('shippingLine');
        if (v('sealNo')) updates.sealNo = v('sealNo');

        if (Object.keys(updates).length === 0) return;

        const { error } = await supabase
            .from('containers')
            .update(updates)
            .eq('id', containerId);

        if (!error) {
            queryClient.invalidateQueries({ queryKey: ['containers'] });
            const fields = Object.keys(updates).join(', ');
            toast.success(`Updated from latest email: ${fields}`, { duration: 4000 });
        }
    };

    const toggleExpand = (id) => {
        const newSet = new Set(expandedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
            // Auto-scan when expanding if we have a Gmail token and no cached result
            const container = containers.find(c => c.id === id);
            if (gmailToken && container?.reeferNo && !scanResults[id]) {
                scanContainerEmails(id, container.reeferNo);
            }
        }
        setExpandedIds(newSet);
    };

    const handleToggleChecklist = async (containerId, category, key, currentValue) => {
        if (updating) return;
        setUpdating(true);

        const container = containers.find(c => c.id === containerId);
        
        let currentDocs = container.shippingDocs || JSON.parse(JSON.stringify(DEFAULT_DOCS_STATE));
        if (typeof currentDocs === 'string') {
            try { currentDocs = JSON.parse(currentDocs); } catch (e) { currentDocs = JSON.parse(JSON.stringify(DEFAULT_DOCS_STATE)); }
        }
        
        if (!currentDocs[category]) {
            currentDocs[category] = {};
        }

        const updatedDocs = {
            ...currentDocs,
            [category]: {
                ...currentDocs[category],
                [key]: !currentValue
            }
        };

        const { error, data } = await supabase
            .from('containers')
            .update({ shippingDocs: updatedDocs })
            .eq('id', containerId)
            .select();

        if (error) {
            console.error("Supabase Error (Update Docs):", error);
            toast.error("Failed to update checklist.");
        } else if (data && data[0]) {
            queryClient.invalidateQueries({ queryKey: ['containers'] });
        }
        
        setUpdating(false);
    };

    // Print a specific email
    const handlePrintEmail = async (emailId) => {
        if (!gmailToken) return;
        toast.loading('Loading email for print...', { id: 'print-loading' });
        
        const html = await getEmailHtmlForPrint(gmailToken, emailId);
        toast.dismiss('print-loading');
        
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (printWindow) {
            printWindow.document.write(html);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 500);
        }
    };

    const getProgress = (containerCategoryState, checklist) => {
        if (!containerCategoryState) return 0;
        const total = checklist.length;
        const completed = checklist.filter(item => containerCategoryState[item.key]).length;
        return total > 0 ? (completed / total) * 100 : 0;
    };

    // Render a checklist item with Gmail detection badge
    const renderChecklistItem = (item, category, docsState, containerId) => {
        const isChecked = docsState[category]?.[item.key];
        const scan = scanResults[containerId];
        const detected = scan?.matchedDocs?.[item.key];
        const isScanning = scan?.scanning;

        return (
            <li 
                key={item.key} 
                className={`sd-checkbox-item ${isChecked ? 'checked' : ''} ${detected ? 'sd-gmail-detected' : ''}`}
            >
                <div 
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, cursor: 'pointer' }}
                    onClick={() => handleToggleChecklist(containerId, category, item.key, isChecked)}
                >
                    <span className="sd-checkbox-icon">
                        {isChecked ? <CheckSquare size={18} /> : <Circle size={18} />}
                    </span>
                    <span className="sd-checkbox-label">
                        {item.label}
                    </span>
                </div>

                {/* Gmail detection indicator */}
                {isScanning && !detected && (
                    <span style={{ opacity: 0.4 }}>
                        <Loader2 size={14} className="sd-spin" />
                    </span>
                )}

                {detected && (
                    <div className="sd-detected-badge">
                        <span className="sd-detected-tag" title={`Found in: ${detected.emails[0]?.subject || 'email'}`}>
                            <Mail size={12} />
                            <span className="sd-detected-count">{detected.emails.length}</span>
                        </span>
                        <button 
                            className="sd-print-btn"
                            onClick={(e) => { e.stopPropagation(); handlePrintEmail(detected.emails[0].id); }}
                            title={`Print: ${detected.emails[0]?.subject}`}
                        >
                            <Printer size={13} />
                        </button>
                        {detected.emails.length > 1 && (
                            <button 
                                className="sd-print-btn"
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    // Open all in new tabs
                                    detected.emails.forEach(em => handlePrintEmail(em.id));
                                }}
                                title="Print all related emails"
                                style={{ fontSize: '0.65rem', padding: '0.15rem 0.3rem' }}
                            >
                                All
                            </button>
                        )}
                    </div>
                )}
            </li>
        );
    };

    return (
        <div className="shipping-docs-container animation-fade-in">
            <header className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h2>Shipping Documentation Office</h2>
                    <p>Track export declarations, shipping schedules, and BOC certificates.</p>
                </div>
            </header>

            {/* Google Workspace — auto-connected status bar */}
            <section className="sd-workspace-panel shadow-sm">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ background: gmailToken ? '#ecfdf5' : '#eff6ff', padding: '0.45rem', borderRadius: '8px', color: gmailToken ? '#10b981' : '#3b82f6' }}>
                            <Mails size={20} />
                        </div>
                        <div>
                            <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>LFJ Google Workspace</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginLeft: '0.5rem' }}>
                                {gmailToken ? '• Gmail API active — auto-scanning inboxes' : '• Not connected'}
                            </span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {gmailToken ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
                                <CheckCircle size={16} /> Connected
                            </span>
                        ) : googleClientId ? (
                            <GoogleOAuthProvider clientId={googleClientId}>
                                <GoogleAuthButton onToken={setGmailToken} />
                            </GoogleOAuthProvider>
                        ) : (
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>OAuth not configured</span>
                        )}
                    </div>
                </div>
            </section>

            {/* Weekly Schedule & Reminders Widget */}
            <section className="sd-reminders-grid">
                {SCHED_REMINDERS.map((reminder, idx) => (
                    <div key={idx} className="sd-reminder-card shadow-sm hover-lift">
                        <div className="sd-icon-wrapper" style={{ backgroundColor: reminder.bg, color: reminder.color }}>
                            {reminder.icon}
                        </div>
                        <div className="sd-reminder-content">
                            <span className="sd-day-badge" style={{ color: reminder.color, borderColor: reminder.color }}>{reminder.day}</span>
                            <h4>{reminder.task}</h4>
                        </div>
                    </div>
                ))}
            </section>

            <section className="sd-tracker-section">
                <div className="sd-tracker-header">
                    <h3>Active Consignments ({filteredContainers.length})</h3>
                    <div className="sd-search-box">
                        <Search size={18} />
                        <input 
                            type="text" 
                            placeholder="Search Container / Brand..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="sd-container-list">
                    {filteredContainers.length === 0 ? (
                        <div className="empty-state text-center">
                            <div style={{ fontSize: '3rem', margin: '2rem' }}>📭</div>
                            <h3>No active containers found</h3>
                            <p className="text-secondary">Tracked containers will appear here for documentation processing.</p>
                        </div>
                    ) : (
                        filteredContainers.map(container => {
                            const isExpanded = expandedIds.has(container.id);
                            const scan = scanResults[container.id];
                            
                            // Initialize state safely
                            let docsState = container.shippingDocs;
                            if (!docsState) docsState = DEFAULT_DOCS_STATE;
                            else if (typeof docsState === 'string') {
                                try { docsState = JSON.parse(docsState); } catch(e) { docsState = DEFAULT_DOCS_STATE; }
                            }
                            if(!docsState.preDeparture) docsState.preDeparture = {};
                            if(!docsState.certOfOrigin) docsState.certOfOrigin = {};

                            const preDepProgress = getProgress(docsState.preDeparture, PRE_DEPARTURE_LIST);
                            const certOriginProgress = getProgress(docsState.certOfOrigin, CERT_OF_ORIGIN_LIST);
                            const overallCompleted = preDepProgress === 100 && certOriginProgress === 100;
                            const detectedCount = scan?.matchedDocs ? Object.keys(scan.matchedDocs).length : 0;

                            return (
                                <div key={container.id} className={`sd-container-card shadow-sm ${overallCompleted ? 'sd-completed' : ''}`}>
                                    <div className="sd-card-header" onClick={() => toggleExpand(container.id)}>
                                        <div className="sd-header-info">
                                            <div className="sd-brand-badge">
                                                <Ship size={16} />
                                                {container.reeferNo || 'Pending Container'}
                                            </div>
                                            <h4>{container.destination || 'Unassigned Destination'} | {container.brand}</h4>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                                                {container.transit_status || 'HUB'}
                                                {scan?.vesselInfo?.vesselName?.value && (
                                                    <span style={{ marginLeft: '0.5rem', color: '#7c3aed', fontWeight: 600 }}>
                                                        • MV {scan.vesselInfo.vesselName.value}
                                                        {scan.vesselInfo.voyageNo?.value && ` V.${scan.vesselInfo.voyageNo.value}`}
                                                    </span>
                                                )}
                                            </span>
                                        </div>

                                        <div className="sd-progress-overview">
                                            {/* Gmail scan indicator */}
                                            {scan && !scan.scanning && scan.totalFound > 0 && (
                                                <div className="sd-email-count" title={`${scan.totalFound} emails found, ${detectedCount} docs matched`}>
                                                    <Mail size={14} />
                                                    <span>{detectedCount}</span>
                                                </div>
                                            )}
                                            {scan?.scanning && (
                                                <div className="sd-email-count sd-scanning">
                                                    <Loader2 size={14} className="sd-spin" />
                                                </div>
                                            )}

                                            <div className="sd-progress-bars">
                                                <div className="sd-mini-progress" title={`Pre-Departure: ${Math.round(preDepProgress)}%`}>
                                                    <div className="sd-mini-bar" style={{ width: `${preDepProgress}%`, backgroundColor: preDepProgress === 100 ? '#10b981' : '#3b82f6' }}></div>
                                                </div>
                                                <div className="sd-mini-progress" title={`Cert of Origin: ${Math.round(certOriginProgress)}%`}>
                                                    <div className="sd-mini-bar" style={{ width: `${certOriginProgress}%`, backgroundColor: certOriginProgress === 100 ? '#10b981' : '#f59e0b' }}></div>
                                                </div>
                                            </div>
                                            <div className="sd-expand-btn">
                                                {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </div>
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="sd-card-body animation-fade-in">
                                            {/* Vessel info auto-filled banner */}
                                            {scan?.vesselInfo && Object.keys(scan.vesselInfo).length > 0 && (
                                                <div className="sd-vessel-banner">
                                                    <Sparkles size={16} />
                                                    <span>Auto-detected from latest emails:</span>
                                                    {scan.vesselInfo.vesselName?.value && <span className="sd-vessel-tag">🚢 {scan.vesselInfo.vesselName.value}</span>}
                                                    {scan.vesselInfo.voyageNo?.value && <span className="sd-vessel-tag">📋 VOY {scan.vesselInfo.voyageNo.value}</span>}
                                                    {scan.vesselInfo.eta?.value && <span className="sd-vessel-tag">📅 ETA {scan.vesselInfo.eta.value}</span>}
                                                    {scan.vesselInfo.etd?.value && <span className="sd-vessel-tag">🚀 ETD {scan.vesselInfo.etd.value}</span>}
                                                    {scan.vesselInfo.shippingLine?.value && <span className="sd-vessel-tag">🏢 {scan.vesselInfo.shippingLine.value}</span>}
                                                    {scan.vesselInfo.sealNo?.value && <span className="sd-vessel-tag">🔒 Seal {scan.vesselInfo.sealNo.value}</span>}
                                                </div>
                                            )}

                                            {/* Scan status banner */}
                                            {scan?.scanning && (
                                                <div className="sd-scan-banner">
                                                    <Loader2 size={16} className="sd-spin" />
                                                    <span>Scanning company inbox for documents related to <strong>{container.reeferNo}</strong>…</span>
                                                </div>
                                            )}

                                            {gmailToken && !scan && container.reeferNo && (
                                                <div className="sd-scan-banner" style={{ cursor: 'pointer' }}
                                                    onClick={() => scanContainerEmails(container.id, container.reeferNo)}>
                                                    <Mail size={16} />
                                                    <span>Click to scan Gmail for <strong>{container.reeferNo}</strong> documents</span>
                                                </div>
                                            )}

                                            {scan && !scan.scanning && scan.totalFound > 0 && (
                                                <div className="sd-scan-summary">
                                                    <CheckCircle2 size={14} />
                                                    <span>{scan.totalFound} email{scan.totalFound !== 1 ? 's' : ''} found • {detectedCount} document{detectedCount !== 1 ? 's' : ''} matched</span>
                                                    <button 
                                                        className="sd-rescan-btn"
                                                        onClick={() => { 
                                                            setScanResults(prev => { const n = {...prev}; delete n[container.id]; return n; });
                                                            scanContainerEmails(container.id, container.reeferNo);
                                                        }}
                                                    >
                                                        ↻ Rescan
                                                    </button>
                                                </div>
                                            )}

                                            {scan && !scan.scanning && scan.totalFound === 0 && !scan.error && (
                                                <div className="sd-scan-summary" style={{ color: '#94a3b8' }}>
                                                    <AlertCircle size={14} />
                                                    <span>No emails found for <strong>{container.reeferNo}</strong> in company inbox</span>
                                                    <button 
                                                        className="sd-rescan-btn"
                                                        onClick={() => { 
                                                            setScanResults(prev => { const n = {...prev}; delete n[container.id]; return n; });
                                                            scanContainerEmails(container.id, container.reeferNo);
                                                        }}
                                                    >
                                                        ↻ Retry
                                                    </button>
                                                </div>
                                            )}

                                            <div className="sd-checklists-grid">
                                                {/* Pre-departure */}
                                                <div className="sd-checklist-column">
                                                    <div className="sd-checklist-title">
                                                        <FileCheck size={18} className="text-primary" />
                                                        <h5>PREDEPARTURE Documents</h5>
                                                    </div>
                                                    <ul className="sd-checkbox-list">
                                                        {PRE_DEPARTURE_LIST.map(item => 
                                                            renderChecklistItem(item, 'preDeparture', docsState, container.id)
                                                        )}
                                                    </ul>
                                                </div>

                                                {/* Cert of Origin */}
                                                <div className="sd-checklist-column">
                                                    <div className="sd-checklist-title" style={{ color: '#d97706' }}>
                                                        <AlertCircle size={18} />
                                                        <h5>Attachment for Certificate of Origin (BOC)</h5>
                                                    </div>
                                                    <ul className="sd-checkbox-list">
                                                        {CERT_OF_ORIGIN_LIST.map(item => 
                                                            renderChecklistItem(item, 'certOfOrigin', docsState, container.id)
                                                        )}
                                                    </ul>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </section>
        </div>
    );
};

export default ShippingDocs;
