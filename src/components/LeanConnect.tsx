// frontend/src/components/LeanConnect.tsx
import React, { useState, useEffect } from 'react';

interface LeanConnectProps {
  customerId: string;
  onSuccess: (entityId: string) => void;
  onError: (error: string) => void;
}

declare global {
  interface Window {
    LeanV2: {
      connect: (config: any) => void;
    };
  }
}

const LeanConnect: React.FC<LeanConnectProps> = ({ customerId, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);

  const fetchCustomerToken = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/lean/customer-token?customerId=${customerId}`
      );
      const data = await response.json();
      if (data.success) return data.customerToken;
      throw new Error(data.error || 'Failed to get token');
    } catch (err: any) {
      onError(err.message);
      return null;
    }
  };

  const openLeanConnect = async () => {
    setLoading(true);
    try {
      const token = await fetchCustomerToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const appToken = process.env.REACT_APP_LEAN_APP_TOKEN || '730a9f67-7149-49e5-988d-30200b8fa695';

      console.log('🔑 Opening Lean LinkSDK with permissions:', [
        'identity', 'accounts', 'balance', 'transactions', 'payments'
      ]);

      window.LeanV2.connect({
        customer_id: customerId,
        app_token: appToken,
        access_token: token,
        permissions: ['identity', 'accounts', 'balance', 'transactions', 'payments'], // ✅ CRITICAL
        sandbox: true,
        debug: true,
        callback: (response: any) => {
          console.log('📨 Lean callback:', response);
          if (response.status === 'SUCCESS') {
            // Optionally, you can call a backend endpoint to confirm PS creation
            onSuccess(response.entity_id || 'success');
          } else if (response.status === 'CANCELLED') {
            onError('User cancelled the connection.');
          } else {
            onError(`Lean error: ${response.error || 'Unknown error'}`);
          }
          setLoading(false);
        },
      });
    } catch (err: any) {
      onError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!document.querySelector('script[src*="leantech.me/link/sdk"]')) {
      const script = document.createElement('script');
      script.src = 'https://cdn.leantech.me/link/sdk/web/v2/prod/ae/latest/Lean.min.js';
      script.async = true;
      script.onload = () => console.log('✅ Lean SDK loaded');
      document.head.appendChild(script);
    }
  }, []);

  return (
    <button
      onClick={openLeanConnect}
      disabled={loading}
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
      }}
    >
      {loading ? '⏳ Connecting...' : '🔗 Connect Bank Account'}
    </button>
  );
};

export default LeanConnect;
