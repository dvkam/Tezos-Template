import { BeaconWallet } from '@taquito/beacon-wallet';
import { TezosToolkit } from '@taquito/taquito';
import { NetworkType, PermissionScope } from '@airgap/beacon-sdk';
import { parseTransfer } from './transfer';

const rpcUrl = 'https://ghostnet.ecadinfra.com';
const tezos = new TezosToolkit(rpcUrl);
const wallet = new BeaconWallet({ name: 'Tezos Template', preferredNetwork: NetworkType.GHOSTNET });
tezos.setWalletProvider(wallet);

export async function getAccountAddress() {
  const account = await wallet.client.getActiveAccount();
  if (account && account.network.type !== NetworkType.GHOSTNET) {
    throw new Error('Select a Ghostnet wallet account to use this test-network template.');
  }
  return account?.address;
}

export async function connectWallet() {
  await wallet.requestPermissions({
    scopes: [PermissionScope.OPERATION_REQUEST],
  });
  const address = await getAccountAddress();
  if (!address) throw new Error('The wallet did not return an account address.');
  return address;
}

export const disconnectWallet = () => wallet.clearActiveAccount();

export async function getBalance(address: string) {
  return (await tezos.tz.getBalance(address)).dividedBy(1_000_000).toFixed();
}

export async function sendTezos(receiver: string, amount: string) {
  const transfer = parseTransfer(receiver, amount);
  if (!(await getAccountAddress())) throw new Error('Connect a wallet before sending test XTZ.');
  const operation = await tezos.wallet.transfer(transfer).send();
  await operation.confirmation();
  return operation.opHash;
}
