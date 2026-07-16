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
  payment_intent_id?: string; // for payment intents
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
    // Load Lean SDK if not already present
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
      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
    >
      {loading ? 'Connecting...' : 'Connect Bank Account'}
    </button>
  );
};

export default LeanConnect;
