import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const wallet = vi.hoisted(() => ({
  subscribeAccount:
    vi.fn<(observer: (address: string | undefined, error: unknown) => void) => () => void>(),
  getAccountAddress: vi.fn<() => Promise<string | undefined>>(),
  connectWallet: vi.fn<() => Promise<string | null>>(),
  disconnectWallet: vi.fn<() => Promise<void>>(),
  getBalance: vi.fn<(address: string) => Promise<string>>(),
  sendTezos: vi.fn<(receiver: string, amount: string, sender: string) => Promise<string>>(),
}));
vi.mock('./Wallet', () => wallet);
const address = 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb';

beforeEach(() => {
  vi.resetAllMocks();
  wallet.getAccountAddress.mockResolvedValue(undefined);
  wallet.subscribeAccount.mockImplementation((observer) => {
    let active = true;
    void wallet.getAccountAddress().then((value) => {
      if (active) observer(value, undefined);
    });
    return () => {
      active = false;
    };
  });
  wallet.connectWallet.mockResolvedValue(address);
  wallet.getBalance.mockResolvedValue('1.234567');
  wallet.disconnectWallet.mockResolvedValue(undefined);
});

it('restores the connected address and displays its exact balance', async () => {
  wallet.getAccountAddress.mockResolvedValue(address);
  render(<App />);
  expect(await screen.findByText(address)).toBeTruthy();
  expect(await screen.findByText('Balance: 1.234567 ꜩ')).toBeTruthy();
});

it('shows a rejected wallet connection and permits retry', async () => {
  const user = userEvent.setup();
  wallet.connectWallet.mockRejectedValueOnce(new Error('Connection rejected'));
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Connect wallet' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Connection rejected');
  await user.click(screen.getByRole('button', { name: 'Connect wallet' }));
  expect(await screen.findByText(address)).toBeTruthy();
});

it('preserves failed transfer input and prevents duplicate submissions while confirming', async () => {
  const user = userEvent.setup();
  wallet.getAccountAddress.mockResolvedValue(address);
  wallet.sendTezos.mockRejectedValueOnce(
    new Error('The transaction was included but execution failed.'),
  );
  render(<App />);
  const receiver = await screen.findByLabelText('Receiver address');
  const amount = screen.getByLabelText('Amount in XTZ');
  await user.type(receiver, address);
  await user.type(amount, '0.000001');
  await user.click(screen.getByRole('button', { name: 'Send test XTZ' }));
  expect(await screen.findByRole('alert')).toHaveProperty(
    'textContent',
    'The transaction was included but execution failed.',
  );
  expect(screen.queryByText(/Confirmed operation/)).toBeNull();
  expect(receiver).toHaveProperty('value', address);
  expect(amount).toHaveProperty('value', '0.000001');

  let confirm!: (hash: string) => void;
  wallet.sendTezos.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        confirm = resolve;
      }),
  );
  await user.click(screen.getByRole('button', { name: 'Send test XTZ' }));
  const pending = screen.getByRole('button', { name: 'Confirming transfer…' });
  expect(pending).toHaveProperty('disabled', true);
  const status = screen.getByText('Waiting for wallet approval and network confirmation…');
  expect(status.getAttribute('aria-live')).toBe('polite');
  expect(screen.getByRole('button', { name: 'Disconnect' })).toHaveProperty('disabled', true);
  await user.click(pending);
  expect(wallet.sendTezos).toHaveBeenCalledTimes(2);
  await act(async () => {
    confirm('op-confirmed');
  });
  expect(await screen.findByText('Confirmed operation: op-confirmed')).toBeTruthy();
  expect(amount).toHaveProperty('value', '');
});

it('does not display a stale balance after disconnecting', async () => {
  const user = userEvent.setup();
  wallet.getAccountAddress.mockResolvedValue(address);
  let resolveBalance!: (value: string) => void;
  wallet.getBalance.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveBalance = resolve;
      }),
  );
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Disconnect' }));
  await waitFor(() => expect(screen.queryByText(address)).toBeNull());
  await act(async () => {
    resolveBalance('999');
  });
  expect(screen.queryByText('Balance: 999 ꜩ')).toBeNull();
});

it('updates external account changes and ignores the old account balance', async () => {
  const second = 'tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6';
  wallet.getAccountAddress.mockResolvedValue(address);
  let resolveBalance!: (value: string) => void;
  wallet.getBalance.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveBalance = resolve;
      }),
  );
  render(<App />);
  const receiver = await screen.findByLabelText('Receiver address');
  const user = userEvent.setup();
  await user.type(receiver, address);
  const observer = wallet.subscribeAccount.mock.calls[0]?.[0];
  if (!observer) throw new Error('Missing account observer');
  await act(async () => {
    observer(second, undefined);
  });
  expect(await screen.findByText(second)).toBeTruthy();
  expect(receiver).toHaveProperty('value', '');
  expect(await screen.findByText('Balance: 1.234567 ꜩ')).toBeTruthy();
  await act(async () => {
    resolveBalance('999');
  });
  expect(screen.queryByText('Balance: 999 ꜩ')).toBeNull();
  expect(screen.getByText('Balance: 1.234567 ꜩ')).toBeTruthy();
  await act(async () => {
    observer(undefined, undefined);
  });
  expect(screen.queryByLabelText('Receiver address')).toBeNull();
  expect(screen.getByRole('button', { name: 'Connect wallet' })).toBeTruthy();
});

it.each(['success', 'failure'] as const)(
  'ignores a late transfer %s after the account changes away and back',
  async (outcome) => {
    wallet.getAccountAddress.mockResolvedValue(address);
    let complete!: (value: string) => void;
    let reject!: (reason: Error) => void;
    wallet.sendTezos.mockImplementationOnce(
      () =>
        new Promise((resolve, fail) => {
          complete = resolve;
          reject = fail;
        }),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.type(await screen.findByLabelText('Receiver address'), address);
    await user.type(screen.getByLabelText('Amount in XTZ'), '0.1');
    await user.click(screen.getByRole('button', { name: 'Send test XTZ' }));
    const observer = wallet.subscribeAccount.mock.calls[0]?.[0];
    if (!observer) throw new Error('Missing account observer');
    await act(async () => observer('tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6', undefined));
    await act(async () => observer(address, undefined));
    await screen.findByText('Balance: 1.234567 ꜩ');
    const reads = wallet.getBalance.mock.calls.length;
    await act(async () => {
      if (outcome === 'success') complete('old-operation');
      else reject(new Error('Old transfer failed'));
    });
    expect(screen.queryByText('Confirmed operation: old-operation')).toBeNull();
    expect(screen.queryByText('Old transfer failed')).toBeNull();
    expect(wallet.getBalance).toHaveBeenCalledTimes(reads);
    expect(screen.getByRole('button', { name: 'Send test XTZ' })).toHaveProperty('disabled', false);
  },
);

it.each(['success', 'failure'] as const)(
  'ignores a late connect %s after an external account update',
  async (outcome) => {
    let complete!: (value: string) => void;
    let reject!: (reason: Error) => void;
    wallet.connectWallet.mockImplementationOnce(
      () =>
        new Promise((resolve, fail) => {
          complete = resolve;
          reject = fail;
        }),
    );
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Connect wallet' }));
    const observer = wallet.subscribeAccount.mock.calls[0]?.[0];
    if (!observer) throw new Error('Missing account observer');
    const second = 'tz1aSkwEot3L2kmUvcoxzjMomb9mvBNuzFK6';
    await act(async () => observer(second, undefined));
    await act(async () => {
      if (outcome === 'success') complete(address);
      else reject(new Error('Old connection failed'));
    });
    expect(screen.getByText(second)).toBeTruthy();
    expect(screen.queryByText(address)).toBeNull();
    expect(screen.queryByText('Old connection failed')).toBeNull();
  },
);

it('retries a failed balance read without reconnecting the wallet', async () => {
  wallet.getAccountAddress.mockResolvedValue(address);
  wallet.getBalance.mockRejectedValueOnce(new Error('Balance request failed'));
  const user = userEvent.setup();
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Balance request failed');
  await user.click(screen.getByRole('button', { name: 'Retry balance' }));
  expect(await screen.findByText('Balance: 1.234567 ꜩ')).toBeTruthy();
  expect(screen.queryByText('Balance request failed')).toBeNull();
  expect(wallet.getBalance).toHaveBeenCalledTimes(2);
  expect(wallet.connectWallet).not.toHaveBeenCalled();
});

it('keeps the current account and input when account selection is cancelled', async () => {
  wallet.getAccountAddress.mockResolvedValue(address);
  wallet.connectWallet.mockResolvedValue(null);
  render(<App />);
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Receiver address'), address);
  await user.type(screen.getByLabelText('Amount in XTZ'), '0.5');
  await user.click(screen.getByRole('button', { name: 'Switch account' }));
  expect(screen.getByText(address)).toBeTruthy();
  expect(screen.getByLabelText('Amount in XTZ')).toHaveProperty('value', '0.5');
  expect(screen.getByLabelText('Receiver address')).toHaveProperty('value', address);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('button', { name: 'Switch account' })).toHaveProperty('disabled', false);
});

it('permits another connection after closing the chooser without an account', async () => {
  wallet.connectWallet.mockResolvedValueOnce(null);
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Connect wallet' }));
  expect(screen.queryByRole('alert')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Connect wallet' }));
  expect(await screen.findByText(address)).toBeTruthy();
});
