export type ReportReason = 'Phishing' | 'Scam' | 'RugPull' | 'MaliciousContract' | 'Spam' | 'Other';

export interface SafetyReport {
  id: number;
  reporter: string;
  targetAddress: string;
  nameTag: string | null;
  reason: ReportReason;
  evidence: string;
  timestamp: number;
  upvotes: number;
  downvotes: number;
  resolved: boolean;
  malicious: boolean;
  resolvedBy: string;
  resolvedAt: number;
}

export interface PrivacyFactors {
  transactionActivity: number;
  balanceExposure: number;
  publicScrutiny: number;
  addressReuse: number;
  isContract: boolean;
}

export interface ExternalFlags {
  scamLists: Array<{
    source: string;
    flagged: boolean;
    details: string | null;
  }>;
  totalFlags: number;
}

export interface DepinStoredAttestation {
  id: string;
  nodeAddress: string;
  subjectAddress: string;
  signalType: string;
  severity: 0 | 1 | 2;
  healthScore: number;
  timestamp: number;
  nonce: string;
  payloadUri: string;
  signer: string;
  verifiedAt: number;
}

export interface DepinHealthResponse {
  address: string;
  windowHours: number;
  generatedAt: string;
  summary: {
    status: 'healthy' | 'warning' | 'critical' | 'unknown';
    healthScore: number;
    confidence: number;
    latestTimestamp: number | null;
  };
  telemetry: {
    totalAttestations: number;
    uniqueNodes: number;
    bySeverity: {
      healthy: number;
      warning: number;
      critical: number;
    };
    bySignalType: Record<string, number>;
  };
  latestAttestations: DepinStoredAttestation[];
}

export interface AiRiskDecision {
  address: string;
  model: {
    riskScore: number;
    confidence: number;
    classification: 'low' | 'medium' | 'high' | 'critical';
    summary: string;
    reasons: string[];
    recommendedActions: string[];
    automation: 'none' | 'notify' | 'soft_block' | 'hard_block' | 'manual_review';
  };
  policy: {
    action: 'allow' | 'warn' | 'challenge' | 'manual_review' | 'block';
    autoExecute: boolean;
    reasons: string[];
  };
  artifacts: {
    inputHash: string;
    outputHash: string;
    modelVersionHash: string;
    modelProvider: 'heuristic' | 'openai';
    modelName: string;
    modelVersion: string;
    generatedAt: string;
  };
}

export interface AiAnchorRecord {
  decisionId: number;
  subjectAddress: string;
  inputHash: string;
  outputHash: string;
  modelVersionHash: string;
  riskScore: number;
  confidence: number;
  policyAction: string;
  timestamp: number;
  publisher: string;
  metadataUri: string;
}

export interface DepinAnchorRecord {
  anchorId: number;
  subjectAddress: string;
  attestationRoot: string;
  attestationCount: number;
  healthScore: number;
  confidence: number;
  timestamp: number;
  publisher: string;
  metadataUri: string;
}

export interface AnchorConfig {
  aiDecisionAnchorAddress: string;
  depinAnchorAddress: string;
  aiEnabled: boolean;
  depinEnabled: boolean;
}

export interface CheckResult {
  address: string;
  isFlagged: boolean;
  riskScore: number;
  unresolvedReportCount: number;
  privacyScore: number;
  privacyGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  privacyFactors: PrivacyFactors;
  privacyRecommendations: string[];
  reportCount: number;
  reports: SafetyReport[];
  externalFlags: ExternalFlags;
  depinHealth: DepinHealthResponse;
  aiDecision: AiRiskDecision;
  mode: 'onchain' | 'demo';
  timestamp: string;
}

export interface ChainConfig {
  chainName: string;
  chainId: number;
  chainCurrencySymbol: string;
  chainExplorerUrl: string;
  rpcUrl: string;
  contractAddress: string;
  aiDecisionAnchorAddress?: string;
  depinAnchorAddress?: string;
  mode: 'onchain' | 'demo';
}

export type TxStage = 'idle' | 'preparing' | 'awaiting_signature' | 'submitted' | 'confirming' | 'confirmed' | 'error';

export interface TxStatus {
  stage: TxStage;
  hash?: string;
  message: string;
}
