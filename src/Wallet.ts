import { BeaconWallet } from '@taquito/beacon-wallet';
import { TezosToolkit } from '@taquito/taquito';
import { NetworkType, PermissionScope } from '@airgap/beacon-sdk';
export const getNetworkType = () => {
  return NetworkType.GHOSTNET;
};

export const getNetworkRPC = () => {
  return 'https://ghostnet.ecadinfra.com';
};

const tezos = new TezosToolkit(getNetworkRPC());
const wallet = new BeaconWallet({
  name: 'Example',
  preferredNetwork: getNetworkType(),
});
tezos.setWalletProvider(wallet);

export const getAccountAddress = async () => {
  const activeAccount = await wallet.client.getActiveAccount();
  return activeAccount?.address;
};

export const isAccountSynced = () => {
  void getAccountAddress().then((r) => r !== undefined);
};

export const unsync = () => wallet.clearActiveAccount();

export const sync = async (): Promise<string> => {
  try {
    await wallet.requestPermissions({
      scopes: [PermissionScope.OPERATION_REQUEST, PermissionScope.SIGN],
    });
    const activeAccount = await wallet.client.getActiveAccount();
    const address = activeAccount?.address;
    if (!address) {
      throw new Error('No address returned after requesting permissions');
    }
    return address;
  } catch (e) {
    console.error('An error occurred while requesting permissions:', e);
    await wallet.clearActiveAccount();
    if (e instanceof Error) throw e;
    throw new Error(String(e));
  }
};

export const switchAccount = () => sync();

export const balance = async () => {
  const address = await getAccountAddress();
  if (address) {
    return tezos.tz.getBalance(address);
  } else {
    throw new Error('No active account found');
  }
};

export const sendTezos = async (receiverAddress: string, amount: number) => {
  if (!receiverAddress || amount <= 0) {
    throw new Error('Invalid parameters for sending Tezos');
  }

  const address = await getAccountAddress();
  if (!address) {
    throw new Error('No active account found');
  }

  try {
    const operation = await tezos.wallet
      .transfer({
        to: receiverAddress,
        amount: amount,
      })
      .send();

    await operation.confirmation();
    return operation.opHash;
  } catch (error) {
    console.error('An error occurred while sending Tezos:', error);
    throw error;
  }
};
