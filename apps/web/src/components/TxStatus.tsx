import { useAccount } from 'wagmi';

interface TxStatusProps {
  hash?: string;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  error?: Error | null;
}

const EXPLORER: Record<number, string> = {
  8453: 'https://basescan.org',
};

export function TxStatus({ hash, isPending, isConfirming, isSuccess, error }: TxStatusProps) {
  const { chain } = useAccount();
  const explorerUrl = chain?.id ? EXPLORER[chain.id] : undefined;

  function TxLink({ txHash }: { txHash: string }) {
    if (explorerUrl) {
      return (
        <a
          href={`${explorerUrl}/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="tx-hash mt-1"
          style={{ display: 'block', textDecoration: 'none' }}
        >
          {txHash.slice(0, 10)}...{txHash.slice(-8)} ↗
        </a>
      );
    }
    return <div className="tx-hash mt-1">{txHash}</div>;
  }

  if (error) {
    return (
      <div className="alert alert-error">
        {error.message.includes('User rejected')
          ? 'Transaction rejected by user'
          : error.message.length > 120
            ? error.message.slice(0, 120) + '...'
            : error.message}
      </div>
    );
  }

  if (isPending) {
    return (
      <div className="alert alert-info">
        <span className="spinner" /> Waiting for wallet confirmation...
      </div>
    );
  }

  if (isConfirming && hash) {
    return (
      <div className="alert alert-info">
        <span className="spinner" /> Transaction submitted. Waiting for confirmation...
        <TxLink txHash={hash} />
      </div>
    );
  }

  if (isSuccess && hash) {
    return (
      <div className="alert alert-success">
        Transaction confirmed!
        <TxLink txHash={hash} />
      </div>
    );
  }

  return null;
}
