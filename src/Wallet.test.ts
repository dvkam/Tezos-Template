import { beforeEach, expect, it, vi } from 'vitest';
import { connectWallet, getAccountAddress, sendTezos, subscribeAccount } from './Wallet';

const mocks = vi.hoisted(() => ({
  account: vi.fn(),
  subscribe: vi.fn(),
  permissions: vi.fn(),
  clear: vi.fn(),
  transfer: vi.fn(),
  send: vi.fn(),
  confirm: vi.fn(),
  status: vi.fn(),
}));
vi.mock('@airgap/beacon-sdk', () => ({
  NetworkType: { GHOSTNET: 'ghostnet' },
  BeaconEvent: { ACTIVE_ACCOUNT_SET: 'ACTIVE_ACCOUNT_SET' },
  PermissionScope: { OPERATION_REQUEST: 'operation_request' },
}));
vi.mock('@taquito/beacon-wallet', () => ({
  BeaconWallet: class {
    client = { getActiveAccount: mocks.account, subscribeToEvent: mocks.subscribe };
    requestPermissions = mocks.permissions;
    clearActiveAccount = mocks.clear;
  },
}));
vi.mock('@taquito/taquito', () => ({
  TezosToolkit: class {
    wallet = { transfer: mocks.transfer };
    setWalletProvider() {}
  },
}));
const address = 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.account.mockResolvedValue({ address, network: { type: 'ghostnet' } });
  mocks.permissions.mockResolvedValue(undefined);
  mocks.subscribe.mockResolvedValue(undefined);
  mocks.transfer.mockReturnValue({ send: mocks.send });
  mocks.send.mockResolvedValue({
    opHash: 'op-confirmed',
    confirmation: mocks.confirm,
    status: mocks.status,
  });
  mocks.confirm.mockResolvedValue(undefined);
  mocks.status.mockResolvedValue('applied');
});

it('rejects accounts from another network before constructing a transfer', async () => {
  mocks.account.mockResolvedValue({ address, network: { type: 'mainnet' } });
  await expect(getAccountAddress()).rejects.toThrow(/Ghostnet/);
  await expect(sendTezos(address, '1', address)).rejects.toThrow(/Ghostnet/);
  expect(mocks.transfer).not.toHaveBeenCalled();
});

it('rejects invalid or disconnected transfers before asking the wallet to send', async () => {
  await expect(sendTezos(address, 'NaN', address)).rejects.toThrow();
  expect(mocks.account).not.toHaveBeenCalled();
  mocks.account.mockResolvedValue(undefined);
  await expect(sendTezos(address, '1', address)).rejects.toThrow(/Connect a wallet/);
  expect(mocks.transfer).not.toHaveBeenCalled();
});

it('sends the exact mutez value and resolves only after confirmation', async () => {
  let confirm!: () => void;
  mocks.confirm.mockReturnValue(
    new Promise<void>((resolve) => {
      confirm = resolve;
    }),
  );
  const result = sendTezos(address, '0.000001', address);
  let settled = false;
  void result.then(() => {
    settled = true;
  });
  await vi.waitFor(() => expect(mocks.confirm).toHaveBeenCalledOnce());
  expect(mocks.transfer).toHaveBeenCalledWith({ to: address, amount: 1, mutez: true });
  expect(settled).toBe(false);
  confirm();
  await expect(result).resolves.toBe('op-confirmed');
});

it('reports a permission request that returned no account', async () => {
  mocks.account.mockResolvedValue(undefined);
  await expect(connectWallet()).rejects.toThrow(/did not return/);
});

it.each(['failed', 'backtracked', 'skipped'])(
  'rejects an included transaction with %s execution',
  async (status) => {
    mocks.status.mockResolvedValue(status);
    await expect(sendTezos(address, '1', address)).rejects.toThrow(`execution ${status}`);
  },
);

it('rejects a transfer when the active account differs from the displayed sender', async () => {
  await expect(sendTezos(address, '1', 'another-account')).rejects.toThrow(/account changed/);
  expect(mocks.transfer).not.toHaveBeenCalled();
});

it('observes account changes, validates their network, and cleans up without duplicate SDK subscriptions', async () => {
  const observer = vi.fn();
  const stop = subscribeAccount(observer);
  await vi.waitFor(() => expect(observer).toHaveBeenCalledWith(address, undefined));
  const changed = mocks.subscribe.mock.calls[0]?.[1] as (account: unknown) => void;
  changed(undefined);
  expect(observer).toHaveBeenLastCalledWith(undefined, undefined);
  changed({ address, network: { type: 'mainnet' } });
  expect(observer).toHaveBeenLastCalledWith(undefined, expect.any(Error));
  stop();
  observer.mockClear();
  changed({ address, network: { type: 'ghostnet' } });
  expect(observer).not.toHaveBeenCalled();
  const next = vi.fn();
  const stopNext = subscribeAccount(next);
  await vi.waitFor(() => expect(next).toHaveBeenCalledWith(address, undefined));
  expect(mocks.subscribe).toHaveBeenCalledOnce();
  stopNext();
});
