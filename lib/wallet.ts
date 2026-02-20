import { BrowserProvider } from 'ethers';
import { ChainConfig } from '@/types/safety';

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(eventName: string, listener: (...args: unknown[]) => void): void;
  removeListener?(eventName: string, listener: (...args: unknown[]) => void): void;
}

const getTargetChainId = (chainIdOverride?: number): number => {
  if (chainIdOverride && chainIdOverride > 0) {
    return chainIdOverride;
  }

  const fromEnv = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 0);
  return Number.isFinite(fromEnv) ? fromEnv : 0;
};

const toHexChainId = (chainId: number): string => `0x${chainId.toString(16)}`;

const getProvider = (): Eip1193Provider | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return (window as Window & { ethereum?: Eip1193Provider }).ethereum ?? null;
};

export const isWalletInstalled = (): boolean => {
  return getProvider() !== null;
};

export const connectWallet = async (): Promise<string> => {
  const provider = getProvider();
  if (!provider) {
    throw new Error('Wallet extension not found');
  }

  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  if (!accounts.length) {
    throw new Error('No account returned by wallet');
  }

  return accounts[0];
};

export const getCurrentAccount = async (): Promise<string | null> => {
  const provider = getProvider();
  if (!provider) {
    return null;
  }

  const accounts = (await provider.request({ method: 'eth_accounts' })) as string[];
  return accounts[0] ?? null;
};

export const getCurrentChainId = async (): Promise<number | null> => {
  const provider = getProvider();
  if (!provider) {
    return null;
  }

  const chainIdHex = (await provider.request({ method: 'eth_chainId' })) as string;
  return Number.parseInt(chainIdHex, 16);
};

export const getBrowserProvider = async (): Promise<BrowserProvider> => {
  const provider = getProvider();
  if (!provider) {
    throw new Error('Wallet extension not found');
  }

  return new BrowserProvider(provider);
};

export const ensureTargetNetwork = async (config?: Partial<ChainConfig>): Promise<void> => {
  const provider = getProvider();
  if (!provider) {
    throw new Error('Wallet extension not found');
  }

  const targetChainId = getTargetChainId(config?.chainId);

  if (!targetChainId) {
    return;
  }

  const targetChainHex = toHexChainId(targetChainId);

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: targetChainHex }]
    });
  } catch {
    const rpcUrl = config?.rpcUrl ?? process.env.NEXT_PUBLIC_RPC_URL ?? '';
    if (!rpcUrl) {
      throw new Error('Target network not available in wallet. Set NEXT_PUBLIC_RPC_URL to auto-add it.');
    }

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: targetChainHex,
          chainName: config?.chainName ?? process.env.NEXT_PUBLIC_CHAIN_NAME ?? 'X1 EcoChain',
          nativeCurrency: {
            name: config?.chainCurrencySymbol ?? process.env.NEXT_PUBLIC_CHAIN_CURRENCY_SYMBOL ?? 'X1',
            symbol: config?.chainCurrencySymbol ?? process.env.NEXT_PUBLIC_CHAIN_CURRENCY_SYMBOL ?? 'X1',
            decimals: 18
          },
          rpcUrls: [rpcUrl],
          blockExplorerUrls: config?.chainExplorerUrl
            ? [config.chainExplorerUrl]
            : process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL
              ? [process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL]
            : []
        }
      ]
    });
  }
};

export const subscribeWalletEvents = (
  onAccountsChanged: (accounts: string[]) => void,
  onChainChanged: (chainIdHex: string) => void
): (() => void) => {
  const provider = getProvider();
  if (!provider || !provider.on || !provider.removeListener) {
    return () => undefined;
  }

  provider.on('accountsChanged', onAccountsChanged);
  provider.on('chainChanged', onChainChanged);

  return () => {
    provider.removeListener?.('accountsChanged', onAccountsChanged);
    provider.removeListener?.('chainChanged', onChainChanged);
  };
};
