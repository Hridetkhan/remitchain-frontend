// frontend/src/components/LeanConnect.tsx
import React, { useState, useEffect } from 'react';

interface LeanConnectProps {
  customerId: string;
  onSuccess: (entityId: string) => void;
  onError: (error: string) => void;
}

// Config for bank connection (connect)
interface LeanConnectConfig {
  customer_id?: string;
  app_token?: string;
  access_token?: string;
  permissions?: string[];
  sandbox?: boolean;
  debug?: boolean;
  payment_intent_id?: string;
  show_consent_explanation?: boolean;
  success_redirect_url?: string;
  fail_redirect_url?: string;
  callback: (response: any) => void;
}

// Config for one‑off payment (pay)
interface LeanPayConfig {
  payment_intent_id: string;
  customer_id: string;
  app_token: string;
  access_token: string;
  callback: (response: any) => void;
}

declare global {
  interface Window {
    LeanV2: {
      connect: (config: LeanConnectConfig) => void;
      pay: (config: LeanPayConfig) => void;
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

      window.LeanV2.connect({
        customer_id: customerId,
        app_token: appToken,
        access_token: token,
        permissions: ['identity', 'accounts', 'balance', 'transactions', 'payments'],
        sandbox: true,
        debug: true,
        show_consent_explanation: true,
        callback: (response: any) => {
          console.log('📨 Lean V2 callback received:', response);
          if (response.status === 'SUCCESS') {
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
      script.onload = () => console.log('Lean SDK loaded');
      document.head.appendChild(script);
    }
  }, []);

  return (
    <button
      onClick={openLeanConnect}
      disabled={loading}
      style={{
        width: '100%',
        padding: '14px',
        background: loading ? '#a0aec0' : 'linear-gradient(135deg, #dc2626, #b91c1c)',
        color: '#ffffff',
        border: 'none',
        borderRadius: '10px',
        fontSize: '16px',
        fontWeight: '700',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)'
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(220, 38, 38, 0.5)';
          e.currentTarget.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
        }
      }}
      onMouseLeave={(e) => {
        if (!loading) {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.4)';
          e.currentTarget.style.background = 'linear-gradient(135deg, #dc2626, #b91c1c)';
        }
      }}
    >
      {loading ? '⏳ Connecting...' : '🔗 Connect Bank Account'}
    </button>
  );
};

export default LeanConnect;
