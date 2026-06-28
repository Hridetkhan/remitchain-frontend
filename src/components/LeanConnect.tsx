// frontend/src/components/LeanConnect.tsx
import React, { useState, useEffect, useRef } from 'react';
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
    const callbackRegistered = useRef(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // ============================================================
    // 1. REGISTER LEAN CALLBACK ONCE
    // ============================================================
    useEffect(() => {
        if (!callbackRegistered.current && window.Lean) {
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
                    onError(response.message || 'Failed');
                } else if (response.status === 'CANCEL') {
                    setStatus('⏹️ Cancelled');
                    onError('Cancelled');
                }
            };
            callbackRegistered.current = true;
        }
    }, [onSuccess, onError]);

    // ============================================================
    // 2. REAL FLOW (LinkSDK - Uses cloud backend)
    // ============================================================
    const handleRealConnect = async () => {
        if (loading) return;
        setLoading(true);
        setStatus('🔐 Getting customer token...');

        try {
            // ✅ FIX: Uses API_URL from App.tsx (Render URL, not localhost)
            const tokenRes = await axios.get(`${API_URL}/api/lean/customer-token`, {
                params: { customerId }
            });

            if (!tokenRes.data.success) {
                throw new Error(tokenRes.data.error || 'Customer token failed');
            }

            const customerToken = tokenRes.data.customerToken;
            const appToken = '730a9f67-7149-49e5-988d-30200b8fa695';

            window.Lean.connect({
                access_token: customerToken,
                app_token: appToken,
                customer_id: customerId,
                permissions: ['identity', 'accounts', 'balance', 'transactions'],
                sandbox: true,
                debug: true
            });

            setStatus('🔄 Waiting for bank authorization...');

            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                setLoading(false);
                setStatus('⏰ Real connection timed out. Use "Manual" instead.');
                console.warn('⏰ Lean callback not received after 30s.');
            }, 30000);

        } catch (error: any) {
            const msg = error.response?.data?.error || error.message || 'Connection failed';
            setStatus('❌ Error: ' + msg);
            onError(msg);
            setLoading(false);
        }
    };

    // ============================================================
    // 3. MANUAL FLOW (Skip Lean - Demo Mode)
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
    // 4. CANCEL
    // ============================================================
    const handleCancel = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        setStatus('⏹️ Cancelled');
        setLoading(false);
        onError('Cancelled');
    };

    // ============================================================
    // 5. RENDER
    // ============================================================
    return (
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
                    {loading ? '⏳ Connecting...' : '🔗 Connect Bank Account (Real)'}
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
    );
};

export default LeanConnect;
