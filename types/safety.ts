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

export interface CheckResult {
  address: string;
  isFlagged: boolean;
  riskScore: number;
  privacyScore: number;
  privacyGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  privacyFactors: PrivacyFactors;
  privacyRecommendations: string[];
  reportCount: number;
  reports: SafetyReport[];
  externalFlags: ExternalFlags;
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
  mode: 'onchain' | 'demo';
}

export type TxStage = 'idle' | 'preparing' | 'awaiting_signature' | 'submitted' | 'confirming' | 'confirmed' | 'error';

export interface TxStatus {
  stage: TxStage;
  hash?: string;
  message: string;
}
