import { BrowserProvider } from 'ethers';
import { ChainConfig } from '@/types/safety';

export type WalletProviderId = 'metamask' | 'trust' | 'injected';

interface WalletOption {
  id: WalletProviderId;
  label: string;
  description: string;
  installed: boolean;
}

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | Record<string, unknown> }): Promise<unknown>;
  on?(eventName: 'accountsChanged', listener: (accounts: string[]) => void): void;
  on?(eventName: 'chainChanged', listener: (chainIdHex: string) => void): void;
  removeListener?(eventName: 'accountsChanged', listener: (accounts: string[]) => void): void;
  removeListener?(eventName: 'chainChanged', listener: (chainIdHex: string) => void): void;
  providers?: Eip1193Provider[];
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
}

const getTargetChainId = (chainIdOverride?: number): number => {
  if (chainIdOverride && chainIdOverride > 0) {
    return chainIdOverride;
  }

  const fromEnv = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 0);
  return Number.isFinite(fromEnv) ? fromEnv : 0;
};

const toHexChainId = (chainId: number): string => `0x${chainId.toString(16)}`;

const walletLabel = (wallet: WalletProviderId): string => {
  switch (wallet) {
    case 'metamask':
      return 'MetaMask';
    case 'trust':
      return 'Trust Wallet';
    default:
      return 'Injected Wallet';
  }
};

const getRootProvider = (): Eip1193Provider | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return (window as Window & { ethereum?: Eip1193Provider }).ethereum ?? null;
};

const getInjectedProviders = (): Eip1193Provider[] => {
  const root = getRootProvider();
  if (!root) {
    return [];
  }

  if (Array.isArray(root.providers) && root.providers.length > 0) {
    return root.providers;
  }

  return [root];
};

const isTrustProvider = (provider: Eip1193Provider): boolean => {
  return Boolean(provider.isTrust || provider.isTrustWallet);
};

const isMetaMaskProvider = (provider: Eip1193Provider): boolean => {
  return Boolean(provider.isMetaMask) && !isTrustProvider(provider);
};

const getProviderById = (wallet: WalletProviderId): Eip1193Provider | null => {
  const providers = getInjectedProviders();

  if (!providers.length) {
    return null;
  }

  if (wallet === 'metamask') {
    return providers.find(isMetaMaskProvider) ?? null;
  }

  if (wallet === 'trust') {
    return providers.find(isTrustProvider) ?? null;
  }

  return providers[0] ?? null;
};

let activeWallet: WalletProviderId = 'injected';

const getProvider = (): Eip1193Provider | null => {
  const preferred = getProviderById(activeWallet);
  if (preferred) {
    return preferred;
  }

  return getProviderById('injected');
};

export const getWalletOptions = (): WalletOption[] => {
  const providers = getInjectedProviders();
  const hasMetaMask = providers.some(isMetaMaskProvider);
  const hasTrustWallet = providers.some(isTrustProvider);
  const hasInjected = providers.length > 0;

  return [
    {
      id: 'metamask',
      label: 'MetaMask',
      description: 'Browser extension wallet',
      installed: hasMetaMask
    },
    {
      id: 'trust',
      label: 'Trust Wallet',
      description: 'Injected Trust Wallet provider',
      installed: hasTrustWallet
    },
    {
      id: 'injected',
      label: 'Other Wallet',
      description: 'Any injected EVM wallet',
      installed: hasInjected
    }
  ];
};

export const isWalletInstalled = (): boolean => {
  return getInjectedProviders().length > 0;
};

export const connectWallet = async (wallet: WalletProviderId = 'injected'): Promise<string> => {
  const provider = getProviderById(wallet);
  if (!provider) {
    throw new Error(`${walletLabel(wallet)} not found in this browser`);
  }

  activeWallet = wallet;

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
