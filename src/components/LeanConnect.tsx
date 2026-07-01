// frontend/src/components/LeanConnect.tsx
import React, { useState, useEffect } from 'react';

interface LeanConnectProps {
  customerId: string; // Should match the one used on the backend
  onSuccess: (entityId?: string) => void;
  onError: (error: string) => void;
}

declare global {
  interface Window {
    LeanV2: {
      connect: (config: {
        customer_id: string;
        app_token: string;
        access_token: string;
        permissions: string[];
        sandbox: boolean;
        debug: boolean;
        callback: (response: any) => void;
      }) => void;
    };
  }
}

const LeanConnect: React.FC<LeanConnectProps> = ({ customerId, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [customerToken, setCustomerToken] = useState<string | null>(null);

  // 1. Fetch the customer token from your backend
  const fetchCustomerToken = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/lean/customer-token?customerId=${customerId}`
      );
      const data = await response.json();
      if (data.success) {
        setCustomerToken(data.customerToken);
        return data.customerToken;
      } else {
        throw new Error(data.error || 'Failed to get token');
      }
    } catch (err: any) {
      onError(err.message);
      return null;
    }
  };

  // 2. Open Lean LinkSDK when we have the token
  const openLeanConnect = async () => {
    setLoading(true);
    try {
      const token = await fetchCustomerToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const appToken = process.env.REACT_APP_LEAN_APP_TOKEN || '730a9f67-7149-49e5-988d-30200b8fa695';

      // ✅ CRITICAL: Include 'payments' in permissions
      window.LeanV2.connect({
        customer_id: customerId,
        app_token: appToken,
        access_token: token,
        permissions: ['identity', 'accounts', 'balance', 'transactions', 'payments'], // <-- ADDED 'payments'
        sandbox: true,
        debug: true,
        callback: (response: any) => {
          console.log('📨 Lean V2 callback received:', response);
          if (response.status === 'SUCCESS') {
            // Payment Source is automatically created by Lean thanks to 'payments' permission
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
    // Load Lean SDK script if not already loaded
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
