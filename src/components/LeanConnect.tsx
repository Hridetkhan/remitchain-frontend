// frontend/src/components/LeanConnect.tsx
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../App';

declare global {
    interface Window {
        Lean: any;
    }
}

interface LeanConnectProps {
    customerId: string;
    onSuccess: (entityId: string) => void;
    onError: (error: string) => void;
}

const LeanConnect: React.FC<LeanConnectProps> = ({ customerId, onSuccess, onError }) => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [showMockModal, setShowMockModal] = useState(false);
    const [mockBankSelected, setMockBankSelected] = useState<string>('');
    const [mockUsername, setMockUsername] = useState('');
    const [mockPassword, setMockPassword] = useState('');
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const callbackRegistered = useRef(false);

    // ============================================================
    // 1. REGISTER LEAN CALLBACK (if Lean SDK is loaded)
    // ============================================================
    useEffect(() => {
        if (!callbackRegistered.current && window.Lean && typeof window.Lean.callback === 'function') {
            console.log('🔄 Registering Lean callback...');
            window.Lean.callback = (response: any) => {
                console.log('📨 Lean callback received:', response);
                setLoading(false);
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
                if (response.status === 'SUCCESS') {
                    setStatus('✅ Bank connected successfully!');
                    onSuccess(response.entity_id || 'success');
                } else if (response.status === 'ERROR') {
                    setStatus('❌ Error: ' + response.message);
                    setLoading(false);
                    // Open mock modal as fallback
                    openMockModal();
                } else if (response.status === 'CANCEL') {
                    setStatus('⏹️ Cancelled');
                    onError('Cancelled');
                }
            };
            callbackRegistered.current = true;
        }
    }, []);

    // ============================================================
    // 2. OPEN MOCK MODAL (Fallback when Lean is blocked)
    // ============================================================
    const openMockModal = () => {
        setShowMockModal(true);
        setStatus('🔐 Please connect your bank (Mock Mode)');
        setLoading(false);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    // ============================================================
    // 3. HANDLE MOCK BANK CONNECTION
    // ============================================================
    const handleMockConnect = () => {
        if (!mockBankSelected) {
            setStatus('⚠️ Please select a bank');
            return;
        }
        if (!mockUsername || !mockPassword) {
            setStatus('⚠️ Please enter mock credentials');
            return;
        }

        setLoading(true);
        setStatus('🔄 Connecting to mock bank...');

        setTimeout(() => {
            setStatus('✅ Bank connected successfully! (Mock Mode)');
            setShowMockModal(false);
            setLoading(false);
            onSuccess('mock_entity_' + Date.now());
            setMockBankSelected('');
            setMockUsername('');
            setMockPassword('');
        }, 1500);
    };

    // ============================================================
    // 4. REAL LEAN CONNECTION (with sandbox: true)
    // ============================================================
    const handleRealConnect = async () => {
        if (loading) return;

        // ✅ Check if Lean SDK is loaded
        if (window.Lean && typeof window.Lean.connect === 'function') {
            // Lean SDK is loaded - try the real flow
            setLoading(true);
            setStatus('🔐 Getting customer token...');

            try {
                const tokenRes = await axios.get(`${API_URL}/api/lean/customer-token`, {
                    params: { customerId }
                });

                if (!tokenRes.data.success) {
                    throw new Error(tokenRes.data.error || 'Customer token failed');
                }

                const customerToken = tokenRes.data.customerToken;
                const appToken = '730a9f67-7149-49e5-988d-30200b8fa695';

                // ✅ CORRECT: sandbox mode is enabled via the sandbox parameter
                window.Lean.connect({
                    access_token: customerToken,
                    app_token: appToken,
                    customer_id: customerId,
                    permissions: ['identity', 'accounts', 'balance', 'transactions'],
                    sandbox: true,   // <-- This is the correct way to enable sandbox
                    debug: true
                });

                setStatus('🔄 Waiting for bank authorization...');

                // Set timeout for fallback
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => {
                    setLoading(false);
                    setStatus('⏰ Real connection timed out. Opening mock modal...');
                    openMockModal();
                }, 20000);

                // Register callback if not already registered
                if (!callbackRegistered.current) {
                    window.Lean.callback = (response: any) => {
                        console.log('📨 Lean callback received:', response);
                        setLoading(false);
                        if (timeoutRef.current) {
                            clearTimeout(timeoutRef.current);
                            timeoutRef.current = null;
                        }
                        if (response.status === 'SUCCESS') {
                            setStatus('✅ Bank connected successfully!');
                            onSuccess(response.entity_id || 'success');
                        } else if (response.status === 'ERROR') {
                            setStatus('❌ Error: ' + response.message);
                            setLoading(false);
                            openMockModal();
                        } else if (response.status === 'CANCEL') {
                            setStatus('⏹️ Cancelled');
                            onError('Cancelled');
                        }
                    };
                    callbackRegistered.current = true;
                }

            } catch (error: any) {
                const msg = error.response?.data?.error || error.message || 'Connection failed';
                setStatus('⚠️ ' + msg + '. Opening mock modal...');
                setLoading(false);
                openMockModal();
            }
        } else {
            // Lean SDK not loaded - go straight to mock modal
            console.warn('⚠️ Lean SDK not loaded. Using mock modal.');
            openMockModal();
        }
    };

    // ============================================================
    // 5. MANUAL FLOW (Skip everything - Demo Mode)
    // ============================================================
    const handleManualConnect = () => {
        if (loading) return;
        setStatus('✅ Bank connected manually (demo mode)');
        onSuccess('manual_entity');
        setLoading(false);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    // ============================================================
    // 6. CANCEL
    // ============================================================
    const handleCancel = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setShowMockModal(false);
        setStatus('⏹️ Cancelled');
        setLoading(false);
        onError('Cancelled');
    };

    // ============================================================
    // 7. RENDER
    // ============================================================
    return (
        <>
            <div className="lean-connect" style={{ marginTop: 8 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <button
                        onClick={handleRealConnect}
                        disabled={loading}
                        className="btn-connect"
                        style={{
                            flex: 1,
                            padding: '12px',
                            background: loading ? '#a0aec0' : 'linear-gradient(135deg, #006a4e, #00875a)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '16px',
                            fontWeight: '600',
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {loading ? '⏳ Connecting...' : '🔗 Connect Bank Account'}
                    </button>
                    <button
                        onClick={handleManualConnect}
                        disabled={loading}
                        style={{
                            padding: '12px 20px',
                            background: loading ? '#a0aec0' : '#ed8936',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '10px',
                            fontSize: '16px',
                            fontWeight: '600',
                            cursor: loading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        ⚡ Manual (Demo)
                    </button>
                </div>

                {status && (
                    <p
                        style={{
                            marginTop: 8,
                            fontSize: 13,
                            color: status.includes('✅')
                                ? '#22543d'
                                : status.includes('❌') || status.includes('⏰')
                                ? '#9b2c2c'
                                : '#2b6cb0',
                        }}
                    >
                        {status}
                    </p>
                )}

                {loading && (
                    <button
                        onClick={handleCancel}
                        style={{
                            marginTop: 8,
                            padding: '6px 16px',
                            background: '#e53e3e',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                        }}
                    >
                        Cancel
                    </button>
                )}
            </div>

            {/* ============================================================ */}
            {/* MOCK LEAN MODAL (Fallback when Lean is blocked)               */}
            {/* ============================================================ */}
            {showMockModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 9999,
                        backdropFilter: 'blur(4px)',
                    }}
                    onClick={(e) => {
                        if (e.target === e.currentTarget) handleCancel();
                    }}
                >
                    <div
                        style={{
                            background: '#fff',
                            borderRadius: '16px',
                            padding: '32px',
                            maxWidth: '480px',
                            width: '90%',
                            maxHeight: '90vh',
                            overflowY: 'auto',
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                            fontFamily: 'sans-serif',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{ marginTop: 0, color: '#1a202c' }}>🏦 Connect Bank Account (Mock)</h2>
                        <p style={{ fontSize: '14px', color: '#718096', marginBottom: '20px' }}>
                            This is a mock version of the Lean bank connection modal.
                            <br />
                            <strong>Use any credentials to connect.</strong>
                        </p>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                                Select Bank
                            </label>
                            <select
                                value={mockBankSelected}
                                onChange={(e) => setMockBankSelected(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                }}
                            >
                                <option value="">Select a bank</option>
                                <option value="LEANMB1">Lean Mockbank One</option>
                                <option value="LEANMB2">Lean Mockbank Two</option>
                                <option value="LEANMB3">Lean Mockbank Three</option>
                            </select>
                        </div>

                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                                Username
                            </label>
                            <input
                                type="text"
                                value={mockUsername}
                                onChange={(e) => setMockUsername(e.target.value)}
                                placeholder="Enter any username"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                                Password
                            </label>
                            <input
                                type="password"
                                value={mockPassword}
                                onChange={(e) => setMockPassword(e.target.value)}
                                placeholder="Enter any password"
                                style={{
                                    width: '100%',
                                    padding: '10px',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: '14px',
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                                onClick={handleMockConnect}
                                style={{
                                    flex: 1,
                                    padding: '12px',
                                    background: 'linear-gradient(135deg, #006a4e, #00875a)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                }}
                            >
                                Connect Bank
                            </button>
                            <button
                                onClick={handleCancel}
                                style={{
                                    padding: '12px 20px',
                                    background: '#e53e3e',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontSize: '16px',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                        </div>

                        <p style={{ fontSize: '11px', color: '#a0aec0', textAlign: 'center', marginTop: '16px' }}>
                            Mock mode - Bypasses Lean's CDN block
                        </p>
                    </div>
                </div>
            )}
        </>
    );
};

export default LeanConnect;
