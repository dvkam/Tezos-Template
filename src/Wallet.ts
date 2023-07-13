import { TezosToolkit } from "@taquito/taquito";
import { BeaconWallet } from "@taquito/beacon-wallet";
import { NetworkType } from "@airgap/beacon-sdk";

export const getNetworkType = () => {
  return NetworkType.GHOSTNET;
};

export const getNetworkRCP = () => {
  return "https://ghostnet.ecadinfra.com";
};

const tezos = new TezosToolkit(getNetworkRCP());
const beaconWallet = new BeaconWallet({
  name: "Example",
  preferredNetwork: getNetworkType(),
});
tezos.setWalletProvider(beaconWallet);

export const getAccountAddress = () =>
  beaconWallet.client
    .getActiveAccount()
    .then((r) => (r ? r.address : undefined));

export const isAccountSynced = () => {
  void getAccountAddress().then((r) => r !== undefined);
};

export const unsync = () => beaconWallet.clearActiveAccount();

export const sync = () =>
  beaconWallet.client
    .requestPermissions({ network: { type: getNetworkType() } })
    .then((permissions) => {
      return permissions.address;
    })
    .catch((e) => {
      void beaconWallet.clearActiveAccount();
      console.error("An error occurred while requesting permissions:", e);
      throw e;
      //return undefined; // Return a default value (e.g., undefined) in case of an error
    });

export const switchAccount = () => sync();

// export const balance = () => {
//   getAccountAddress().then((address) => {
//     if (address) {
//       return tezos.tz.getBalance(address);
//     } else {
//       throw new Error("No active account found");
//     }
//   });
//   .then((balance) => console.log(`${balance.toNumber() / 1000000} ꜩ`))
//   .catch((error) => console.log(JSON.stringify(error)));
// };

export const balance = () => {
  return getAccountAddress().then((address) => {
    if (address) {
      return tezos.tz.getBalance(address);
    } else {
      throw new Error("No active account found");
    }
  });
};
