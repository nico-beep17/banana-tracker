import React, { useState, useRef, useEffect } from 'react';

const OVERRIDE_PIN = '1234';

const PinVerifyModal = ({ isOpen, onClose, onVerified, actionLabel = 'Override' }) => {
    const [pin, setPin] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');
    const [shake, setShake] = useState(false);
    const pinRef = useRef(null);

    useEffect(() => {
        if (isOpen && pinRef.current) {
            setTimeout(() => pinRef.current?.focus(), 100);
        }
        if (isOpen) {
            setPin('');
            setFullName('');
            setError('');
            setShake(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!fullName.trim()) {
            setError('Full name is required.');
            return;
        }
        if (fullName.trim().split(/\s+/).length < 2) {
            setError('Please enter your full name (first and last).');
            return;
        }
        if (pin !== OVERRIDE_PIN) {
            setError('Invalid PIN. Access denied.');
            setShake(true);
            setTimeout(() => setShake(false), 600);
            setPin('');
            return;
        }

        onVerified({ operatorName: fullName.trim().toUpperCase() });
        setPin('');
        setFullName('');
        setError('');
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10001, backdropFilter: 'blur(6px)',
            animation: 'fadeIn 0.2s ease'
        }}>
            <div
                className={`card animation-fade-in ${shake ? 'shake-animation' : ''}`}
                style={{
                    padding: '2rem', maxWidth: '420px', width: '92%',
                    position: 'relative',
                    boxShadow: '0 25px 60px -12px rgba(0,0,0,0.5)',
                    borderTop: '4px solid #dc2626',
                    borderRadius: '12px'
                }}
            >
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{
                        width: '56px', height: '56px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #fef2f2, #fee2e2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 0.75rem', fontSize: '1.5rem',
                        border: '2px solid #fca5a5'
                    }}>🔒</div>
                    <h3 style={{ margin: 0, color: '#dc2626', fontSize: '1.15rem', fontWeight: '800' }}>
                        Security Override Required
                    </h3>
                    <p style={{ margin: '0.4rem 0 0', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                        Enter your PIN and full name to <strong>{actionLabel.toLowerCase()}</strong> this record.
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Full Name */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={{
                            display: 'block', fontSize: '0.8rem', fontWeight: '700',
                            color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>Full Name</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => { setFullName(e.target.value); setError(''); }}
                            placeholder="e.g. Juan Dela Cruz"
                            className="input-field"
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                padding: '0.7rem 0.85rem', fontSize: '0.95rem',
                                border: '2px solid #e2e8f0', borderRadius: '8px',
                                transition: 'border-color 0.2s ease'
                            }}
                            autoComplete="off"
                        />
                    </div>

                    {/* PIN */}
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{
                            display: 'block', fontSize: '0.8rem', fontWeight: '700',
                            color: 'var(--text-secondary)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>Override PIN</label>
                        <input
                            ref={pinRef}
                            type="password"
                            maxLength={4}
                            value={pin}
                            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                            placeholder="••••"
                            className="input-field"
                            style={{
                                width: '100%', boxSizing: 'border-box',
                                padding: '0.7rem 0.85rem', fontSize: '1.5rem',
                                textAlign: 'center', letterSpacing: '0.75rem',
                                border: error ? '2px solid #dc2626' : '2px solid #e2e8f0',
                                borderRadius: '8px',
                                transition: 'border-color 0.2s ease',
                                fontFamily: 'monospace'
                            }}
                            inputMode="numeric"
                            autoComplete="off"
                        />
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626',
                            padding: '0.5rem 0.75rem', borderRadius: '6px', fontSize: '0.82rem',
                            fontWeight: '600', marginBottom: '1rem', textAlign: 'center'
                        }}>
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Buttons */}
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary"
                            style={{ flex: 1, padding: '0.65rem', borderRadius: '8px' }}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            style={{
                                flex: 1, padding: '0.65rem', borderRadius: '8px',
                                background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                                color: 'white', border: 'none', cursor: 'pointer',
                                fontWeight: '700', fontSize: '0.9rem',
                                transition: 'opacity 0.2s ease',
                                opacity: (pin.length === 4 && fullName.trim()) ? 1 : 0.6
                            }}
                            disabled={pin.length < 4 || !fullName.trim()}
                        >
                            🔓 {actionLabel}
                        </button>
                    </div>
                </form>

                {/* Close X */}
                <button
                    onClick={onClose}
                    style={{
                        position: 'absolute', top: '12px', right: '14px',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '1.3rem', color: 'var(--text-tertiary)', lineHeight: 1
                    }}
                >×</button>
            </div>

            {/* Inline keyframes for shake and fade */}
            <style>{`
                @keyframes shakeAnim {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
                    20%, 40%, 60%, 80% { transform: translateX(6px); }
                }
                .shake-animation {
                    animation: shakeAnim 0.5s ease-in-out !important;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default PinVerifyModal;
