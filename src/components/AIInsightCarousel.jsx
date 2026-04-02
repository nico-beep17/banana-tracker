import React, { useState, useEffect, useRef } from 'react';
import './AIInsightCarousel.css';
import { useArrivalsQuery, useContainersQuery, useSamplingsQuery } from '../queries/hooks';

// On native (APK), relative URLs don't resolve to the Vercel server.
// Always use the absolute production URL for the AI API.
const AI_API_URL = window.Capacitor && window.Capacitor.isNativePlatform()
    ? 'https://banana-tracker-five.vercel.app/api/ai-insight'
    : '/api/ai-insight';

const STATUS_CONFIG = {
    ok:       { color: '#10b981', bg: 'rgba(16, 185, 129, 0.10)', border: '#10b981', label: 'HEALTHY' },
    warning:  { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.10)', border: '#f59e0b', label: 'ATTENTION' },
    critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.10)',  border: '#ef4444', label: 'CRITICAL'  },
    info:     { color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.10)', border: '#8b5cf6', label: 'INSIGHT'   },
};

const PLACEHOLDER_CARDS = [
    { title: 'Operations Overview', icon: '📦', status: 'info', headline: 'Analyzing operations…', detail: 'The AI is reading your current data. This takes a few seconds.' },
    { title: 'Quality Analysis',    icon: '🔬', status: 'info', headline: 'Checking quality patterns…', detail: 'Sampling and downgrade trends are being evaluated.' },
    { title: 'Financial Health',    icon: '💰', status: 'info', headline: 'Reviewing cash flow…', detail: 'Collection rates and outstanding receivables are being assessed.' },
    { title: 'Recommendations',     icon: '✨', status: 'info', headline: 'Building action plan…', detail: 'Personalized recommendations are being generated.' },
];

export default function AIInsightCarousel({ metrics }) {
    const { data: arrivals = [] } = useArrivalsQuery();
    const { data: containers = [] } = useContainersQuery();
    const { data: samplings = [] } = useSamplingsQuery();
    const [cards, setCards] = useState(PLACEHOLDER_CARDS);
    const [active, setActive] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const timerRef = useRef(null);
    const hasFetched = useRef(false);

    // Auto-advance carousel every 5 seconds
    useEffect(() => {
        timerRef.current = setInterval(() => {
            setActive(prev => (prev + 1) % cards.length);
        }, 5000);
        return () => clearInterval(timerRef.current);
    }, [cards.length]);

    // Fetch AI insights once on mount (cached per session)
    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;

        const cacheKey = 'lavc_ai_insight_cache';
        const cacheTime = 'lavc_ai_insight_time';
        const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

        const cached = sessionStorage.getItem(cacheKey);
        const cachedAt = parseInt(sessionStorage.getItem(cacheTime) || '0', 10);
        if (cached && Date.now() - cachedAt < CACHE_TTL) {
            try {
                setCards(JSON.parse(cached));
                setLoading(false);
                return;
            } catch (_) {}
        }

        const totalBoxes = arrivals.reduce((s, a) => s + (Number(a.quantity) || 0), 0);
        const approvedArrivals = arrivals.filter(a => a.approval_status === 'APPROVED');
        const pendingArrivals = arrivals.filter(a => a.approval_status === 'PENDING').length;
        const totalRevenue = containers.reduce((s, c) => s + (Number(c.totalBoxes || 0) * (Number(c.agreed_rate) || 0)), 0);
        const collected = containers.reduce((s, c) => s + (Number(c.amount_paid_partial) || 0), 0);
        const collectionRate = totalRevenue > 0 ? ((collected / totalRevenue) * 100).toFixed(1) : 'N/A';
        const unsealedCount = containers.filter(c => !c.transit_status || c.transit_status === 'PENDING').length;

        const globalBoxes = samplings.flatMap(s => s.boxes || []);
        const downgraded = globalBoxes.filter(b => b.decision === 'DOWNGRADED' || b.decision?.startsWith('B-')).length;
        const rejected = globalBoxes.filter(b => b.decision === 'REJECTED' || b.decision?.startsWith('C-')).length;
        const downgradeRate = globalBoxes.length > 0 ? ((downgraded / globalBoxes.length) * 100).toFixed(1) : '0';
        const rejectionRate = globalBoxes.length > 0 ? ((rejected / globalBoxes.length) * 100).toFixed(1) : '0';

        const farmVolumes = approvedArrivals.reduce((acc, a) => {
            acc[a.farmName || 'Unknown'] = (acc[a.farmName || 'Unknown'] || 0) + (Number(a.quantity) || 0);
            return acc;
        }, {});
        const topFarmsStr = Object.entries(farmVolumes).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, v]) => `${n} (${v} boxes)`).join(', ');

        const prompt = `You are an AI operations analyst for LAVC, a banana export company. Analyze the following and return a JSON object ONLY (no markdown, no explanation, just raw JSON).

Operational Data:
- Approved arrivals: ${approvedArrivals.length} logs, ${totalBoxes.toLocaleString()} total boxes
- Pending approval: ${pendingArrivals} arrivals
- Containers: ${containers.length} total, ${unsealedCount} pending dispatch
- Revenue: PHP ${totalRevenue.toLocaleString()} | Collected: PHP ${collected.toLocaleString()} (${collectionRate}% rate)
- QA Sampled: ${globalBoxes.length} boxes | Downgrade rate: ${downgradeRate}% | Rejection rate: ${rejectionRate}%
- Top farms: ${topFarmsStr || 'No data'}

Return this exact JSON structure with exactly 4 cards:
{
  "cards": [
    {
      "title": "Operations Overview",
      "icon": "📦",
      "status": "ok|warning|critical",
      "headline": "One punchy sentence headline (max 10 words)",
      "detail": "2-3 sentences of analysis. Be specific with numbers."
    },
    {
      "title": "Quality Intelligence",
      "icon": "🔬",
      "status": "ok|warning|critical",
      "headline": "One punchy quality-focused headline",
      "detail": "2-3 sentences about QA patterns, downgrade trends or quality risks."
    },
    {
      "title": "Financial Health",
      "icon": "💰",
      "status": "ok|warning|critical",
      "headline": "One punchy financial headline",
      "detail": "2-3 sentences about collection rate, revenue risk, or outstanding amounts."
    },
    {
      "title": "AI Recommendations",
      "icon": "✨",
      "status": "info",
      "headline": "Top priority action",
      "detail": "3 specific bullet-point actions (use • as bullet)."
    }
  ]
}`;

        fetch(AI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, jsonMode: true }),
        })
            .then(async r => {
                const text = await r.text();
                try {
                    return JSON.parse(text);
                } catch {
                    throw new Error('Invalid response from AI server. Check API key in Vercel env vars.');
                }
            })
            .then(data => {
                if (data.error) throw new Error(data.error);
                let rawJson = data.result || '';
                
                // Safely extract JSON from markdown if Gemini included conversational text
                const jsonMatch = rawJson.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
                if (jsonMatch) {
                    rawJson = jsonMatch[1];
                } else {
                    rawJson = rawJson.replace(/^```(json)?/mi, '').replace(/```$/m, '').trim();
                }

                const parsed = JSON.parse(rawJson);
                if (parsed.cards && parsed.cards.length === 4) {
                    setCards(parsed.cards);
                    sessionStorage.setItem(cacheKey, JSON.stringify(parsed.cards));
                    sessionStorage.setItem(cacheTime, Date.now().toString());
                }
            })
            .catch(err => {
                setError(err.message);
            })
            .finally(() => setLoading(false));
    }, []);

    const card = cards[active];
    const cfg = STATUS_CONFIG[card?.status] || STATUS_CONFIG.info;

    return (
        <div className="ai-carousel-wrapper">
            <div className="ai-carousel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>✨</span>
                    <span style={{ fontWeight: '700', fontSize: '0.85rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>AI Intelligence</span>
                    {loading && <span className="ai-pulse-dot" />}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    {cards.map((_, i) => (
                        <button
                            key={i}
                            className={`ai-dot ${i === active ? 'active' : ''}`}
                            onClick={() => { setActive(i); clearInterval(timerRef.current); }}
                        />
                    ))}
                </div>
            </div>

            <div className="ai-carousel-card" style={{ borderLeft: `4px solid ${cfg.border}`, background: cfg.bg }}>
                <div className="ai-card-top">
                    <span className="ai-card-icon">{card?.icon}</span>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span className="ai-card-title">{card?.title}</span>
                            <span className="ai-status-badge" style={{ background: cfg.color, color: '#fff' }}>{cfg.label}</span>
                        </div>
                        <p className="ai-card-headline" style={{ color: cfg.color }}>{card?.headline}</p>
                    </div>
                </div>
                <p className="ai-card-detail">{card?.detail}</p>
                {error && <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.5rem' }}>⚠️ AI error: {error}</p>}
            </div>

            <div className="ai-progress-bar">
                <div className="ai-progress-fill" key={active} style={{ background: cfg.color }} />
            </div>
        </div>
    );
}
