'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { checkAddress, getRecentReports, prepareReport } from '@/lib/api';
import { CheckResult, ReportReason, SafetyReport } from '@/types/safety';

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

export default function SentinelDashboard() {
  const [queryAddress, setQueryAddress] = useState('');
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const [recentReports, setRecentReports] = useState<SafetyReport[]>([]);
  const [reportFeedError, setReportFeedError] = useState<string | null>(null);

  const [draftAddress, setDraftAddress] = useState('');
  const [draftNameTag, setDraftNameTag] = useState('');
  const [draftReason, setDraftReason] = useState<ReportReason>('Phishing');
  const [draftEvidence, setDraftEvidence] = useState('');
  const [draftMessage, setDraftMessage] = useState<string | null>(null);
  const [draftPayload, setDraftPayload] = useState<string>('');
  const [submittingDraft, setSubmittingDraft] = useState(false);

  useEffect(() => {
    const loadReports = async (): Promise<void> => {
      try {
        const reports = await getRecentReports(6);
        setRecentReports(reports);
        setReportFeedError(null);
      } catch (error) {
        setReportFeedError(error instanceof Error ? error.message : 'Unable to load reports');
      }
    };

    void loadReports();
  }, []);

  const runCheck = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!queryAddress.trim()) {
      return;
    }

    setChecking(true);
    setCheckError(null);

    try {
      const result = await checkAddress(queryAddress.trim());
      setCheckResult(result);
    } catch (error) {
      setCheckError(error instanceof Error ? error.message : 'Unable to run check');
      setCheckResult(null);
    } finally {
      setChecking(false);
    }
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

  const riskTone = useMemo(() => {
    if (!checkResult) {
      return 'clean';
    }
    return scoreTone(checkResult.riskScore);
  }, [checkResult]);

  return (
    <main className="page-shell">
      <section className="hero reveal-1">
        <p className="kicker">X1 Sentinel</p>
        <h1>Risk Intelligence Console</h1>
        <p>
          Query wallet safety, inspect report signals, and prepare immutable incident submissions from a single
          operations view.
        </p>
      </section>

      <section className="layout-grid">
        <article className="panel reveal-2">
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
            </div>
          )}
        </article>

        <aside className="panel reveal-3">
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
              </article>
            ))}
          </div>
        </aside>
      </section>

      <section className="panel reveal-4">
        <h2>Prepare Report Payload</h2>
        <p className="muted">This draft flow prepares the transaction payload for wallet signing.</p>

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
          <button type="submit" disabled={submittingDraft}>
            {submittingDraft ? 'Preparing...' : 'Prepare Payload'}
          </button>
        </form>

        {draftMessage && <p className="status status-info">{draftMessage}</p>}
        {draftPayload && <pre className="payload-preview">{draftPayload}</pre>}
      </section>
    </main>
  );
}
