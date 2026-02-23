import { Contract, TransactionResponse } from 'ethers';
import { getBrowserProvider } from './wallet';

const SAFETY_REGISTRY_ABI = [
  'function submitReport(address _targetAddress, string _nameTag, uint8 _reason, string _evidence) external returns (uint256)',
  'function voteOnReport(uint256 _reportId, bool _upvote) external',
  'function resolveReport(uint256 _reportId, bool _malicious) external'
];

const AI_DECISION_ANCHOR_ABI = [
  'function anchorDecision(address subjectAddress, bytes32 inputHash, bytes32 outputHash, bytes32 modelVersionHash, uint16 riskScoreBps, uint16 confidenceBps, uint8 policyAction, string metadataUri) external'
];

const DEPIN_ANCHOR_ABI = [
  'function anchorSubjectTelemetry(address subjectAddress, bytes32 attestationRoot, uint32 attestationCount, uint16 healthScoreBps, uint16 confidenceBps, string metadataUri) external'
];

interface SubmitReportInput {
  contractAddress: string;
  targetAddress: string;
  nameTag: string;
  reasonCode: number;
  evidence: string;
}

export const submitReportOnchain = async ({
  contractAddress,
  targetAddress,
  nameTag,
  reasonCode,
  evidence
}: SubmitReportInput): Promise<TransactionResponse> => {
  if (!contractAddress) {
    throw new Error('Contract address is not configured');
  }

  const provider = await getBrowserProvider();
  const signer = await provider.getSigner();
  const contract = new Contract(contractAddress, SAFETY_REGISTRY_ABI, signer);

  return contract.submitReport(targetAddress, nameTag, reasonCode, evidence);
};

export const voteOnReportOnchain = async (input: {
  contractAddress: string;
  reportId: number;
  upvote: boolean;
}): Promise<TransactionResponse> => {
  if (!input.contractAddress) {
    throw new Error('Contract address is not configured');
  }

  const provider = await getBrowserProvider();
  const signer = await provider.getSigner();
  const contract = new Contract(input.contractAddress, SAFETY_REGISTRY_ABI, signer);
  return contract.voteOnReport(input.reportId, input.upvote);
};

export const resolveReportOnchain = async (input: {
  contractAddress: string;
  reportId: number;
  malicious: boolean;
}): Promise<TransactionResponse> => {
  if (!input.contractAddress) {
    throw new Error('Contract address is not configured');
  }

  const provider = await getBrowserProvider();
  const signer = await provider.getSigner();
  const contract = new Contract(input.contractAddress, SAFETY_REGISTRY_ABI, signer);
  return contract.resolveReport(input.reportId, input.malicious);
};

export const anchorAiDecisionOnchain = async (input: {
  contractAddress: string;
  subjectAddress: string;
  inputHash: string;
  outputHash: string;
  modelVersionHash: string;
  riskScoreBps: number;
  confidenceBps: number;
  policyAction: number;
  metadataUri: string;
}): Promise<TransactionResponse> => {
  if (!input.contractAddress) {
    throw new Error('AI anchor contract address is not configured');
  }

  const provider = await getBrowserProvider();
  const signer = await provider.getSigner();
  const contract = new Contract(input.contractAddress, AI_DECISION_ANCHOR_ABI, signer);

  return contract.anchorDecision(
    input.subjectAddress,
    input.inputHash,
    input.outputHash,
    input.modelVersionHash,
    input.riskScoreBps,
    input.confidenceBps,
    input.policyAction,
    input.metadataUri
  );
};

export const anchorDepinTelemetryOnchain = async (input: {
  contractAddress: string;
  subjectAddress: string;
  attestationRoot: string;
  attestationCount: number;
  healthScoreBps: number;
  confidenceBps: number;
  metadataUri: string;
}): Promise<TransactionResponse> => {
  if (!input.contractAddress) {
    throw new Error('DePIN anchor contract address is not configured');
  }

  const provider = await getBrowserProvider();
  const signer = await provider.getSigner();
  const contract = new Contract(input.contractAddress, DEPIN_ANCHOR_ABI, signer);

  return contract.anchorSubjectTelemetry(
    input.subjectAddress,
    input.attestationRoot,
    input.attestationCount,
    input.healthScoreBps,
    input.confidenceBps,
    input.metadataUri
  );
};
