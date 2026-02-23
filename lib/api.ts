import {
  AiAnchorRecord,
  AnchorConfig,
  ChainConfig,
  CheckResult,
  DepinAnchorRecord,
  ReportReason,
  SafetyReport
} from '@/types/safety';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4010';

const parseJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const fallback = `Request failed (${response.status})`;
    let message = fallback;

    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) {
        message = payload.error;
      }
    } catch {
      message = fallback;
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
};

export const checkAddress = async (address: string): Promise<CheckResult> => {
  const response = await fetch(`${API_BASE}/api/check/${address}`, {
    method: 'GET',
    cache: 'no-store'
  });

  return parseJson<CheckResult>(response);
};

export const getChainConfig = async (): Promise<ChainConfig> => {
  const response = await fetch(`${API_BASE}/api/config`, {
    method: 'GET',
    cache: 'no-store'
  });

  return parseJson<ChainConfig>(response);
};

export const getRecentReports = async (limit = 8): Promise<SafetyReport[]> => {
  const response = await fetch(`${API_BASE}/api/reports?limit=${limit}`, {
    method: 'GET',
    cache: 'no-store'
  });

  const payload = await parseJson<{ reports: SafetyReport[] }>(response);
  return payload.reports;
};

export const prepareReport = async (input: {
  targetAddress: string;
  nameTag: string;
  reason: ReportReason;
  evidence: string;
}): Promise<{
  message: string;
  method: string;
  params: {
    targetAddress: string;
    nameTag: string;
    reason: number;
    evidence: string;
  };
}> => {
  const response = await fetch(`${API_BASE}/api/reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  return parseJson(response);
};

export const prepareVote = async (
  reportId: number,
  upvote: boolean
): Promise<{
  message: string;
  method: string;
  params: {
    reportId: number;
    upvote: boolean;
  };
}> => {
  const response = await fetch(`${API_BASE}/api/reports/${reportId}/vote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ upvote })
  });

  return parseJson(response);
};

export const prepareResolve = async (
  reportId: number,
  malicious: boolean
): Promise<{
  message: string;
  method: string;
  params: {
    reportId: number;
    malicious: boolean;
  };
}> => {
  const response = await fetch(`${API_BASE}/api/reports/${reportId}/resolve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ malicious })
  });

  return parseJson(response);
};

export const getAnchorConfig = async (): Promise<AnchorConfig> => {
  const response = await fetch(`${API_BASE}/api/anchors/config`, {
    method: 'GET',
    cache: 'no-store'
  });

  return parseJson<AnchorConfig>(response);
};

export const prepareAiAnchor = async (input: {
  subjectAddress: string;
  aiDecision: {
    model?: { riskScore?: number; confidence?: number };
    policy?: { action?: string };
    artifacts?: {
      inputHash?: string;
      outputHash?: string;
      modelVersionHash?: string;
    };
  };
  metadataUri?: string;
}): Promise<{
  message: string;
  contractAddress: string;
  method: 'anchorDecision';
  params: {
    subjectAddress: string;
    inputHash: string;
    outputHash: string;
    modelVersionHash: string;
    riskScoreBps: number;
    confidenceBps: number;
    policyAction: number;
    metadataUri: string;
  };
}> => {
  const response = await fetch(`${API_BASE}/api/anchors/ai/prepare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  return parseJson(response);
};

export const prepareDepinAnchor = async (input: {
  subjectAddress: string;
  attestationRoot: string;
  attestationCount: number;
  healthScore: number;
  confidence: number;
  metadataUri?: string;
}): Promise<{
  message: string;
  contractAddress: string;
  method: 'anchorSubjectTelemetry';
  params: {
    subjectAddress: string;
    attestationRoot: string;
    attestationCount: number;
    healthScoreBps: number;
    confidenceBps: number;
    metadataUri: string;
  };
}> => {
  const response = await fetch(`${API_BASE}/api/anchors/depin/prepare`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  return parseJson(response);
};

export const getAiAnchors = async (address: string, limit = 10): Promise<AiAnchorRecord[]> => {
  const response = await fetch(`${API_BASE}/api/anchors/ai/${address}?limit=${limit}`, {
    method: 'GET',
    cache: 'no-store'
  });

  const payload = await parseJson<{ decisions: AiAnchorRecord[] }>(response);
  return payload.decisions;
};

export const getDepinAnchors = async (address: string, limit = 10): Promise<DepinAnchorRecord[]> => {
  const response = await fetch(`${API_BASE}/api/anchors/depin/${address}?limit=${limit}`, {
    method: 'GET',
    cache: 'no-store'
  });

  const payload = await parseJson<{ anchors: DepinAnchorRecord[] }>(response);
  return payload.anchors;
};
