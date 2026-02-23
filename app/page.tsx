import SentinelDashboard from '@/components/SentinelDashboard';

export default function HomePage() {
  return (
    <div className="home-shell">
      <section className="intro-shell">
        <p className="intro-kicker">X1 Sentinel Platform</p>
        <h1>Security Intelligence Network for AI, DePIN, and Onchain Consumer Apps</h1>
        <p>
          Move beyond a standalone risk checker into a coordination layer where onchain signals, AI scoring, and
          device telemetry converge into real-time trust decisions.
        </p>
        <div className="intro-chips">
          <span>Realtime Risk Feeds</span>
          <span>AI Decisioning</span>
          <span>DePIN Device Attestations</span>
          <span>Community Governance</span>
        </div>
      </section>

      <section className="idea-shell">
        <div className="idea-head">
          <h2>Innovation Tracks</h2>
          <p>Each track plugs into the same contract-backed trust registry to compound network effects.</p>
        </div>
        <div className="idea-grid">
          <article className="idea-card">
            <h3>AI Trust Copilot</h3>
            <p>
              Explainable scoring over transaction patterns, contract interactions, and social graph context with
              confidence bands and rebuttal workflows.
            </p>
          </article>
          <article className="idea-card">
            <h3>DePIN Safety Mesh</h3>
            <p>
              Home and edge nodes submit signed uptime, anomaly, and geolocation attestations to create tamper-evident
              infrastructure reliability maps.
            </p>
          </article>
          <article className="idea-card">
            <h3>Consumer Reputation Rail</h3>
            <p>
              Wallet-native trust badges for marketplaces, social communities, and gaming economies based on transparent
              onchain report resolution.
            </p>
          </article>
          <article className="idea-card">
            <h3>Fraud Response Automation</h3>
            <p>
              Trigger policy engines for automated warnings, wallet risk gates, and partner webhooks when high-severity
              incidents cross thresholds.
            </p>
          </article>
        </div>
      </section>

      <section className="execution-shell">
        <article className="execution-card">
          <h3>Build Path</h3>
          <p>Signal ingestion to AI enrichment to onchain adjudication to partner distribution APIs.</p>
        </article>
        <article className="execution-card">
          <h3>North-Star Metrics</h3>
          <p>Resolved incident rate, false-positive reduction, active wallets protected, and partner integrations.</p>
        </article>
        <article className="execution-card">
          <h3>Ecosystem Fit</h3>
          <p>Directly increases verifiable onchain activity while strengthening safety for builders and users.</p>
        </article>
      </section>

      <SentinelDashboard />
    </div>
  );
}
