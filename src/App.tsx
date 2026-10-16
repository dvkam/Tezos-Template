import { useActionState, useEffect, useState } from 'react';
import {
  connectWallet,
  disconnectWallet,
  getAccountAddress,
  getBalance,
  sendTezos,
} from './Wallet';

type BalanceResult = { address: string; revision: number; value?: string; error?: string };
type TransferResult = {
  error: string | null;
  operation: string | null;
  address: string | undefined;
};
const initialTransfer: TransferResult = { error: null, operation: null, address: undefined };
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'The wallet request failed. Please try again.';

function App() {
  const [address, setAddress] = useState<string>();
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [balanceRevision, setBalanceRevision] = useState(0);
  const [balanceResult, setBalanceResult] = useState<BalanceResult>();
  const [receiver, setReceiver] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    let active = true;
    void getAccountAddress().then(
      (value) => {
        if (active) {
          setAddress(value);
          setRestoring(false);
        }
      },
      (error: unknown) => {
        if (active) {
          setRestoreError(errorMessage(error));
          setRestoring(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!address) return;
    let active = true;
    void getBalance(address).then(
      (value) => {
        if (active) setBalanceResult({ address, revision: balanceRevision, value });
      },
      (error: unknown) => {
        if (active)
          setBalanceResult({ address, revision: balanceRevision, error: errorMessage(error) });
      },
    );
    return () => {
      active = false;
    };
  }, [address, balanceRevision]);

  const [walletError, walletAction, walletPending] = useActionState(
    async (_previous: string | null, data: FormData): Promise<string | null> => {
      setRestoreError(null);
      try {
        if (data.get('intent') === 'disconnect') {
          await disconnectWallet();
          setAddress(undefined);
        } else {
          setAddress(await connectWallet());
          setBalanceRevision((value) => value + 1);
        }
        setReceiver('');
        setAmount('');
        return null;
      } catch (error) {
        return errorMessage(error);
      }
    },
    null,
  );

  const [transferResult, transferAction, transferPending] = useActionState(
    async (_previous: TransferResult, data: FormData): Promise<TransferResult> => {
      try {
        const receiverValue = data.get('receiver');
        const amountValue = data.get('amount');
        const operation = await sendTezos(
          typeof receiverValue === 'string' ? receiverValue : '',
          typeof amountValue === 'string' ? amountValue : '',
        );
        setBalanceRevision((value) => value + 1);
        setReceiver('');
        setAmount('');
        return { error: null, operation, address };
      } catch (error) {
        return { error: errorMessage(error), operation: null, address };
      }
    },
    initialTransfer,
  );

  const busy = restoring || walletPending || transferPending;
  const currentBalance =
    balanceResult && balanceResult.address === address && balanceResult.revision === balanceRevision
      ? balanceResult
      : undefined;

  return (
    <main className="wallet-app">
      <header>
        <p className="network">Ghostnet test network</p>
        <h1>Tezos wallet template</h1>
        <p>Connect a wallet, check its balance, and send test XTZ.</p>
      </header>
      <form action={walletAction} className="wallet-controls" aria-label="Wallet connection">
        {address ? (
          <>
            <button name="intent" value="disconnect" disabled={busy}>
              Disconnect
            </button>
            <button name="intent" value="connect" disabled={busy}>
              Switch account
            </button>
          </>
        ) : (
          <button name="intent" value="connect" disabled={busy}>
            {restoring ? 'Restoring wallet…' : walletPending ? 'Connecting…' : 'Connect wallet'}
          </button>
        )}
      </form>
      <output aria-live="polite" aria-atomic="true">
        {walletPending ? 'Waiting for wallet…' : ''}
      </output>
      {(restoreError || walletError) && <p role="alert">{restoreError || walletError}</p>}
      {address && (
        <section aria-labelledby="account-heading">
          <h2 id="account-heading">Your account</h2>
          <p className="address">{address}</p>
          <p aria-label="Short address">
            {address.slice(0, 5)}…{address.slice(-5)}
          </p>
          {currentBalance?.error ? (
            <p role="alert">{currentBalance.error}</p>
          ) : (
            <output>
              {currentBalance?.value === undefined
                ? 'Loading balance…'
                : `Balance: ${currentBalance.value} ꜩ`}
            </output>
          )}
          <form action={transferAction} aria-labelledby="send-heading">
            <h2 id="send-heading">Send test XTZ</h2>
            <label htmlFor="receiver">Receiver address</label>
            <input
              id="receiver"
              name="receiver"
              value={receiver}
              onChange={(event) => setReceiver(event.target.value)}
              required
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
            />
            <label htmlFor="amount">Amount in XTZ</label>
            <input
              id="amount"
              name="amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
              disabled={busy}
              autoComplete="off"
              aria-describedby="amount-help"
            />
            <p id="amount-help" className="hint">
              Use a positive amount with up to six decimal places.
            </p>
            <button type="submit" disabled={busy}>
              {transferPending ? 'Confirming transfer…' : 'Send test XTZ'}
            </button>
            {!transferPending && transferResult.address === address && transferResult.error && (
              <p role="alert">{transferResult.error}</p>
            )}
            <output className="operation" aria-live="polite" aria-atomic="true">
              {transferPending
                ? 'Waiting for wallet approval and network confirmation…'
                : transferResult.address === address && transferResult.operation
                  ? `Confirmed operation: ${transferResult.operation}`
                  : ''}
            </output>
          </form>
        </section>
      )}
    </main>
  );
}

export default App;
