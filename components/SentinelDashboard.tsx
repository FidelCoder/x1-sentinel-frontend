'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  checkAddress,
  getChainConfig,
  getRecentReports,
  prepareReport,
  prepareResolve,
  prepareVote
} from '@/lib/api';
import { resolveReportOnchain, submitReportOnchain, voteOnReportOnchain } from '@/lib/registry';
import {
  connectWallet,
  ensureTargetNetwork,
  getCurrentAccount,
  getCurrentChainId,
  isWalletInstalled,
  subscribeWalletEvents
} from '@/lib/wallet';
import { ChainConfig, CheckResult, ReportReason, SafetyReport, TxStatus } from '@/types/safety';

const reasons: ReportReason[] = ['Phishing', 'Scam', 'RugPull', 'MaliciousContract', 'Spam', 'Other'];

const riskLabel = (score: number): string => {
  if (score >= 70) return 'High';
  if (score >= 40) return 'Medium';
  if (score > 0) return 'Low';
  return 'Clean';
};

const scoreTone = (score: number): 'high' | 'medium' | 'low' | 'clean' => {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  if (score > 0) return 'low';
  return 'clean';
};

const shortAddress = (value: string): string => {
  if (value.length < 12) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
};

const targetChainFromEnv = (): number => {
  const value = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 0);
  return Number.isFinite(value) ? value : 0;
};

const defaultTxStatus: TxStatus = {
  stage: 'idle',
  message: 'No transaction in progress'
};

export default function SentinelDashboard() {
  const [queryAddress, setQueryAddress] = useState('');
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [recentReports, setRecentReports] = useState<SafetyReport[]>([]);
  const [reportFeedError, setReportFeedError] = useState<string | null>(null);

  const [chainConfig, setChainConfig] = useState<ChainConfig | null>(null);
  const [chainConfigError, setChainConfigError] = useState<string | null>(null);

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [walletStatus, setWalletStatus] = useState<string | null>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);

  const [draftAddress, setDraftAddress] = useState('');
  const [draftNameTag, setDraftNameTag] = useState('');
  const [draftReason, setDraftReason] = useState<ReportReason>('Phishing');
  const [draftEvidence, setDraftEvidence] = useState('');
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [draftPayload, setDraftPayload] = useState<string>('');
  const [submittingDraft, setSubmittingDraft] = useState(false);
  const [submittingOnchain, setSubmittingOnchain] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>(defaultTxStatus);

  const setTx = (status: TxStatus): void => {
    setTxStatus(status);
  };

  const runCheckForAddress = async (address: string): Promise<void> => {
    if (!address.trim()) {
      return;
    }

    setChecking(true);
    setCheckError(null);

    try {
      const result = await checkAddress(address.trim());
      setCheckResult(result);
    } catch (error) {
      setCheckError(error instanceof Error ? error.message : 'Unable to run check');
      setCheckResult(null);
    } finally {
      setChecking(false);
    }
  };

  const refreshRecentReports = async (): Promise<void> => {
    try {
      const reports = await getRecentReports(6);
      setRecentReports(reports);
      setReportFeedError(null);
    } catch (error) {
      setReportFeedError(error instanceof Error ? error.message : 'Unable to refresh reports');
    }
  };

  const refreshAfterWrite = async (): Promise<void> => {
    await refreshRecentReports();
    if (queryAddress.trim()) {
      await runCheckForAddress(queryAddress.trim());
    }
  };

  useEffect(() => {
    const loadBootstrap = async (): Promise<void> => {
      try {
        const [reports, config] = await Promise.all([getRecentReports(6), getChainConfig()]);
        setRecentReports(reports);
        setChainConfig(config);
        setReportFeedError(null);
        setChainConfigError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load dashboard data';
        setReportFeedError(message);
        setChainConfigError(message);
      }

      try {
        const [account, chainId] = await Promise.all([getCurrentAccount(), getCurrentChainId()]);
        setWalletAddress(account);
        setWalletChainId(chainId);
      } catch {
        setWalletAddress(null);
      }
    };

    void loadBootstrap();

    return subscribeWalletEvents(
      (accounts) => {
        setWalletAddress(accounts[0] ?? null);
      },
      (chainHex) => {
        setWalletChainId(Number.parseInt(chainHex, 16));
      }
    );
  }, []);

  const runCheck = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    await runCheckForAddress(queryAddress);
  };

  const submitDraft = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    setSubmittingDraft(true);
    setDraftMessage(null);

    try {
      const payload = await prepareReport({
        targetAddress: draftAddress.trim(),
        nameTag: draftNameTag.trim(),
        reason: draftReason,
        evidence: draftEvidence.trim()
      });

      setDraftMessage(payload.message);
      setDraftPayload(JSON.stringify(payload, null, 2));
    } catch (error) {
      setDraftMessage(error instanceof Error ? error.message : 'Unable to prepare report payload');
      setDraftPayload('');
    } finally {
      setSubmittingDraft(false);
    }
  };

  const handleConnectWallet = async (): Promise<void> => {
    if (!isWalletInstalled()) {
      setWalletStatus('Wallet extension not found. Install MetaMask or another EVM wallet.');
      return;
    }

    setConnectingWallet(true);
    setWalletStatus(null);

    try {
      const account = await connectWallet();
      await ensureTargetNetwork(chainConfig ?? undefined);
      const chainId = await getCurrentChainId();
      setWalletAddress(account);
      setWalletChainId(chainId);
      setWalletStatus('Wallet connected.');
    } catch (error) {
      setWalletStatus(error instanceof Error ? error.message : 'Unable to connect wallet');
    } finally {
      setConnectingWallet(false);
    }
  };

  const resolveContractAddress = (): string => {
    const fromConfig = chainConfig?.contractAddress?.trim();
    const fromEnv = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS?.trim();
    const value = fromConfig || fromEnv;

    if (!value) {
      throw new Error('Contract address is missing. Set backend /api/config or NEXT_PUBLIC_CONTRACT_ADDRESS.');
    }

    return value;
  };

  const handleOnchainSubmit = async (): Promise<void> => {
    setSubmittingOnchain(true);
    setDraftMessage(null);

    try {
      if (!walletAddress) {
        throw new Error('Connect wallet before onchain submission.');
      }

      setTx({ stage: 'preparing', message: 'Preparing report transaction...' });
      const payload = await prepareReport({
        targetAddress: draftAddress.trim(),
        nameTag: draftNameTag.trim(),
        reason: draftReason,
        evidence: draftEvidence.trim()
      });

      await ensureTargetNetwork(chainConfig ?? undefined);

      setTx({ stage: 'awaiting_signature', message: 'Awaiting wallet signature...' });
      const tx = await submitReportOnchain({
        contractAddress: resolveContractAddress(),
        targetAddress: payload.params.targetAddress,
        nameTag: payload.params.nameTag,
        reasonCode: payload.params.reason,
        evidence: payload.params.evidence
      });

      setTx({
        stage: 'submitted',
        hash: tx.hash,
        message: `Report submitted. Tx hash: ${tx.hash}`
      });
      setDraftPayload(JSON.stringify({ txHash: tx.hash }, null, 2));

      setTx({
        stage: 'confirming',
        hash: tx.hash,
        message: 'Transaction submitted. Waiting for confirmation...'
      });
      await tx.wait();

      setTx({
        stage: 'confirmed',
        hash: tx.hash,
        message: `Transaction confirmed: ${tx.hash}`
      });
      setDraftMessage(`Transaction confirmed: ${tx.hash}`);
      await refreshAfterWrite();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Onchain submission failed';
      setTx({ stage: 'error', message });
      setDraftMessage(message);
    } finally {
      setSubmittingOnchain(false);
    }
  };

  const handleVoteOnchain = async (reportId: number, upvote: boolean): Promise<void> => {
    try {
      if (!walletAddress) {
        throw new Error('Connect wallet before voting.');
      }

      setTx({ stage: 'preparing', message: `Preparing ${upvote ? 'upvote' : 'downvote'} transaction...` });
      const payload = await prepareVote(reportId, upvote);
      await ensureTargetNetwork(chainConfig ?? undefined);

      setTx({ stage: 'awaiting_signature', message: 'Awaiting wallet signature for vote...' });
      const tx = await voteOnReportOnchain({
        contractAddress: resolveContractAddress(),
        reportId: payload.params.reportId,
        upvote: payload.params.upvote
      });

      setTx({ stage: 'submitted', hash: tx.hash, message: `Vote submitted: ${tx.hash}` });
      setTx({ stage: 'confirming', hash: tx.hash, message: 'Waiting for vote confirmation...' });
      await tx.wait();

      setTx({ stage: 'confirmed', hash: tx.hash, message: `Vote confirmed: ${tx.hash}` });
      await refreshAfterWrite();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Vote submission failed';
      setTx({ stage: 'error', message });
    }
  };

  const handleResolveOnchain = async (reportId: number, malicious: boolean): Promise<void> => {
    try {
      if (!walletAddress) {
        throw new Error('Connect wallet before resolving reports.');
      }

      setTx({
        stage: 'preparing',
        message: `Preparing ${malicious ? 'malicious' : 'safe'} resolution transaction...`
      });
      const payload = await prepareResolve(reportId, malicious);
      await ensureTargetNetwork(chainConfig ?? undefined);

      setTx({ stage: 'awaiting_signature', message: 'Awaiting wallet signature for resolution...' });
      const tx = await resolveReportOnchain({
        contractAddress: resolveContractAddress(),
        reportId: payload.params.reportId,
        malicious: payload.params.malicious
      });

      setTx({ stage: 'submitted', hash: tx.hash, message: `Resolution submitted: ${tx.hash}` });
      setTx({ stage: 'confirming', hash: tx.hash, message: 'Waiting for resolution confirmation...' });
      await tx.wait();

      setTx({ stage: 'confirmed', hash: tx.hash, message: `Resolution confirmed: ${tx.hash}` });
      await refreshAfterWrite();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Resolution submission failed';
      setTx({ stage: 'error', message });
    }
  };

  const riskTone = useMemo(() => {
    if (!checkResult) {
      return 'clean';
    }
    return scoreTone(checkResult.riskScore);
  }, [checkResult]);

  const targetChainId = chainConfig?.chainId || targetChainFromEnv();
  const walletNetworkMismatch =
    targetChainId > 0 && walletChainId !== null ? walletChainId !== targetChainId : false;

  const txStatusClass = `status ${txStatus.stage === 'error' ? 'status-error' : txStatus.stage === 'confirmed' ? 'status-ok' : 'status-info'}`;

  return (
    <main className="page-shell">
      <section className="hero reveal-1">
        <p className="kicker">X1 Sentinel</p>
        <h1>Risk Intelligence Console</h1>
        <p>
          Query wallet safety, inspect report signals, and execute onchain incident reporting, voting, and resolution
          from a single operations view.
        </p>

        <div className="hero-row">
          <div className="hero-card">
            <h3>Chain Mode</h3>
            <p>
              {chainConfig ? `${chainConfig.chainName} · ${chainConfig.mode}` : 'Loading chain configuration...'}
            </p>
            {chainConfig?.contractAddress && <p>Contract: {shortAddress(chainConfig.contractAddress)}</p>}
            {chainConfigError && <p className="status status-error">{chainConfigError}</p>}
          </div>

          <div className="hero-card">
            <h3>Wallet</h3>
            <p>{walletAddress ? shortAddress(walletAddress) : 'Not connected'}</p>
            <button type="button" onClick={handleConnectWallet} disabled={connectingWallet}>
              {connectingWallet ? 'Connecting...' : walletAddress ? 'Reconnect Wallet' : 'Connect Wallet'}
            </button>
            {walletNetworkMismatch && (
              <p className="status status-warn">Wrong network detected. Switch to chain id {targetChainId}.</p>
            )}
            {walletStatus && <p className="status status-info">{walletStatus}</p>}
          </div>
        </div>
      </section>

      <section className="panel reveal-2">
        <h2>Transaction Status</h2>
        <p className={txStatusClass}>
          {txStatus.message}
          {txStatus.hash ? ` (${txStatus.hash})` : ''}
        </p>
      </section>

      <section className="layout-grid">
        <article className="panel reveal-3">
          <h2>Address Check</h2>
          <form className="inline-form" onSubmit={runCheck}>
            <input
              type="text"
              placeholder="0x..."
              value={queryAddress}
              onChange={(event) => setQueryAddress(event.target.value)}
              aria-label="Address to check"
            />
            <button type="submit" disabled={checking}>
              {checking ? 'Checking...' : 'Run Check'}
            </button>
          </form>

          {checkError && <p className="status status-error">{checkError}</p>}

          {checkResult && (
            <div className="result-wrap">
              <div className={`risk-badge tone-${riskTone}`}>
                {riskLabel(checkResult.riskScore)} Risk · {checkResult.riskScore}/100
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <span>Mode</span>
                  <strong>{checkResult.mode}</strong>
                </div>
                <div className="stat-card">
                  <span>Privacy Grade</span>
                  <strong>{checkResult.privacyGrade}</strong>
                </div>
                <div className="stat-card">
                  <span>Reports</span>
                  <strong>{checkResult.reportCount}</strong>
                </div>
                <div className="stat-card">
                  <span>External Flags</span>
                  <strong>{checkResult.externalFlags.totalFlags}</strong>
                </div>
              </div>

              <div className="detail-block">
                <h3>Privacy Factors</h3>
                <ul>
                  <li>Transaction Activity: {checkResult.privacyFactors.transactionActivity}</li>
                  <li>Balance Exposure: {checkResult.privacyFactors.balanceExposure.toFixed(4)} ETH</li>
                  <li>Public Scrutiny: {checkResult.privacyFactors.publicScrutiny}</li>
                  <li>Address Reuse: {checkResult.privacyFactors.addressReuse}%</li>
                </ul>
              </div>

              {checkResult.privacyRecommendations.length > 0 && (
                <div className="detail-block">
                  <h3>Recommendations</h3>
                  <ul>
                    {checkResult.privacyRecommendations.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {checkResult.reports.length > 0 && (
                <div className="detail-block">
                  <h3>Actionable Reports</h3>
                  <div className="feed-list">
                    {checkResult.reports.map((report) => (
                      <article key={report.id} className="feed-item">
                        <div className="feed-item-top">
                          <span className="chip">{report.reason}</span>
                          <span>{report.resolved ? (report.malicious ? 'Resolved: Malicious' : 'Resolved: Safe') : 'Open'}</span>
                        </div>
                        <strong>Report #{report.id}</strong>
                        <p>{report.evidence}</p>
                        <div className="feed-votes">👍 {report.upvotes} · 👎 {report.downvotes}</div>
                        <div className="action-row">
                          <button type="button" onClick={() => void handleVoteOnchain(report.id, true)} disabled={!walletAddress || report.resolved}>
                            Upvote
                          </button>
                          <button type="button" className="secondary" onClick={() => void handleVoteOnchain(report.id, false)} disabled={!walletAddress || report.resolved}>
                            Downvote
                          </button>
                          <button type="button" onClick={() => void handleResolveOnchain(report.id, true)} disabled={!walletAddress || report.resolved}>
                            Resolve Malicious
                          </button>
                          <button type="button" className="secondary" onClick={() => void handleResolveOnchain(report.id, false)} disabled={!walletAddress || report.resolved}>
                            Resolve Safe
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </article>

        <aside className="panel reveal-4">
          <div className="panel-head">
            <h2>Recent Reports</h2>
            <span>{recentReports.length} shown</span>
          </div>

          {reportFeedError && <p className="status status-error">{reportFeedError}</p>}

          <div className="feed-list">
            {recentReports.map((report) => (
              <article key={report.id} className="feed-item">
                <div className="feed-item-top">
                  <span className="chip">{report.reason}</span>
                  <time>{new Date(report.timestamp).toLocaleDateString()}</time>
                </div>
                <strong>{shortAddress(report.targetAddress)}</strong>
                <p>{report.evidence}</p>
                <div className="feed-votes">👍 {report.upvotes} · 👎 {report.downvotes}</div>
                {report.resolved && (
                  <div className="status status-info">
                    {report.malicious ? 'Resolved as malicious' : 'Resolved as safe'}
                  </div>
                )}
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="panel reveal-4">
        <h2>Report Submission</h2>
        <p className="muted">
          Draft payload with API validation, then submit onchain through your connected wallet.
        </p>

        <form className="draft-form" onSubmit={submitDraft}>
          <input
            type="text"
            placeholder="Target address"
            value={draftAddress}
            onChange={(event) => setDraftAddress(event.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Name tag (optional)"
            value={draftNameTag}
            onChange={(event) => setDraftNameTag(event.target.value)}
          />
          <select value={draftReason} onChange={(event) => setDraftReason(event.target.value as ReportReason)}>
            {reasons.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Evidence and context"
            value={draftEvidence}
            onChange={(event) => setDraftEvidence(event.target.value)}
            minLength={10}
            required
          />

          <div className="action-row">
            <button type="submit" disabled={submittingDraft}>
              {submittingDraft ? 'Preparing...' : 'Prepare Payload'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void handleOnchainSubmit()}
              disabled={submittingOnchain || !walletAddress}
            >
              {submittingOnchain ? 'Submitting...' : 'Submit Onchain'}
            </button>
          </div>
        </form>

        {draftMessage && <p className="status status-info">{draftMessage}</p>}
        {draftPayload && <pre className="payload-preview">{draftPayload}</pre>}
      </section>
    </main>
  );
}
