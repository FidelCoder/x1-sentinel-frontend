import { Contract, TransactionResponse } from 'ethers';
import { getBrowserProvider } from './wallet';

const SAFETY_REGISTRY_ABI = [
  'function submitReport(address _targetAddress, string _ensName, uint8 _reason, string _evidence) external returns (uint256)'
];

interface SubmitReportInput {
  targetAddress: string;
  nameTag: string;
  reasonCode: number;
  evidence: string;
}

export const submitReportOnchain = async ({
  targetAddress,
  nameTag,
  reasonCode,
  evidence
}: SubmitReportInput): Promise<TransactionResponse> => {
  const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!contractAddress) {
    throw new Error('NEXT_PUBLIC_CONTRACT_ADDRESS is not configured');
  }

  const provider = await getBrowserProvider();
  const signer = await provider.getSigner();
  const contract = new Contract(contractAddress, SAFETY_REGISTRY_ABI, signer);

  return contract.submitReport(targetAddress, nameTag, reasonCode, evidence);
};
