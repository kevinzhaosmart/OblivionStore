import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Oblivion Store',
  projectId: '8f9f4a0abcae0e3c1c4e9be2dcbf5a21',
  chains: [sepolia],
  ssr: false,
});
