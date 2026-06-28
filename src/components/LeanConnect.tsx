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
                } else {
                    setStatus('⚠️ Unknown response: ' + JSON.stringify(response));
                    onError('Unexpected response');
                }
            };
            callbackRegistered.current = true;
        }

        // Cleanup on unmount
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [onSuccess, onError]);

    // ============================================================
    // 2. FORCE RELOAD LEAN SDK (If it didn't load)
    // ============================================================
    const reloadLeanSDK = () => {
        setStatus('🔄 Reloading Lean SDK...');
        
        // Remove existing Lean script if any
        const existingScript = document.querySelector('script[src*="leantech.me"]');
        if (existingScript) {
            existingScript.remove();
        }
        
        // Create and load new script
        const script = document.createElement('script');
        script.src = 'https://cdn.leantech.me/link/ae/sandbox/latest/lean-link-sdk.min.js';
        script.onload = () => {
            console.log('✅ Lean SDK reloaded successfully.');
            setStatus('✅ Lean SDK reloaded. Please try connecting again.');
            // Re-register callback
            if (window.Lean) {
                window.Lean.callback = (response: any) => {
                    console.log('📨 Lean callback received (after reload):', response);
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
        };
        script.onerror = () => {
            setStatus('❌ Failed to reload Lean SDK. Please refresh the page.');
        };
        document.head.appendChild(script);
    };

    // ============================================================
    // 3. CHECK IF LEAN SDK IS LOADED
    // ============================================================
    const isLeanSDKLoaded = (): boolean => {
        return window.Lean && typeof window.Lean.connect === 'function';
    };

    // ============================================================
    // 4. REAL FLOW (LinkSDK - Uses cloud backend)
    // ============================================================
    const handleRealConnect = async () => {
        if (loading) return;

        // ✅ SAFETY CHECK: Ensure Lean SDK is loaded
        if (!isLeanSDKLoaded()) {
            setStatus('❌ Lean SDK not loaded. Click "Reload Lean SDK" and try again.');
            onError('Lean SDK not loaded');
            return;
        }

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

            console.log('✅ Customer token received');

            window.Lean.connect({
                access_token: customerToken,
                app_token: appToken,
                customer_id: customerId,
                permissions: ['identity', 'accounts', 'balance', 'transactions'],
                sandbox: true,
                debug: true
            });

            setStatus('🔄 Waiting for bank authorization...');
            console.log('✅ Lean.connect() called, waiting for callback...');

            // Set timeout for fallback
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                setLoading(false);
                setStatus('⏰ Real connection timed out. Use "Manual" or try again.');
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
    // 5. MANUAL FLOW (Skip Lean - Demo Mode)
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
        setStatus('⏹️ Cancelled');
        setLoading(false);
        onError('Cancelled');
    };

    // ============================================================
    // 7. RENDER
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

            {/* Reload Lean SDK button */}
            <button
                onClick={reloadLeanSDK}
                style={{
                    marginTop: 8,
                    padding: '8px 16px',
                    background: '#4299e1',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    width: '100%',
                }}
            >
                🔄 Reload Lean SDK (if stuck)
            </button>

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
