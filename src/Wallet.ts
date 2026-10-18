import { BeaconWallet, BeaconEvent } from '@taquito/beacon-wallet';
import { NetworkType, PermissionScope } from '@taquito/beacon-wallet/types';
import { TezosToolkit } from '@taquito/taquito';
import { parseTransfer } from './transfer';

const rpcUrl = 'https://tezos-shadownet.octez.io';
const tezos = new TezosToolkit(rpcUrl);
const wallet = new BeaconWallet({
  name: 'Tezos Template',
  preferredNetwork: NetworkType.SHADOWNET,
  eventHandlers: {
    // Permission errors are handled by the app, including a cancelled chooser.
    [BeaconEvent.PERMISSION_REQUEST_ERROR]: { handler: () => Promise.resolve() },
  },
});
tezos.setWalletProvider(wallet);

type ActiveAccount = Awaited<ReturnType<typeof wallet.client.getActiveAccount>>;

function accountAddress(account: ActiveAccount) {
  if (account && account.network.type !== NetworkType.SHADOWNET) {
    throw new Error('Select a Shadownet wallet account to use this test-network template.');
  }
  return account?.address;
}

export async function getAccountAddress() {
  return accountAddress(await wallet.client.getActiveAccount());
}

type AccountObserver = (address: string | undefined, error: unknown) => void;
const accountObservers = new Set<AccountObserver>();
let accountSubscription: Promise<void> | undefined;
let accountRevision = 0;

// Beacon has no public unsubscribe API; share one SDK listener across React mounts.
export function subscribeAccount(observer: AccountObserver) {
  accountObservers.add(observer);
  accountSubscription ??= wallet.client.subscribeToEvent(
    BeaconEvent.ACTIVE_ACCOUNT_SET,
    (account: ActiveAccount) => {
      accountRevision += 1;
      let address: string | undefined;
      let error: unknown;
      try {
        address = accountAddress(account);
      } catch (cause) {
        error = cause;
      }
      for (const listener of accountObservers) listener(address, error);
    },
  );
  void accountSubscription.then(
    async () => {
      const revision = accountRevision;
      try {
        const address = await getAccountAddress();
        if (accountObservers.has(observer) && revision === accountRevision)
          observer(address, undefined);
      } catch (error) {
        if (accountObservers.has(observer) && revision === accountRevision)
          observer(undefined, error);
      }
    },
    (error: unknown) => {
      accountSubscription = undefined;
      if (accountObservers.has(observer)) observer(undefined, error);
    },
  );
  return () => {
    accountObservers.delete(observer);
  };
}

export async function connectWallet(): Promise<string | null> {
  try {
    await wallet.requestPermissions({
      scopes: [PermissionScope.OPERATION_REQUEST],
    });
  } catch (cause) {
    // Beacon errors have a message but do not extend the JavaScript Error class.
    const message =
      cause && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string'
        ? cause.message
        : undefined;
    if (message?.startsWith('[ABORTED_ERROR]:')) return null;
    if (message) throw new Error(message, { cause });
    throw cause;
  }
  const address = await getAccountAddress();
  if (!address) throw new Error('The wallet did not return an account address.');
  return address;
}

export const disconnectWallet = () => wallet.disconnect();

export async function getBalance(address: string) {
  return (await tezos.tz.getBalance(address)).dividedBy(1_000_000).toFixed();
}

export async function sendTezos(receiver: string, amount: string, sender: string) {
  const transfer = parseTransfer(receiver, amount);
  const activeAddress = await getAccountAddress();
  if (!activeAddress) throw new Error('Connect a wallet before sending test XTZ.');
  if (activeAddress !== sender)
    throw new Error('The wallet account changed. Review the account before sending again.');
  const operation = await tezos.wallet.transfer(transfer).send();
  await operation.confirmation();
  const status = await operation.status();
  if (status !== 'applied')
    throw new Error(`The transaction was included but execution ${status}.`);
  return operation.opHash;
}
