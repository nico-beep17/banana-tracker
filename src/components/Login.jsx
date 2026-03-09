import React, { useState } from 'react';
import './Login.css';
import { supabase } from '../supabaseClient';

const ROLES = [
    'Admin / Developer',
    'Production Manager',
    'Quality Manager',
    'Production Supervisor',
    'Quality Supervisor',
    'Hub Receiver',
    'Hub Operations In-Charge',
    'Driver',
    'Helper',
    'Logistics Supervisor',
    'Shipping Documentation Supervisor',
    'HR Admin Supervisor',
    'Accounting Staff'
];

const Login = ({ onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
        role: ROLES[0],
        department: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        try {
            if (isLogin) {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: formData.password,
                });
                if (error) throw error;
                if (data.user) {
                    onLoginSuccess(data.user);
                }
            } else {
                // Sign Up Flow
                const { data, error } = await supabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            full_name: formData.fullName,
                            role: formData.role,
                            department: formData.department
                        }
                    }
                });
                if (error) throw error;
                if (data.user) {
                    // Since we handle profile creation immediately in App.jsx or via Trigger
                    onLoginSuccess(data.user);
                }
            }
        } catch (error) {
            setErrorMsg(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBypass = () => {
        // Mock a superuser for development bypass
        const mockUser = {
            id: '00000000-0000-0000-0000-000000000000',
            email: 'dev@lavc.com',
            user_metadata: {
                full_name: 'Developer Admin',
                role: 'Admin / Developer',
                department: 'Engineering'
            }
        };
        onLoginSuccess(mockUser);
    };

    return (
        <div className="login-container">
            <div className="login-card glass-panel animation-fade-in">
                <div className="login-header">
                    <img src="https://raw.githubusercontent.com/antigravity/banana-tracker/main/public/logo.png" alt="LAVC Operations" onError={(e) => e.target.style.display = 'none'} className="login-logo" />
                    <h2>LAVC Operations Hub</h2>
                    <p>{isLogin ? 'Sign in to access your dashboard' : 'Register a new employee account'}</p>
                </div>

                {errorMsg && <div className="login-error">{errorMsg}</div>}

                <form onSubmit={handleSubmit} className="login-form">
                    {!isLogin && (
                        <>
                            <div className="form-group">
                                <label className="label">Full Name</label>
                                <input type="text" name="fullName" className="input-field" required={!isLogin} value={formData.fullName} onChange={handleChange} placeholder="e.g. John Doe" />
                            </div>
                            <div className="form-group">
                                <label className="label">Access Role</label>
                                <select name="role" className="input-field" value={formData.role} onChange={handleChange} required={!isLogin}>
                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="label">Department (Optional)</label>
                                <input type="text" name="department" className="input-field" value={formData.department} onChange={handleChange} placeholder="e.g. Quality Assurance" />
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label className="label">Email Address</label>
                        <input type="email" name="email" className="input-field" required value={formData.email} onChange={handleChange} placeholder="employee@lavc.com" />
                    </div>

                    <div className="form-group">
                        <label className="label">Password</label>
                        <input type="password" name="password" className="input-field" required value={formData.password} onChange={handleChange} placeholder="••••••••" minLength={6} />
                    </div>

                    <button type="submit" className="btn-primary login-btn" disabled={loading}>
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>

                    <button type="button" className="btn-secondary" onClick={handleBypass} style={{ width: '100%', marginTop: '0.5rem', borderColor: '#f59e0b', color: '#d97706' }}>
                        Skip Login (Dev Bypass)
                    </button>
                </form>

                <div className="login-footer">
                    <p>
                        {isLogin ? "Don't have an account?" : "Already registered?"}
                        {' '}
                        <button type="button" className="text-link" onClick={() => setIsLogin(!isLogin)}>
                            {isLogin ? 'Sign Up' : 'Log In'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
