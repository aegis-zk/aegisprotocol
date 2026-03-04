import { http, createConfig } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';

export const config = createConfig({
  chains: [base, baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
