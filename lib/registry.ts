import { Contract, TransactionResponse } from 'ethers';
import { getBrowserProvider } from './wallet';

const SAFETY_REGISTRY_ABI = [
  'function submitReport(address _targetAddress, string _nameTag, uint8 _reason, string _evidence) external returns (uint256)',
  'function voteOnReport(uint256 _reportId, bool _upvote) external',
  'function resolveReport(uint256 _reportId, bool _malicious) external'
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
