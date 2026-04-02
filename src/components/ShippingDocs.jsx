import React, { useState, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { toast } from 'sonner';
import { 
    CalendarClock, Clock, CheckCircle2, Circle, AlertCircle, FileText, 
    Ship, BookOpen, FileCheck, CheckSquare, Search, ChevronDown, ChevronUp, Anchor,
    Mails, CheckCircle
} from 'lucide-react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { useContainersQuery } from '../queries/hooks';
import { useQueryClient } from '@tanstack/react-query';
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

// Inner component for the actual Google Login button avoiding provider boundary issues
const GoogleAuthButton = ({ setGmailToken }) => {
    const login = useGoogleLogin({
        scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly',
        onSuccess: tokenResponse => {
            console.log('Google Auth Success:', tokenResponse);
            setGmailToken(tokenResponse.access_token);
            toast.success("Successfully connected to LFJ Google Workspace!");
        },
        onError: error => {
            console.error('Google Auth Failed:', error);
            toast.error("Failed to connect to Google Workspace.");
        }
    });

    return (
        <button className="btn-primary" onClick={() => login()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#3b82f6', border: 'none', padding: '0.6rem 1.2rem', borderRadius: '8px' }}>
            <Mails size={18} />
            Connect Google (LFJ)
        </button>
    );
};

const ShippingDocs = () => {
    const queryClient = useQueryClient();
    const { data: containers = [] } = useContainersQuery();
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedIds, setExpandedIds] = useState(new Set());
    const [updating, setUpdating] = useState(false);
    
    // Google Client ID auto-loaded from env
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    const [gmailToken, setGmailToken] = useState(null);

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

    const toggleExpand = (id) => {
        const newSet = new Set(expandedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
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

    const getProgress = (containerCategoryState, checklist) => {
        if (!containerCategoryState) return 0;
        const total = checklist.length;
        const completed = checklist.filter(item => containerCategoryState[item.key]).length;
        return total > 0 ? (completed / total) * 100 : 0;
    };

    return (
        <div className="shipping-docs-container animation-fade-in">
            <header className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h2>Shipping Documentation Office</h2>
                    <p>Track export declarations, shipping schedules, and BOC certificates.</p>
                </div>
            </header>

            {/* Google Workspace Integration Panel — Simplified */}
            <section className="sd-workspace-panel shadow-sm">
                <div className="sd-workspace-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <div style={{ background: '#eff6ff', padding: '0.5rem', borderRadius: '8px', color: '#3b82f6' }}>
                            <Mails size={24} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>Google Workspace Integration</h3>
                            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Connect LFJ Gmail to automate Packplan & Shipping Instructions</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        {gmailToken ? (
                            <>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>
                                    <CheckCircle size={16} /> Connected
                                </span>
                                <button 
                                    className="btn-secondary" 
                                    style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', color: '#ef4444', borderColor: '#fca5a5' }}
                                    onClick={() => { setGmailToken(null); toast.info('Disconnected from Google Workspace.'); }}
                                >
                                    Disconnect
                                </button>
                            </>
                        ) : googleClientId ? (
                            <GoogleOAuthProvider clientId={googleClientId}>
                                <GoogleAuthButton setGmailToken={setGmailToken} />
                            </GoogleOAuthProvider>
                        ) : (
                            <span style={{ fontSize: '0.85rem', color: '#ef4444', fontWeight: 600 }}>
                                <AlertCircle size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                Missing VITE_GOOGLE_CLIENT_ID
                            </span>
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
                                            </span>
                                        </div>

                                        <div className="sd-progress-overview">
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
                                            <div className="sd-checklists-grid">
                                                
                                                {/* Pre-departure */}
                                                <div className="sd-checklist-column">
                                                    <div className="sd-checklist-title">
                                                        <FileCheck size={18} className="text-primary" />
                                                        <h5>PREDEPARTURE Documents</h5>
                                                    </div>
                                                    <ul className="sd-checkbox-list">
                                                        {PRE_DEPARTURE_LIST.map(item => (
                                                            <li 
                                                                key={item.key} 
                                                                className={`sd-checkbox-item ${docsState.preDeparture[item.key] ? 'checked' : ''}`}
                                                                onClick={() => handleToggleChecklist(container.id, 'preDeparture', item.key, docsState.preDeparture[item.key])}
                                                            >
                                                                <span className="sd-checkbox-icon">
                                                                    {docsState.preDeparture[item.key] ? <CheckSquare size={18} /> : <Circle size={18} />}
                                                                </span>
                                                                <span className="sd-checkbox-label">
                                                                    {item.label}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                {/* Cert of Origin */}
                                                <div className="sd-checklist-column">
                                                    <div className="sd-checklist-title" style={{ color: '#d97706' }}>
                                                        <AlertCircle size={18} />
                                                        <h5>Attachment for Certificate of Origin (BOC)</h5>
                                                    </div>
                                                    <ul className="sd-checkbox-list">
                                                        {CERT_OF_ORIGIN_LIST.map(item => (
                                                            <li 
                                                                key={item.key} 
                                                                className={`sd-checkbox-item ${docsState.certOfOrigin[item.key] ? 'checked' : ''}`}
                                                                onClick={() => handleToggleChecklist(container.id, 'certOfOrigin', item.key, docsState.certOfOrigin[item.key])}
                                                            >
                                                                <span className="sd-checkbox-icon">
                                                                    {docsState.certOfOrigin[item.key] ? <CheckSquare size={18} /> : <Circle size={18} />}
                                                                </span>
                                                                <span className="sd-checkbox-label">
                                                                    {item.label}
                                                                </span>
                                                            </li>
                                                        ))}
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
