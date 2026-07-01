// frontend/src/App.tsx
import React, { useState } from 'react';
import './App.css';
import LeanConnect from './components/LeanConnect';

// IMPORTANT: Use the same customerId everywhere
const CUSTOMER_ID = 'd1d8ea15-66ed-48f7-a54a-84b3be937517'; // or generate a new one

function App() {
  const [leanStatus, setLeanStatus] = useState<string>('');
  const [leanError, setLeanError] = useState<string>('');
  const [amount, setAmount] = useState<number>(100);
  const [receiver, setReceiver] = useState<string>('TestUser');
  const [txResult, setTxResult] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleLeanSuccess = (entityId: string) => {
    console.log('✅ Lean connected, entityId:', entityId);
    setLeanStatus(`✅ Bank connected! (Entity: ${entityId})`);
    setLeanError('');
  };

  const handleLeanError = (error: string) => {
    console.error('❌ Lean error:', error);
    setLeanError(`❌ ${error}`);
    setLeanStatus('');
  };

  const sendMoney = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTxResult(null);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          currency: 'AED',
          receiver,
          fxRate: 28.5,
          customerId: CUSTOMER_ID,
        }),
      });
      const data = await response.json();
      setTxResult(data);
      console.log('✅ Send response:', data);
    } catch (err) {
      console.error('❌ Send error:', err);
      setTxResult({ success: false, error: 'Send failed' });
    }
    setLoading(false);
  };

  return (
    <div className="App" style={{ maxWidth: 600, margin: '0 auto', padding: 20 }}>
      <h1>RemitChain</h1>
      <p>Cross-border payments on blockchain</p>

      {/* ===== LEAN CONNECT BUTTON ===== */}
      <div style={{ margin: '20px 0' }}>
        <LeanConnect
          customerId={CUSTOMER_ID}
          onSuccess={handleLeanSuccess}
          onError={handleLeanError}
        />
        {leanStatus && <p style={{ color: 'green' }}>{leanStatus}</p>}
        {leanError && <p style={{ color: 'red' }}>{leanError}</p>}
      </div>

      {/* ===== SEND MONEY FORM ===== */}
      <form onSubmit={sendMoney} style={{ marginTop: 30 }}>
        <h3>Send Money</h3>
        <div>
          <label>Amount (AED)</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            min={1}
            step={1}
            style={{ width: '100%', padding: 8, marginBottom: 10 }}
          />
        </div>
        <div>
          <label>Receiver</label>
          <input
            type="text"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 10 }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: 12,
            background: loading ? '#ccc' : '#006a4e',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 16,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Sending...' : 'Send Money'}
        </button>
      </form>

      {/* ===== TRANSACTION RESULT ===== */}
      {txResult && (
        <div style={{ marginTop: 20, padding: 16, background: '#f0f4f8', borderRadius: 8 }}>
          <h4>Transaction Result</h4>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {JSON.stringify(txResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;
