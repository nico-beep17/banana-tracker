import React, { useState, useRef, useEffect } from 'react';
import { chatCompletion } from '../utils/geminiAPI';
import { marked } from 'marked';
import { Bot, X, Send, User, Sparkles } from 'lucide-react';
import './AIAssistantWidget.css';

// ─── helpers ───────────────────────────────────────────────────────────────
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const fmtPHP  = (n) => `₱${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

/** Parse a date string from user text. Returns null if unparseable. */
const parseUserDate = (text) => {
    // Catch "march 20", "march 20 2026", "20 march", "2026-03-20", "03/20/2026"
    const clean = text.toLowerCase();
    const months = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11,
        january:0,february:1,march:2,april:3,june:5,july:6,august:7,september:8,october:9,november:10,december:11 };
    const curYear = new Date().getFullYear();

    // Try ISO or slash format
    const isoMatch = clean.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) return new Date(+isoMatch[1], +isoMatch[2]-1, +isoMatch[3]);
    const slashMatch = clean.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (slashMatch) return new Date(+( slashMatch[3] || curYear ), +slashMatch[1]-1, +slashMatch[2]);

    // Try "march 20" / "20 march"
    for (const [mon, idx] of Object.entries(months)) {
        const m1 = clean.match(new RegExp(`${mon}\\s+(\\d{1,2})(?:\\s+(\\d{4}))?`));
        if (m1) return new Date(+(m1[2] || curYear), idx, +m1[1]);
        const m2 = clean.match(new RegExp(`(\\d{1,2})\\s+${mon}(?:\\s+(\\d{4}))?`));
        if (m2) return new Date(+(m2[2] || curYear), idx, +m2[1]);
    }
    return null;
};

/** Parse a week number from user text. */
const parseWeekNum = (text) => {
    const m = text.toLowerCase().match(/week\s*(\d{1,2})/i);
    return m ? +m[1] : null;
};

/** Try to find a farm from a fuzzy name/code mention in user text. */
const findFarm = (text, farms) => {
    const t = text.toLowerCase();
    return farms.find(f =>
        f.name?.toLowerCase().split(' ').some(w => w.length > 3 && t.includes(w)) ||
        f.farmCode?.toLowerCase() && t.includes(f.farmCode.toLowerCase())
    );
};

/** Get week number for a date */
const getWeekNum = (dateStr) => {
    const d = new Date(dateStr);
    const s = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d - s) / 86400000 + s.getDay() + 1) / 7);
};

// ─── local data resolver (answers purely from app state, no AI needed) ─────
const resolveLocally = (query, { arrivals, farms, weeklyRates = [], samplings = [] }) => {
    const q = query.toLowerCase();
    const parsed = {};

    // --- QUERY: deliveries on a specific date ---
    const date = parseUserDate(q);
    if (date && (q.includes('deliver') || q.includes('arrived') || q.includes('farm') || q.includes('how many'))) {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
        const dayArrivals = arrivals.filter(a => {
            // Check all three possible date fields (any may be the primary one)
            const d1 = (a.dateOfPacking || '').substring(0, 10);
            const d2 = (a.dateTimeArrive || '').substring(0, 10);
            const d3 = (a.dateTimeEncoded || '').substring(0, 10);
            return d1 === dateStr || d2 === dateStr || d3 === dateStr;
        });
        const uniqueFarmNames = [...new Set(dayArrivals.map(a => a.farmName || a.farmCode).filter(Boolean))];
        const uniqueFarmCodes = [...new Set(dayArrivals.map(a => a.farmCode).filter(Boolean))];
        const totalBoxes = dayArrivals.reduce((s, a) => s + (Number(a.quantity) || 0), 0);
        parsed.deliveryDate = date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
        parsed.farmsDelivered = uniqueFarmNames.length ? uniqueFarmNames : uniqueFarmCodes;
        parsed.totalBoxes = totalBoxes;
        parsed.arrivalCount = dayArrivals.length;
        parsed.searchedDateStr = dateStr;
    }

    // --- QUERY: pricing for a farm on a specific week ---
    const weekNum = parseWeekNum(q);
    const targetFarm = findFarm(q, farms);
    if (weekNum && (q.includes('price') || q.includes('rate') || q.includes('pricing') || q.includes('how much'))) {
        const year = new Date().getFullYear();
        const farmToSearch = targetFarm || null;
        let rateRecord = null;
        if (farmToSearch) {
            rateRecord = weeklyRates.find(r => r.farm_id === farmToSearch.id && r.week_number === weekNum && r.year === year);
        }
        parsed.weekQuery = weekNum;
        parsed.farmQuery = farmToSearch;
        parsed.rateRecord = rateRecord;
        parsed.allRates = rateRecord?.rates_matrix || null;
    }

    // --- QUERY: top farms / ranked deliveries ---
    if (q.includes('top') && (q.includes('farm') || q.includes('grower') || q.includes('produc'))) {
        const farmTotals = {};
        arrivals.forEach(a => {
            const key = a.farmName || a.farmCode;
            if (key) farmTotals[key] = (farmTotals[key] || 0) + (Number(a.quantity) || 0);
        });
        parsed.topFarms = Object.entries(farmTotals)
            .sort((a, b) => b[1] - a[1]).slice(0, 10)
            .map(([name, boxes]) => ({ name, boxes }));
    }

    return parsed;
};

const AIAssistantWidget = ({
    arrivals = [], containers = [], farms = [],
    weeklyRates = [], samplings = [],
    inventoryMetrics = {}, totalBoxesToday = 0,
    advancedAnalytics = {}, onClose
}) => {
    const [messages, setMessages] = useState([]);
    const [inputQuery, setInputQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        setMessages([{
            role: 'assistant',
            text: `Hello! I'm your **LAVC Copilot** — I have access to all your arrivals, farm registry, weekly pricing, and quality data.\n\nTry asking:\n- *"How many farms delivered last March 20?"*\n- *"What is Farm 1006 pricing for week 8?"*\n- *"Which farm produced the most boxes this week?"*`
        }]);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!inputQuery.trim()) return;
        const userMsg = inputQuery.trim();
        setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
        setInputQuery('');
        setIsLoading(true);

        try {
            // Vertex AI config is validated inside the helper

            // ── Step 1: Resolve locally from app state ──
            const localFacts = resolveLocally(userMsg, { arrivals, farms, weeklyRates, samplings });

            // ── Step 2: Build a rich, data-dense system context ──
            const recentArrivals = [...arrivals]
                .sort((a, b) => new Date(b.dateOfPacking || b.dateTimeEncoded) - new Date(a.dateOfPacking || a.dateTimeEncoded))
                .slice(0, 150)
                .map(a => ({
                    packDate: (a.dateOfPacking || '').substring(0, 10),
                    arriveDate: (a.dateTimeArrive || '').substring(0, 10),
                    encodedDate: (a.dateTimeEncoded || '').substring(0, 10),
                    farmName: a.farmName,
                    farmCode: a.farmCode,
                    qty: a.quantity,
                    typeId: a.typeId,
                    status: a.approval_status,
                    lockedRate: a.locked_rate,
                    plate: a.plateNumber,
                    week: a.dateOfPacking ? getWeekNum(a.dateOfPacking) : (a.dateTimeEncoded ? getWeekNum(a.dateTimeEncoded) : null),
                }));

            const farmRegistry = farms.map(f => ({
                code: f.farmCode, name: f.name, location: f.location,
                type: f.farmType, status: f.status, hectares: f.prodHas,
            }));

            const ratesSummary = weeklyRates.slice(-80).map(r => {
                const farm = farms.find(f => f.id === r.farm_id);
                return {
                    farm: farm?.name || farm?.farmCode || r.farm_id,
                    farmCode: farm?.farmCode,
                    week: r.week_number, year: r.year,
                    rates: r.rates_matrix,
                };
            });

            const samplingsSummary = samplings.slice(-40).map(s => ({
                date: (s.date || '').split('T')[0],
                farm: s.farmName || s.farmCode,
                inspector: s.inspector,
                decision: s.overallDecision,
                boxes: s.boxes?.length || 0,
            }));

            // ── Step 3: Local facts block injected into prompt ──
            let localFactsBlock = '';
            if (localFacts.deliveryDate) {
                localFactsBlock += `\n## Pre-computed: Deliveries on ${localFacts.deliveryDate}\n`;
                localFactsBlock += `- **${localFacts.farmsDelivered.length} farms** delivered: ${localFacts.farmsDelivered.join(', ')}\n`;
                localFactsBlock += `- **${localFacts.arrivalCount} arrival records**, total **${localFacts.totalBoxes.toLocaleString()} boxes**\n`;
            }
            if (localFacts.weekQuery && localFacts.farmQuery) {
                localFactsBlock += `\n## Pre-computed: Week ${localFacts.weekQuery} Rates for ${localFacts.farmQuery.name}\n`;
                if (localFacts.rateRecord) {
                    const m = localFacts.allRates;
                    localFactsBlock += `Rates found:\n`;
                    Object.entries(m).forEach(([k, v]) => {
                        if (v) localFactsBlock += `- ${k}: ${fmtPHP(v)}\n`;
                    });
                } else {
                    localFactsBlock += `No rate record found for ${localFacts.farmQuery.name} on Week ${localFacts.weekQuery}. Rates may not have been set yet.\n`;
                }
            }
            if (localFacts.weekQuery && !localFacts.farmQuery && localFacts.weekQuery) {
                const weekRates = weeklyRates.filter(r => r.week_number === localFacts.weekQuery);
                if (weekRates.length > 0) {
                    localFactsBlock += `\n## Pre-computed: All rates for Week ${localFacts.weekQuery}\n`;
                    weekRates.forEach(r => {
                        const farm = farms.find(f => f.id === r.farm_id);
                        const name = farm?.name || r.farm_id;
                        const first = Object.entries(r.rates_matrix || {}).find(([, v]) => v);
                        localFactsBlock += `- ${name}: ${first ? `${first[0]} = ${fmtPHP(first[1])}` : 'rates set'}\n`;
                    });
                }
            }
            if (localFacts.topFarms?.length) {
                localFactsBlock += `\n## Pre-computed: Top Producing Farms (all time)\n`;
                localFacts.topFarms.forEach((f, i) => {
                    localFactsBlock += `${i+1}. ${f.name} — ${f.boxes.toLocaleString()} boxes\n`;
                });
            }

            const systemContext = `You are the LAVC ERP AI Copilot — an expert AI assistant for LAVC, a banana exporting company in the Philippines.
You MUST answer ALL questions using the real data provided below. Never give generic or made-up answers.

## Live Operational Summary
- Today's boxes in hub: ${totalBoxesToday}
- Total arrivals in system: ${arrivals.length}
- Registered farms: ${farms.length}
- Hub inventory: Total=${inventoryMetrics.total || 0}, Class A=${inventoryMetrics.classA || 0}, Class B=${inventoryMetrics.classB || 0}
- Quality downgrade rate: ${advancedAnalytics.downgradeRate?.toFixed?.(1) || 0}%
- Collection efficiency: ${advancedAnalytics.collectionRate?.toFixed?.(1) || 100}%

## Active Containers
${JSON.stringify(containers.filter(c => !c.timeDeparted).map(c => ({
    id: c.reeferNo, brand: c.brand, totalBoxes: c.totalBoxes,
    status: c.timeSealed ? 'SEALED' : 'PACKING', destination: c.destination
})))}

## Farm Registry (${farmRegistry.length} farms)
${JSON.stringify(farmRegistry)}

## Recent Arrivals (last 120 records)
${JSON.stringify(recentArrivals)}

## Weekly Pricing Rates (latest 80 entries)
${JSON.stringify(ratesSummary)}

## Sampling QC Logs (latest 40)
${JSON.stringify(samplingsSummary)}

${localFactsBlock ? `## CRITICAL PRE-COMPUTED FACTS (use these verbatim for accuracy):\n${localFactsBlock}` : ''}

## Instructions
- Answer concisely and accurately using the data above.
- For date questions, look at the "Recent Arrivals" array for records where date matches.
- For pricing questions, look at "Weekly Pricing Rates" for the matching farm and week.
- Use markdown: bold numbers, bullet lists, tables where useful.
- If data is not found, say so clearly and suggest checking Bulk Edit to enter it.
- Never fabricate data. If something is genuinely not in the dataset, say it's not recorded.
- Current date: ${new Date().toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
- Current week number: ${getWeekNum(new Date())}`;

            const responseText = await chatCompletion({
                systemPrompt: systemContext,
                userMessage: userMsg,
                model: 'gemini-2.5-flash',
                temperature: 0.05,
            });

            setMessages(prev => [...prev, { role: 'assistant', text: responseText }]);

        } catch (error) {
            console.error('AI Assistant Error:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                text: `⚠️ Error: ${error.message}`
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="ai-widget-container shadow-lg slide-up">
            <header className="ai-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Bot size={20} color="var(--color-primary-main)" />
                    <h4 style={{ margin: 0 }}>LAVC Copilot</h4>
                    <span className="online-indicator" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px', background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '12px' }}>
                        <span style={{ width: '6px', height: '6px', background: '#22c55e', borderRadius: '50%', display: 'inline-block' }}></span> Online
                    </span>
                </div>
                <button className="close-btn" onClick={onClose} style={{ display: 'flex', alignItems: 'center' }}><X size={20} /></button>
            </header>

            <div className="ai-chat-history">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`chat-bubble ${msg.role}`}>
                        <div className="chat-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: msg.role === 'assistant' ? 'var(--color-primary-soft)' : '#f1f5f9', color: msg.role === 'assistant' ? 'var(--color-primary-main)' : 'var(--text-secondary)' }}>
                            {msg.role === 'assistant' ? <Sparkles size={16} /> : <User size={16} />}
                        </div>
                        <div className="chat-content">
                            {msg.role === 'user' ? (
                                <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{msg.text}</p>
                            ) : (
                                <div style={{ position: 'relative' }}>
                                    <div className="markdown-body" dangerouslySetInnerHTML={{ __html: marked.parse(msg.text) }} />
                                    {msg.text && (
                                        <button 
                                            onClick={(e) => {
                                                navigator.clipboard.writeText(msg.text);
                                                e.currentTarget.innerText = '✅ Copied!';
                                                setTimeout(() => { e.currentTarget.innerText = '📋 Copy'; }, 2000);
                                            }}
                                            style={{ marginTop: '0.5rem', background: '#e2e8f0', color: '#475569', border: 'none', padding: '0.2rem 0.6rem', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', transition: 'all 0.2s ease' }}
                                        >
                                            📋 Copy
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="chat-bubble assistant">
                        <div className="chat-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-primary-soft)', color: 'var(--color-primary-main)' }}><Sparkles size={16} /></div>
                        <div className="chat-content loading-dots"><span>.</span><span>.</span><span>.</span></div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="ai-input-area" style={{ display: 'flex', gap: '8px', padding: '1rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-surface)' }}>
                <input
                    type="text"
                    className="input-field"
                    placeholder="Ask about farms, pricing, deliveries..."
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSend()}
                    style={{ flex: 1 }}
                />
                <button
                    className="btn-primary"
                    onClick={handleSend}
                    disabled={isLoading || !inputQuery.trim()}
                    style={{ padding: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
};

export default AIAssistantWidget;
