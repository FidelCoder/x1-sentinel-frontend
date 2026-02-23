'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { keccak256, toUtf8Bytes } from 'ethers';
import {
  checkAddress,
  getAiAnchors,
  getAnchorConfig,
  getChainConfig,
  getDepinAnchors,
  getRecentReports,
  prepareAiAnchor,
  prepareDepinAnchor,
  prepareReport,
  prepareResolve,
  prepareVote
} from '@/lib/api';
import {
  anchorAiDecisionOnchain,
  anchorDepinTelemetryOnchain,
  resolveReportOnchain,
  submitReportOnchain,
  voteOnReportOnchain
} from '@/lib/registry';
import {
  connectWallet,
  ensureTargetNetwork,
  getCurrentAccount,
  getCurrentChainId,
  getWalletOptions,
  isWalletInstalled,
  subscribeWalletEvents,
  WalletProviderId
} from '@/lib/wallet';
import {
  AiAnchorRecord,
  AnchorConfig,
  ChainConfig,
  CheckResult,
  DepinAnchorRecord,
  ReportReason,
  SafetyReport,
  TxStatus
} from '@/types/safety';

const reasons: ReportReason[] = ['Phishing', 'Scam', 'RugPull', 'MaliciousContract', 'Spam', 'Other'];

const walletProviderLabel = (wallet: WalletProviderId): string => {
  if (wallet === 'metamask') return 'MetaMask';
  if (wallet === 'trust') return 'Trust Wallet';
  return 'Injected Wallet';
};

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

const minimumEvidenceChars = 10;

const txStageLabel = (stage: TxStatus['stage']): string => {
  if (stage === 'awaiting_signature') return 'Awaiting Signature';
  if (stage === 'submitted') return 'Submitted';
  if (stage === 'confirming') return 'Confirming';
  if (stage === 'confirmed') return 'Confirmed';
  if (stage === 'error') return 'Error';
  if (stage === 'preparing') return 'Preparing';
  return 'Idle';
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
  const [anchorConfig, setAnchorConfig] = useState<AnchorConfig | null>(null);
  const [anchorConfigError, setAnchorConfigError] = useState<string | null>(null);

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [walletStatus, setWalletStatus] = useState<string | null>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [walletPickerOpen, setWalletPickerOpen] = useState(false);

  const [draftAddress, setDraftAddress] = useState('');
  const [draftNameTag, setDraftNameTag] = useState('');
  const [draftReason, setDraftReason] = useState<ReportReason>('Phishing');
  const [draftEvidence, setDraftEvidence] = useState('');
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [draftMessageTone, setDraftMessageTone] = useState<'info' | 'ok' | 'error'>('info');
  const [draftPayload, setDraftPayload] = useState<string>('');
  const [submittingDraft, setSubmittingDraft] = useState(false);
  const [submittingOnchain, setSubmittingOnchain] = useState(false);
  const [anchoringAi, setAnchoringAi] = useState(false);
  const [anchoringDepin, setAnchoringDepin] = useState(false);
  const [txStatus, setTxStatus] = useState<TxStatus>(defaultTxStatus);
  const [txHashCopyMessage, setTxHashCopyMessage] = useState<string | null>(null);
  const [aiAnchors, setAiAnchors] = useState<AiAnchorRecord[]>([]);
  const [depinAnchors, setDepinAnchors] = useState<DepinAnchorRecord[]>([]);
  const [anchorsLoading, setAnchorsLoading] = useState(false);
  const [anchorsError, setAnchorsError] = useState<string | null>(null);

  const setTx = (status: TxStatus): void => {
    setTxStatus(status);
  };

  const resetReportForm = (): void => {
    setDraftAddress('');
    setDraftNameTag('');
    setDraftReason('Phishing');
    setDraftEvidence('');
    setDraftPayload('');
  };

  const loadAnchorsForAddress = async (address: string): Promise<void> => {
    setAnchorsLoading(true);
    setAnchorsError(null);

    try {
      const [ai, depin] = await Promise.all([getAiAnchors(address, 6), getDepinAnchors(address, 6)]);
      setAiAnchors(ai);
      setDepinAnchors(depin);
    } catch (error) {
      setAiAnchors([]);
      setDepinAnchors([]);
      setAnchorsError(error instanceof Error ? error.message : 'Unable to load onchain anchors');
    } finally {
      setAnchorsLoading(false);
    }
  };

  const buildDepinAttestationRoot = (result: CheckResult): string => {
    const rootPayload = JSON.stringify({
      address: result.depinHealth.address,
      summary: result.depinHealth.summary,
      telemetry: result.depinHealth.telemetry,
      latestAttestations: result.depinHealth.latestAttestations.map((item) => ({
        id: item.id,
        nodeAddress: item.nodeAddress,
        subjectAddress: item.subjectAddress,
        signalType: item.signalType,
        severity: item.severity,
        healthScore: item.healthScore,
        timestamp: item.timestamp,
        nonce: item.nonce,
        payloadUri: item.payloadUri,
        signer: item.signer
      }))
    });

    return keccak256(toUtf8Bytes(rootPayload));
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
      await loadAnchorsForAddress(result.address);
    } catch (error) {
      setCheckError(error instanceof Error ? error.message : 'Unable to run check');
      setCheckResult(null);
      setAiAnchors([]);
      setDepinAnchors([]);
      setAnchorsError(null);
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
        const [reports, config, anchors] = await Promise.all([getRecentReports(6), getChainConfig(), getAnchorConfig()]);
        setRecentReports(reports);
        setChainConfig(config);
        setAnchorConfig(anchors);
        setReportFeedError(null);
        setChainConfigError(null);
        setAnchorConfigError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load dashboard data';
        setReportFeedError(message);
        setChainConfigError(message);
        setAnchorConfigError(message);
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

  const clearCheck = (): void => {
    setQueryAddress('');
    setCheckResult(null);
    setCheckError(null);
    setAiAnchors([]);
    setDepinAnchors([]);
    setAnchorsError(null);
  };

  const submitDraft = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    setSubmittingDraft(true);
    setDraftMessage(null);
    setDraftMessageTone('info');

    try {
      const payload = await prepareReport({
        targetAddress: draftAddress.trim(),
        nameTag: draftNameTag.trim(),
        reason: draftReason,
        evidence: draftEvidence.trim()
      });

      setDraftMessage(payload.message);
      setDraftMessageTone('info');
      setDraftPayload(JSON.stringify(payload, null, 2));
    } catch (error) {
      setDraftMessage(error instanceof Error ? error.message : 'Unable to prepare report payload');
      setDraftMessageTone('error');
      setDraftPayload('');
    } finally {
      setSubmittingDraft(false);
    }
  };

  const handleConnectWallet = async (wallet: WalletProviderId): Promise<void> => {
    if (!isWalletInstalled()) {
      setWalletStatus('Wallet extension not found. Install MetaMask or another EVM wallet.');
      return;
    }

    setConnectingWallet(true);
    setWalletStatus(null);

    try {
      const account = await connectWallet(wallet);
      await ensureTargetNetwork(chainConfig ?? undefined);
      const chainId = await getCurrentChainId();
      setWalletAddress(account);
      setWalletChainId(chainId);
      setWalletStatus(`Wallet connected via ${walletProviderLabel(wallet)}.`);
      setWalletPickerOpen(false);
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

  const resolveAiAnchorAddress = (): string => {
    const fromChainConfig = chainConfig?.aiDecisionAnchorAddress?.trim();
    const fromAnchorConfig = anchorConfig?.aiDecisionAnchorAddress?.trim();
    const fromEnv = process.env.NEXT_PUBLIC_AI_DECISION_ANCHOR_ADDRESS?.trim();
    const value = fromChainConfig || fromAnchorConfig || fromEnv;

    if (!value) {
      throw new Error('AI anchor contract is missing. Set AI_DECISION_ANCHOR_ADDRESS in backend config.');
    }

    return value;
  };

  const resolveDepinAnchorAddress = (): string => {
    const fromChainConfig = chainConfig?.depinAnchorAddress?.trim();
    const fromAnchorConfig = anchorConfig?.depinAnchorAddress?.trim();
    const fromEnv = process.env.NEXT_PUBLIC_DEPIN_ANCHOR_ADDRESS?.trim();
    const value = fromChainConfig || fromAnchorConfig || fromEnv;

    if (!value) {
      throw new Error('DePIN anchor contract is missing. Set DEPIN_ANCHOR_ADDRESS in backend config.');
    }

    return value;
  };

  const handleAnchorAiDecision = async (): Promise<void> => {
    if (!checkResult) {
      setTx({ stage: 'error', message: 'Run an address check before anchoring AI output.' });
      return;
    }

    if (!walletAddress) {
      setTx({ stage: 'error', message: 'Connect wallet before anchoring AI output.' });
      return;
    }

    setAnchoringAi(true);

    try {
      setTx({ stage: 'preparing', message: 'Preparing AI anchor transaction...' });
      const payload = await prepareAiAnchor({
        subjectAddress: checkResult.address,
        aiDecision: checkResult.aiDecision,
        metadataUri: `x1://ai/${checkResult.address.toLowerCase()}/${Date.now()}`
      });

      await ensureTargetNetwork(chainConfig ?? undefined);
      setTx({ stage: 'awaiting_signature', message: 'Awaiting wallet signature for AI anchor...' });

      const tx = await anchorAiDecisionOnchain({
        contractAddress: resolveAiAnchorAddress(),
        subjectAddress: payload.params.subjectAddress,
        inputHash: payload.params.inputHash,
        outputHash: payload.params.outputHash,
        modelVersionHash: payload.params.modelVersionHash,
        riskScoreBps: payload.params.riskScoreBps,
        confidenceBps: payload.params.confidenceBps,
        policyAction: payload.params.policyAction,
        metadataUri: payload.params.metadataUri
      });

      setTx({ stage: 'submitted', hash: tx.hash, message: `AI anchor submitted: ${tx.hash}` });
      setTx({ stage: 'confirming', hash: tx.hash, message: 'Waiting for AI anchor confirmation...' });
      await tx.wait();
      setTx({ stage: 'confirmed', hash: tx.hash, message: `AI anchor confirmed: ${tx.hash}` });

      await loadAnchorsForAddress(checkResult.address);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI anchor submission failed';
      setTx({ stage: 'error', message });
    } finally {
      setAnchoringAi(false);
    }
  };

  const handleAnchorDepinTelemetry = async (): Promise<void> => {
    if (!checkResult) {
      setTx({ stage: 'error', message: 'Run an address check before anchoring DePIN output.' });
      return;
    }

    if (!walletAddress) {
      setTx({ stage: 'error', message: 'Connect wallet before anchoring DePIN output.' });
      return;
    }

    setAnchoringDepin(true);

    try {
      setTx({ stage: 'preparing', message: 'Preparing DePIN anchor transaction...' });

      const payload = await prepareDepinAnchor({
        subjectAddress: checkResult.address,
        attestationRoot: buildDepinAttestationRoot(checkResult),
        attestationCount: checkResult.depinHealth.telemetry.totalAttestations,
        healthScore: checkResult.depinHealth.summary.healthScore,
        confidence: checkResult.depinHealth.summary.confidence,
        metadataUri: `x1://depin/${checkResult.address.toLowerCase()}/${Date.now()}`
      });

      await ensureTargetNetwork(chainConfig ?? undefined);
      setTx({ stage: 'awaiting_signature', message: 'Awaiting wallet signature for DePIN anchor...' });

      const tx = await anchorDepinTelemetryOnchain({
        contractAddress: resolveDepinAnchorAddress(),
        subjectAddress: payload.params.subjectAddress,
        attestationRoot: payload.params.attestationRoot,
        attestationCount: payload.params.attestationCount,
        healthScoreBps: payload.params.healthScoreBps,
        confidenceBps: payload.params.confidenceBps,
        metadataUri: payload.params.metadataUri
      });

      setTx({ stage: 'submitted', hash: tx.hash, message: `DePIN anchor submitted: ${tx.hash}` });
      setTx({ stage: 'confirming', hash: tx.hash, message: 'Waiting for DePIN anchor confirmation...' });
      await tx.wait();
      setTx({ stage: 'confirmed', hash: tx.hash, message: `DePIN anchor confirmed: ${tx.hash}` });

      await loadAnchorsForAddress(checkResult.address);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'DePIN anchor submission failed';
      setTx({ stage: 'error', message });
    } finally {
      setAnchoringDepin(false);
    }
  };

  const handleOnchainSubmit = async (): Promise<void> => {
    setSubmittingOnchain(true);
    setDraftMessage(null);
    setDraftMessageTone('info');

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
      setDraftMessage(`Report submitted successfully. Transaction confirmed: ${tx.hash}`);
      setDraftMessageTone('ok');
      resetReportForm();
      await refreshAfterWrite();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Onchain submission failed';
      setTx({ stage: 'error', message });
      setDraftMessage(message);
      setDraftMessageTone('error');
    } finally {
      setSubmittingOnchain(false);
    }
  };

  const copyTxHash = async (): Promise<void> => {
    if (!txStatus.hash || typeof navigator === 'undefined' || !navigator.clipboard) {
      setTxHashCopyMessage('Clipboard is unavailable in this browser.');
      return;
    }

    try {
      await navigator.clipboard.writeText(txStatus.hash);
      setTxHashCopyMessage('Transaction hash copied.');
    } catch {
      setTxHashCopyMessage('Unable to copy transaction hash.');
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
  const walletOptions = getWalletOptions();
  const evidenceLength = draftEvidence.trim().length;
  const evidenceRemaining = Math.max(0, minimumEvidenceChars - evidenceLength);
  const hasValidDraftAddress = /^0x[a-fA-F0-9]{40}$/.test(draftAddress.trim());
  const isDraftReady = hasValidDraftAddress && evidenceLength >= minimumEvidenceChars;
  const recentOpenReports = recentReports.filter((report) => !report.resolved).length;
  const hasAnyReports = recentReports.length > 0;
  const canClearCheck = queryAddress.length > 0 || checkResult !== null || checkError !== null;

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
            {(chainConfig?.aiDecisionAnchorAddress || anchorConfig?.aiDecisionAnchorAddress) && (
              <p>AI Anchor: {shortAddress(chainConfig?.aiDecisionAnchorAddress || anchorConfig?.aiDecisionAnchorAddress || '')}</p>
            )}
            {(chainConfig?.depinAnchorAddress || anchorConfig?.depinAnchorAddress) && (
              <p>DePIN Anchor: {shortAddress(chainConfig?.depinAnchorAddress || anchorConfig?.depinAnchorAddress || '')}</p>
            )}
            {chainConfigError && <p className="status status-error">{chainConfigError}</p>}
            {anchorConfigError && <p className="status status-error">{anchorConfigError}</p>}
          </div>

          <div className="hero-card">
            <h3>Wallet</h3>
            <p>{walletAddress ? shortAddress(walletAddress) : 'Not connected'}</p>
            <button
              type="button"
              onClick={() => setWalletPickerOpen((open) => !open)}
              disabled={connectingWallet}
            >
              {connectingWallet ? 'Connecting...' : walletAddress ? 'Switch Wallet' : 'Connect Wallet'}
            </button>
            {walletPickerOpen && (
              <div className="wallet-picker">
                {walletOptions.map((wallet) => (
                  <button
                    key={wallet.id}
                    type="button"
                    className="wallet-choice"
                    onClick={() => void handleConnectWallet(wallet.id)}
                    disabled={connectingWallet || !wallet.installed}
                  >
                    <span className="wallet-choice-title">{wallet.label}</span>
                    <span className="wallet-choice-meta">{wallet.description}</span>
                    <span
                      className={`wallet-choice-state ${wallet.installed ? 'wallet-choice-state-on' : 'wallet-choice-state-off'}`}
                    >
                      {wallet.installed ? 'Detected' : 'Not detected'}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {walletNetworkMismatch && (
              <p className="status status-warn">Wrong network detected. Switch to chain id {targetChainId}.</p>
            )}
            {walletStatus && <p className="status status-info">{walletStatus}</p>}
          </div>
        </div>

        <div className="hero-stats">
          <article className="hero-stat">
            <span>Indexed Reports</span>
            <strong>{recentReports.length}</strong>
          </article>
          <article className="hero-stat">
            <span>Open Reports</span>
            <strong>{recentOpenReports}</strong>
          </article>
          <article className="hero-stat">
            <span>Connected Wallet</span>
            <strong>{walletAddress ? shortAddress(walletAddress) : 'None'}</strong>
          </article>
        </div>
      </section>

      <section className="panel reveal-2">
        <div className="tx-head">
          <h2>Transaction Status</h2>
          <span className={`stage-pill stage-${txStatus.stage}`}>{txStageLabel(txStatus.stage)}</span>
        </div>
        <p className={txStatusClass}>
          {txStatus.message}
          {txStatus.hash ? ` (${txStatus.hash})` : ''}
        </p>
        {txStatus.hash && (
          <div className="tx-meta">
            <span className="tx-hash">{shortAddress(txStatus.hash)}</span>
            <button type="button" className="secondary" onClick={() => void copyTxHash()}>
              Copy Hash
            </button>
          </div>
        )}
        {txHashCopyMessage && <p className="status status-info">{txHashCopyMessage}</p>}
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
            <div className="inline-actions">
              <button type="submit" disabled={checking}>
                {checking ? 'Checking...' : 'Run Check'}
              </button>
              <button type="button" className="ghost" onClick={clearCheck} disabled={!canClearCheck || checking}>
                Clear
              </button>
            </div>
          </form>
          <p className="field-hint">Enter any EVM address to fetch risk, privacy, and report context.</p>

          {checkError && <p className="status status-error">{checkError}</p>}
          {!checkResult && !checkError && <p className="muted">No check result yet. Run a wallet check to begin.</p>}

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
                  <span>Unresolved</span>
                  <strong>{checkResult.unresolvedReportCount}</strong>
                </div>
                <div className="stat-card">
                  <span>External Flags</span>
                  <strong>{checkResult.externalFlags.totalFlags}</strong>
                </div>
                <div className="stat-card">
                  <span>DePIN Status</span>
                  <strong>{checkResult.depinHealth.summary.status}</strong>
                </div>
                <div className="stat-card">
                  <span>AI Risk Class</span>
                  <strong>{checkResult.aiDecision.model.classification}</strong>
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

              <div className="detail-block">
                <h3>DePIN Telemetry</h3>
                <ul>
                  <li>Status: {checkResult.depinHealth.summary.status}</li>
                  <li>Health Score: {checkResult.depinHealth.summary.healthScore}/100</li>
                  <li>Confidence: {(checkResult.depinHealth.summary.confidence * 100).toFixed(1)}%</li>
                  <li>Total Attestations: {checkResult.depinHealth.telemetry.totalAttestations}</li>
                  <li>Unique Nodes: {checkResult.depinHealth.telemetry.uniqueNodes}</li>
                </ul>
              </div>

              <div className="detail-block">
                <h3>AI Decision</h3>
                <ul>
                  <li>Classification: {checkResult.aiDecision.model.classification}</li>
                  <li>Risk Score: {checkResult.aiDecision.model.riskScore}/100</li>
                  <li>Confidence: {(checkResult.aiDecision.model.confidence * 100).toFixed(1)}%</li>
                  <li>Policy Action: {checkResult.aiDecision.policy.action}</li>
                  <li>Auto Execute: {checkResult.aiDecision.policy.autoExecute ? 'Yes' : 'No'}</li>
                </ul>
                <p className="muted">{checkResult.aiDecision.model.summary}</p>
                {checkResult.aiDecision.model.reasons.length > 0 && (
                  <ul>
                    {checkResult.aiDecision.model.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
                <div className="action-row">
                  <button
                    type="button"
                    onClick={() => void handleAnchorAiDecision()}
                    disabled={!walletAddress || walletNetworkMismatch || anchoringAi}
                  >
                    {anchoringAi ? 'Anchoring AI...' : 'Anchor AI Onchain'}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => void handleAnchorDepinTelemetry()}
                    disabled={!walletAddress || walletNetworkMismatch || anchoringDepin}
                  >
                    {anchoringDepin ? 'Anchoring DePIN...' : 'Anchor DePIN Onchain'}
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => void loadAnchorsForAddress(checkResult.address)}
                    disabled={anchorsLoading}
                  >
                    {anchorsLoading ? 'Loading Anchors...' : 'Refresh Anchors'}
                  </button>
                </div>
              </div>

              {(aiAnchors.length > 0 || depinAnchors.length > 0 || anchorsError) && (
                <div className="detail-block">
                  <h3>Onchain Anchors</h3>
                  {anchorsError && <p className="status status-error">{anchorsError}</p>}

                  {aiAnchors.length > 0 && (
                    <div className="anchor-section">
                      <strong>AI Anchors ({aiAnchors.length})</strong>
                      <div className="feed-list">
                        {aiAnchors.map((anchor) => (
                          <article key={`ai-${anchor.decisionId}`} className="feed-item">
                            <div className="feed-item-top">
                              <span className="chip">AI #{anchor.decisionId}</span>
                              <time>{new Date(anchor.timestamp).toLocaleString()}</time>
                            </div>
                            <p>Policy: {anchor.policyAction}</p>
                            <p>Risk: {anchor.riskScore.toFixed(2)}% · Confidence: {(anchor.confidence * 100).toFixed(1)}%</p>
                            <p>Publisher: {shortAddress(anchor.publisher)}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}

                  {depinAnchors.length > 0 && (
                    <div className="anchor-section">
                      <strong>DePIN Anchors ({depinAnchors.length})</strong>
                      <div className="feed-list">
                        {depinAnchors.map((anchor) => (
                          <article key={`depin-${anchor.anchorId}`} className="feed-item">
                            <div className="feed-item-top">
                              <span className="chip">DePIN #{anchor.anchorId}</span>
                              <time>{new Date(anchor.timestamp).toLocaleString()}</time>
                            </div>
                            <p>Attestations: {anchor.attestationCount}</p>
                            <p>Health: {anchor.healthScore.toFixed(2)}% · Confidence: {(anchor.confidence * 100).toFixed(1)}%</p>
                            <p>Publisher: {shortAddress(anchor.publisher)}</p>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
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
                <div className="action-row">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => {
                      setQueryAddress(report.targetAddress);
                      void runCheckForAddress(report.targetAddress);
                    }}
                  >
                    Inspect Address
                  </button>
                </div>
                {report.resolved && (
                  <div className="status status-info">
                    {report.malicious ? 'Resolved as malicious' : 'Resolved as safe'}
                  </div>
                )}
              </article>
            ))}
          </div>
          {!hasAnyReports && <p className="muted">No reports indexed yet. Submit the first report to start the feed.</p>}
        </aside>
      </section>

      <section className="panel reveal-4">
        <h2>Report Submission</h2>
        <p className="muted">
          Draft payload with API validation, then submit onchain through your connected wallet.
        </p>
        <div className="form-health">
          <span>Evidence length: {evidenceLength}</span>
          <span>{evidenceRemaining > 0 ? `${evidenceRemaining} chars to minimum` : 'Ready to submit'}</span>
          <span>{walletAddress ? 'Wallet connected' : 'Wallet not connected'}</span>
        </div>

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
            minLength={minimumEvidenceChars}
            required
          />

          <div className="action-row">
            <button type="submit" disabled={submittingDraft || !isDraftReady}>
              {submittingDraft ? 'Preparing...' : 'Prepare Payload'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => void handleOnchainSubmit()}
              disabled={submittingOnchain || !walletAddress || !isDraftReady || walletNetworkMismatch}
            >
              {submittingOnchain ? 'Submitting...' : 'Submit Onchain'}
            </button>
            <button type="button" className="ghost" onClick={resetReportForm} disabled={submittingDraft || submittingOnchain}>
              Reset Form
            </button>
          </div>
        </form>

        {draftMessage && <p className={`status status-${draftMessageTone}`}>{draftMessage}</p>}
        {draftPayload && <pre className="payload-preview">{draftPayload}</pre>}
      </section>
    </main>
  );
}
