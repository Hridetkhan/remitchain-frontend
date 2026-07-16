// frontend/src/App.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './index.css';
import LeanConnect from './components/LeanConnect';

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';
console.log(`🔗 Backend API URL: ${API_URL}`);

axios.defaults.headers.common['ngrok-skip-browser-warning'] = 'true';

const CURRENCIES = {
    AED: { flag: '🇦🇪', name: 'UAE Dirham', symbol: 'د.إ' },
    USD: { flag: '🇺🇸', name: 'US Dollar', symbol: '$' },
    SAR: { flag: '🇸🇦', name: 'Saudi Riyal', symbol: 'ر.س' },
    GBP: { flag: '🇬🇧', name: 'British Pound', symbol: '£' },
    EUR: { flag: '🇪🇺', name: 'Euro', symbol: '€' },
    BDT: { flag: '🇧🇩', name: 'Bangladeshi Taka', symbol: '৳' }
};

interface FeeBreakdown {
    bdtAmount: number;
    totalFee: number;
    routeFee: number;
    operationFee: number;
    serviceFee: number;
    profit: number;
    receiverGetsBDT: number;
    receiverGetsAED: number;
}

interface Transaction {
    id: string;
    amount: number;
    currency: string;
    bdtAmount: number;
    receiver: string;
    totalFee: number;
    routeFee: number;
    operationFee: number;
    serviceFee: number;
    profit: number;
    receiverGetsBDT: number;
    receiverGetsAED: number;
    status: string;
    timestamp: string;
    txHash: string;
    fxRate: number;
}

interface Stats {
    totalTransactions: number;
    totalVolumeAED: number;
    totalVolumeBDT: number;
    totalFeeCollectedAED: number;
    totalProfitAED: number;
}

const App: React.FC = () => {
    const [amount, setAmount] = useState<string>('');
    const [receiver, setReceiver] = useState<string>('');
    const [currency, setCurrency] = useState<string>('AED');
    const [fxRate, setFxRate] = useState<number>(28.5);
    const [loading, setLoading] = useState<boolean>(false);
    const [status, setStatus] = useState<string>('');
    const [transactionId, setTransactionId] = useState<string | null>(null);
    const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdown | null>(null);
    const [ledger, setLedger] = useState<Transaction[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
    const [connected, setConnected] = useState<boolean>(false);
    const [liveRate, setLiveRate] = useState<number | null>(null);
    const [rateLoading, setRateLoading] = useState<boolean>(true);

    const [customerId, setCustomerId] = useState<string>('7c1453fd-4ad6-44b2-aed4-087f4822d069');
    const [leanStatus, setLeanStatus] = useState<string>('');
    const [isBankConnected, setIsBankConnected] = useState<boolean>(false);

    const fetchLiveRate = async () => {
        setRateLoading(true);
        try {
            const response = await axios.get(`${API_URL}/api/fx/rate`, {
                params: { base: currency, symbols: 'BDT' },
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            if (response.data.success && response.data.rate) {
                const rate = parseFloat(response.data.rate);
                if (rate && rate > 0) {
                    setLiveRate(rate);
                    setFxRate(rate);
                } else {
                    setLiveRate(28.5);
                    setFxRate(28.5);
                }
            } else {
                setLiveRate(28.5);
                setFxRate(28.5);
            }
        } catch (error) {
            console.log('FX API Error, using fallback rate:', error);
            setLiveRate(28.5);
            setFxRate(28.5);
        }
        setRateLoading(false);
    };

    useEffect(() => {
        fetchLiveRate();
        const interval = setInterval(fetchLiveRate, 60000);
        return () => clearInterval(interval);
    }, [currency]);

    useEffect(() => {
        checkHealth();
        fetchLedger();
        fetchStats();
        const interval = setInterval(fetchLedger, 10000);
        return () => clearInterval(interval);
    }, []);

    const checkHealth = async () => {
        try {
            const res = await axios.get<{ corda_connected: boolean }>(`${API_URL}/api/health`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            setConnected(res.data.corda_connected);
        } catch (err) {
            setConnected(false);
        }
    };

    const fetchLedger = async () => {
        try {
            const res = await axios.get<{ data: { states: Array<{ state: { data: Transaction } }> } }>(
                `${API_URL}/api/corda/vault`,
                { headers: { 'ngrok-skip-browser-warning': 'true' } }
            );
            const states = res.data.data.states || [];
            const transactions = states.map((item) => item.state.data);
            setLedger(transactions);
        } catch (err) {
            console.error('Failed to fetch ledger');
        }
    };

    const fetchStats = async () => {
        try {
            const res = await axios.get<{ data: Stats }>(`${API_URL}/api/corda/stats`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            setStats(res.data.data);
        } catch (err) {
            console.error('Failed to fetch stats');
        }
    };

    // ===== SEND MONEY – using Payment Intents (Open Finance) =====
    const handleSend = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!amount || !receiver || parseFloat(amount) <= 0) {
            setStatus('❌ Please enter a valid amount and receiver');
            return;
        }

        if (!isBankConnected) {
            setStatus('⚠️ Please connect your bank account first using the "Connect Bank Account" button below.');
            return;
        }

        setLoading(true);
        setStatus('⏳ Creating payment...');
        setFeeBreakdown(null);
        setTransactionId(null);

        try {
            // 1. Create Payment Intent
            const intentRes = await fetch(`${API_URL}/api/payment/intent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount: parseFloat(amount),
                    currency: currency,
                    customerId: customerId,
                    description: `RemitChain to ${receiver}`
                })
            });
            const intentData = await intentRes.json();
            if (!intentData.success) {
                setStatus(`❌ Failed to create payment: ${intentData.error}`);
                setLoading(false);
                return;
            }
            const paymentIntentId = intentData.paymentIntentId;
            console.log('✅ Payment Intent created:', paymentIntentId);

            // 2. Get customer token
            const tokenRes = await fetch(`${API_URL}/api/lean/customer-token?customerId=${customerId}`);
            const tokenData = await tokenRes.json();
            if (!tokenData.success) {
                setStatus('❌ Could not get customer token');
                setLoading(false);
                return;
            }
            const customerToken = tokenData.customerToken;
            const appToken = process.env.REACT_APP_LEAN_APP_TOKEN || '730a9f67-7149-49e5-988d-30200b8fa695';

            // 3. Launch Lean pay modal
            setStatus('🔐 Redirecting to your bank...');

            // ✅ Correct: Use .pay() with payment_intent_id
            window.LeanV2.pay({
                payment_intent_id: paymentIntentId,
                customer_id: customerId,
                app_token: appToken,
                access_token: customerToken,
                callback: (response: any) => {
                    console.log('📨 Lean pay callback:', response);
                    setLoading(false);
                    if (response.status === 'SUCCESS') {
                        setStatus('✅ Payment authorized! Settling on blockchain...');
                        // Call the legacy /api/send to simulate Corda settlement
                        settleTransaction(parseFloat(amount), currency, receiver, fxRate, customerId);
                    } else if (response.status === 'CANCELLED') {
                        setStatus('❌ Payment cancelled by user');
                    } else {
                        setStatus(`❌ Payment failed: ${response.error || 'Unknown error'}`);
                    }
                }
            });
        } catch (err: any) {
            setStatus(`❌ Error: ${err.message}`);
            setLoading(false);
        }
    };

    // Helper to simulate Corda settlement (still uses /api/send for demo)
    const settleTransaction = async (amount: number, currency: string, receiver: string, fxRate: number, customerId: string) => {
        try {
            const response = await axios.post(
                `${API_URL}/api/send`,
                { amount, currency, receiver, fxRate, customerId },
                { headers: { 'ngrok-skip-browser-warning': 'true' } }
            );
            if (response.data.success) {
                setTransactionId(response.data.transactionId);
                setFeeBreakdown(response.data.feeBreakdown);
                setStatus(`✅ Transaction confirmed! TX: ${response.data.transactionId}`);
                await fetchLedger();
                await fetchStats();
            } else {
                setStatus(`❌ Settlement failed: ${response.data.message}`);
            }
        } catch (err: any) {
            setStatus(`❌ Settlement error: ${err.message}`);
        }
    };

    const fetchTransaction = async (txId: string) => {
        try {
            const res = await axios.get<{ data: Transaction }>(`${API_URL}/api/corda/transaction/${txId}`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            setSelectedTx(res.data.data);
        } catch (err) {
            setSelectedTx(null);
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr || dateStr === 'Invalid Date') return 'Just now';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return 'Just now';
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleLeanSuccess = (entityId: string) => {
        setIsBankConnected(true);
        setLeanStatus(`✅ Bank connected successfully! Entity ID: ${entityId}`);
        setStatus('✅ Bank account connected! You can now send money.');
    };

    const handleLeanError = (error: string) => {
        setIsBankConnected(false);
        setLeanStatus(`❌ ${error}`);
        setStatus('❌ Bank connection failed. Please try again.');
    };

    return (
        <div className="app-container">
            <header className="bangladesh-header">
                <div className="header-bg-pattern"></div>
                <div className="header-content">
                    <div className="header-left">
                        <div className="header-brand">
                            <span className="brand-icon">💸</span>
                            <h1 className="brand-name">RemitChain</h1>
                            <span className="brand-badge">BETA</span>
                        </div>
                        <div className="header-flag">
                            <span className="flag-icon">🇧🇩</span>
                            <span className="flag-text">Bangladesh</span>
                        </div>
                    </div>
                    <div className="header-right">
                        <div className="rate-badge">
                            <span className="rate-badge-icon">📈</span>
                            <span className="rate-badge-text">
                                {rateLoading ? 'Loading...' : `1 ${currency} = ${liveRate?.toFixed(4)} BDT`}
                            </span>
                        </div>
                        <div className="status-badge">
                            <span className={`status-dot ${connected ? 'online' : 'offline'}`}></span>
                            <span className="status-text">
                                {connected ? 'Blockchain Connected' : 'Disconnected'}
                            </span>
                        </div>
                        <div className="status-badge">
                            <span className={`status-dot ${isBankConnected ? 'online' : 'offline'}`}></span>
                            <span className="status-text">
                                {isBankConnected ? 'Bank Connected' : 'Bank Not Connected'}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="header-tagline">
                    <span className="tagline-icon">🇧🇩</span>
                    <span className="tagline-text">Send Money to Bangladesh in Minutes</span>
                    <span className="tagline-features">⚡ Fast • 🔒 Secure • 📊 Transparent</span>
                </div>
            </header>

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-icon">📊</div>
                    <div className="stat-value">{stats?.totalTransactions || 0}</div>
                    <div className="stat-label">Total Transactions</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">💰</div>
                    <div className="stat-value">
                        {stats?.totalVolumeAED?.toFixed(0) || 0} AED
                    </div>
                    <div className="stat-label">Total Volume</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">🧾</div>
                    <div className="stat-value">
                        {stats?.totalFeeCollectedAED?.toFixed(2) || 0} AED
                    </div>
                    <div className="stat-label">Total Fees Collected</div>
                </div>
                <div className="stat-card stat-card-profit">
                    <div className="stat-icon">📈</div>
                    <div className="stat-value profit-value">
                        {stats?.totalProfitAED?.toFixed(2) || 0} AED
                    </div>
                    <div className="stat-label">Your Profit</div>
                </div>
            </div>

            <div className="main-grid">
                <div className="card send-card">
                    <h2 className="card-title">💸 Send Money</h2>
                    <div className="fee-badge">
                        <span className="fee-badge-icon">📌</span>
                        Total Fee: <strong>1.5%</strong>
                        <span className="fee-detail">(0.8% Route + 0.4% Ops + 0.3% Service)</span>
                    </div>

                    <form onSubmit={handleSend} className="send-form">
                        <div className="form-row">
                            <div className="form-group">
                                <label>Amount</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder="Enter amount"
                                    disabled={loading}
                                    min="1"
                                    step="1"
                                    className="form-input"
                                />
                            </div>
                            <div className="form-group">
                                <label>Currency</label>
                                <select
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    disabled={loading}
                                    className="form-select"
                                >
                                    {Object.entries(CURRENCIES).map(([code, info]) => (
                                        <option key={code} value={code}>
                                            {info.flag} {code} — {info.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Receiver bKash Number</label>
                            <input
                                type="text"
                                value={receiver}
                                onChange={(e) => setReceiver(e.target.value)}
                                placeholder="+8801712345678"
                                disabled={loading}
                                className="form-input"
                            />
                        </div>

                        <button type="submit" className="btn-send" disabled={loading || !isBankConnected}>
                            {loading ? '⏳ Processing...' : '🚀 Send Money'}
                        </button>
                    </form>

                    {status && (
                        <div className={`status-message ${status.includes('✅') ? 'success' : status.includes('⚠️') ? 'warning' : 'error'}`}>
                            {status}
                        </div>
                    )}

                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                        <LeanConnect
                            customerId={customerId}
                            onSuccess={handleLeanSuccess}
                            onError={handleLeanError}
                        />
                        {leanStatus && (
                            <p style={{
                                marginTop: 8,
                                fontSize: 13,
                                color: leanStatus.includes('✅') ? '#22543d' : '#9b2c2c'
                            }}>
                                {leanStatus}
                            </p>
                        )}
                        {isBankConnected && (
                            <p style={{ marginTop: 4, fontSize: 12, color: '#48bb78' }}>
                                ✅ Bank account connected — ready to send money!
                            </p>
                        )}
                    </div>

                    {feeBreakdown && (
                        <div className="fee-breakdown">
                            <h3 className="fee-title">Fee Breakdown</h3>
                            <div className="fee-grid">
                                <div className="fee-item">
                                    <span className="fee-label">Total Fee</span>
                                    <span className="fee-value">৳{feeBreakdown.totalFee.toFixed(2)}</span>
                                    <span className="fee-sub">(1.5%)</span>
                                </div>
                                <div className="fee-item route">
                                    <span className="fee-label">Route Fee</span>
                                    <span className="fee-value">৳{feeBreakdown.routeFee.toFixed(2)}</span>
                                    <span className="fee-sub">(0.8%)</span>
                                </div>
                                <div className="fee-item ops">
                                    <span className="fee-label">Operation Fee</span>
                                    <span className="fee-value">৳{feeBreakdown.operationFee.toFixed(2)}</span>
                                    <span className="fee-sub">(0.4%)</span>
                                </div>
                                <div className="fee-item service">
                                    <span className="fee-label">Service Fee</span>
                                    <span className="fee-value">৳{feeBreakdown.serviceFee.toFixed(2)}</span>
                                    <span className="fee-sub">(0.3%)</span>
                                </div>
                                <div className="fee-item profit">
                                    <span className="fee-label">Your Profit</span>
                                    <span className="fee-value profit">+৳{feeBreakdown.profit.toFixed(2)}</span>
                                    <span className="fee-sub">(0.3%)</span>
                                </div>
                            </div>
                            <div className="receiver-gets">
                                <span>Receiver Gets</span>
                                <span className="receiver-amount">
                                    ৳{feeBreakdown.receiverGetsBDT.toFixed(2)}
                                    <span className="receiver-amount-aed">
                                        ({feeBreakdown.receiverGetsAED.toFixed(2)} {currency})
                                    </span>
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="card ledger-card">
                    <h2 className="card-title">📊 Blockchain Ledger</h2>
                    <p className="ledger-count">{ledger.length} transactions recorded</p>

                    {ledger.length === 0 ? (
                        <div className="empty-state">
                            <span className="empty-icon">📭</span>
                            <p>No transactions yet. Send money to see it appear on the blockchain!</p>
                        </div>
                    ) : (
                        <div className="ledger-table-wrapper">
                            <table className="ledger-table">
                                <thead>
                                    <tr>
                                        <th>TX ID</th>
                                        <th>Amount</th>
                                        <th>Receiver</th>
                                        <th>Fee</th>
                                        <th>Status</th>
                                        <th>Time</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledger.map((item) => (
                                        <tr key={item.id}>
                                            <td><strong>{item.id}</strong></td>
                                            <td>{item.amount} {item.currency}</td>
                                            <td className="receiver-cell">{item.receiver}</td>
                                            <td>{(item.totalFee / (item.fxRate || 28.5)).toFixed(2)} {item.currency}</td>
                                            <td>
                                                <span className="badge badge-success">CONFIRMED</span>
                                            </td>
                                            <td className="time-cell">{formatDate(item.timestamp)}</td>
                                            <td>
                                                <button
                                                    className="btn-view"
                                                    onClick={() => fetchTransaction(item.id)}
                                                >
                                                    👁️ View
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {selectedTx && (
                        <div className="tx-modal-overlay" onClick={() => setSelectedTx(null)}>
                            <div className="tx-modal" onClick={(e) => e.stopPropagation()}>
                                <button className="modal-close" onClick={() => setSelectedTx(null)}>✕</button>
                                <h3>Transaction Details</h3>
                                <div className="tx-details">
                                    <div className="tx-row">
                                        <span className="tx-label">ID</span>
                                        <span className="tx-value">{selectedTx.id}</span>
                                    </div>
                                    <div className="tx-row">
                                        <span className="tx-label">Amount</span>
                                        <span className="tx-value">{selectedTx.amount} {selectedTx.currency}</span>
                                    </div>
                                    <div className="tx-row">
                                        <span className="tx-label">Receiver</span>
                                        <span className="tx-value">{selectedTx.receiver}</span>
                                    </div>
                                    <div className="tx-row">
                                        <span className="tx-label">Total Fee</span>
                                        <span className="tx-value">{(selectedTx.totalFee / (selectedTx.fxRate || 28.5)).toFixed(2)} {selectedTx.currency}</span>
                                    </div>
                                    <div className="tx-row">
                                        <span className="tx-label">Receiver Gets</span>
                                        <span className="tx-value receiver-amount-highlight">
                                            {(selectedTx.receiverGetsAED || 0).toFixed(2)} {selectedTx.currency}
                                        </span>
                                    </div>
                                    <div className="tx-row">
                                        <span className="tx-label">TX Hash</span>
                                        <span className="tx-value tx-hash">{selectedTx.txHash}</span>
                                    </div>
                                    <div className="tx-row">
                                        <span className="tx-label">Status</span>
                                        <span className="tx-value badge badge-success">{selectedTx.status}</span>
                                    </div>
                                    <div className="tx-row">
                                        <span className="tx-label">Timestamp</span>
                                        <span className="tx-value">{new Date(selectedTx.timestamp).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <footer className="footer">
                <p>© 2026 RemitChain — Built for the Bangladeshi Diaspora</p>
                <div className="footer-links">
                    <span>🇧🇩 Bangladesh</span>
                    <span>🇦🇪 UAE</span>
                    <span>🇸🇦 Saudi Arabia</span>
                    <span>🇬🇧 UK</span>
                    <span>🇺🇸 USA</span>
                </div>
            </footer>
        </div>
    );
};

export default App;
