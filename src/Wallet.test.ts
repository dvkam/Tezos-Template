import { beforeEach, expect, it, vi } from 'vitest';
import {
  connectWallet,
  disconnectWallet,
  getAccountAddress,
  sendTezos,
  subscribeAccount,
} from './Wallet';

const mocks = vi.hoisted(() => ({
  options: undefined as
    | { eventHandlers?: Record<string, { handler: () => Promise<void> }> }
    | undefined,
  account: vi.fn(),
  subscribe: vi.fn(),
  permissions: vi.fn(),
  clear: vi.fn(),
  disconnect: vi.fn(),
  transfer: vi.fn(),
  send: vi.fn(),
  confirm: vi.fn(),
  status: vi.fn(),
}));
vi.mock('@taquito/beacon-wallet', () => ({
  BeaconEvent: {
    ACTIVE_ACCOUNT_SET: 'ACTIVE_ACCOUNT_SET',
    PERMISSION_REQUEST_ERROR: 'PERMISSION_REQUEST_ERROR',
  },
  BeaconWallet: class {
    constructor(options: { eventHandlers?: Record<string, { handler: () => Promise<void> }> }) {
      mocks.options = options;
    }
    client = { getActiveAccount: mocks.account, subscribeToEvent: mocks.subscribe };
    requestPermissions = mocks.permissions;
    clearActiveAccount = mocks.clear;
    disconnect = mocks.disconnect;
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
  mocks.account.mockResolvedValue({ address, network: { type: 'shadownet' } });
  mocks.permissions.mockResolvedValue(undefined);
  mocks.disconnect.mockResolvedValue(undefined);
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

it.each(['mainnet', 'ghostnet'])(
  'rejects %s accounts before constructing a transfer',
  async (network) => {
    mocks.account.mockResolvedValue({ address, network: { type: network } });
    await expect(getAccountAddress()).rejects.toThrow(/Shadownet/);
    await expect(sendTezos(address, '1', address)).rejects.toThrow(/Shadownet/);
    expect(mocks.transfer).not.toHaveBeenCalled();
  },
);

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
  changed({ address, network: { type: 'shadownet' } });
  expect(observer).not.toHaveBeenCalled();
  const next = vi.fn();
  const stopNext = subscribeAccount(next);
  await vi.waitFor(() => expect(next).toHaveBeenCalledWith(address, undefined));
  expect(mocks.subscribe).toHaveBeenCalledOnce();
  stopNext();
});

it('ends the wallet session through the reconnectable disconnect API', async () => {
  await disconnectWallet();
  expect(mocks.disconnect).toHaveBeenCalledOnce();
  expect(mocks.clear).not.toHaveBeenCalled();
  await expect(connectWallet()).resolves.toBe(address);
});

it('treats the SDK non-Error abort as cancelled account selection', async () => {
  mocks.permissions.mockRejectedValueOnce({
    name: 'UnknownBeaconError',
    title: 'Aborted',
    message: '[ABORTED_ERROR]:The action was aborted by the user.',
  });
  await expect(connectWallet()).resolves.toBeNull();
  expect(mocks.account).not.toHaveBeenCalled();
  expect(mocks.disconnect).not.toHaveBeenCalled();
});

it('preserves real permission failures for the application', async () => {
  mocks.permissions.mockRejectedValueOnce({
    message: '[NETWORK_NOT_SUPPORTED]:Select a supported network.',
  });
  await expect(connectWallet()).rejects.toThrow('Select a supported network.');
});

it('lets the app handle permission errors without overriding the pairing UI', async () => {
  expect(Object.keys(mocks.options?.eventHandlers ?? {})).toEqual(['PERMISSION_REQUEST_ERROR']);
  const handler = mocks.options?.eventHandlers?.['PERMISSION_REQUEST_ERROR']?.handler;
  if (!handler) throw new Error('Missing permission error handler');
  await expect(handler()).resolves.toBeUndefined();
});

it('normalizes non-Error permission failures and retains their cause', async () => {
  const cause = { message: '[NETWORK_NOT_SUPPORTED]:Select a supported network.' };
  mocks.permissions.mockRejectedValueOnce(cause);
  const failure: unknown = await connectWallet().catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(Error);
  expect(failure).toHaveProperty('cause', cause);
});
