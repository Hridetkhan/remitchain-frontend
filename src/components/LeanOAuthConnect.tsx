// frontend/src/components/LeanOAuthConnect.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import queryString from 'query-string';

const API_URL = 'http://localhost:3001';

interface LeanOAuthConnectProps {
    customerId: string;
    onSuccess: (entityId: string) => void;
    onError: (error: string) => void;
}

const LeanOAuthConnect: React.FC<LeanOAuthConnectProps> = ({ customerId, onSuccess, onError }) => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string>('');

    // ===== Check if returning from OAuth flow =====
    useEffect(() => {
        const params = queryString.parse(window.location.search);
        if (params.code) {
            console.log('🔑 OAuth code received:', params.code);
            // Clear the URL parameters
            window.history.replaceState({}, document.title, window.location.pathname);
            handleOAuthCallback(params.code as string);
        }
    }, []);

    const handleOAuthCallback = async (code: string) => {
        setLoading(true);
        setStatus('🔄 Exchanging code for token...');

        try {
            const response = await axios.post(`${API_URL}/api/lean/oauth/callback`, {
                code: code,
                customerId: customerId
            });

            if (response.data.success) {
                setStatus('✅ Bank connected successfully!');
                onSuccess(response.data.entityId || 'success');
            } else {
                setStatus('❌ Failed to connect bank: ' + response.data.error);
                onError(response.data.error || 'Failed to connect bank');
            }
        } catch (error: any) {
            console.error('❌ OAuth callback error:', error);
            setStatus('❌ Error: ' + error.message);
            onError(error.message || 'Failed to complete OAuth flow');
        } finally {
            setLoading(false);
        }
    };

    const handleConnect = () => {
        setLoading(true);
        setStatus('🔐 Redirecting to Lean...');

        // ============================================================
        // 🔥 CRITICAL: This must match EXACTLY what's in Lean Dashboard
        // ============================================================
        const redirectUri = 'http://localhost:3000';   // NO trailing slash!

        // Your sandbox client ID (from Lean Dashboard → Integration)
        const clientId = '730a9f67-7149-49e5-988d-30200b8fa695';

        // Scopes (permissions you're requesting)
        const scope = 'identity accounts balance transactions';

        // Build the OAuth URL
        const oauthUrl =
            `https://auth.sandbox.leantech.me/oauth2/authorize?` +
            `client_id=${clientId}` +
            `&response_type=code` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&scope=${encodeURIComponent(scope)}` +
            `&state=${customerId}`;

        console.log('🔄 Redirecting to Lean OAuth...');
        console.log('   redirect_uri:', redirectUri);
        console.log('   Full URL:', oauthUrl);

        // Store customer ID for after redirect
        sessionStorage.setItem('lean_customer_id', customerId);

        // Redirect to Lean
        window.location.href = oauthUrl;
    };

    return (
        <div className="lean-connect">
            <button
                onClick={handleConnect}
                disabled={loading}
                className="btn-connect"
                style={{
                    width: '100%',
                    padding: '12px',
                    background: loading ? '#a0aec0' : 'linear-gradient(135deg, #006a4e, #00875a)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '10px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s'
                }}
            >
                {loading ? '⏳ Connecting...' : '🔗 Connect Bank Account (OAuth)'}
            </button>
            {status && (
                <p style={{
                    marginTop: 8,
                    fontSize: 13,
                    color: status.includes('✅') ? '#22543d' : status.includes('❌') ? '#9b2c2c' : '#2b6cb0'
                }}>
                    {status}
                </p>
            )}
        </div>
    );
};

export default LeanOAuthConnect;