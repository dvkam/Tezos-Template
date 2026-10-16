import { beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const wallet = vi.hoisted(() => ({
  getAccountAddress: vi.fn<() => Promise<string | undefined>>(),
  connectWallet: vi.fn<() => Promise<string>>(),
  disconnectWallet: vi.fn<() => Promise<void>>(),
  getBalance: vi.fn<(address: string) => Promise<string>>(),
  sendTezos: vi.fn<(receiver: string, amount: string) => Promise<string>>(),
}));
vi.mock('./Wallet', () => wallet);
const address = 'tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb';

beforeEach(() => {
  vi.resetAllMocks();
  wallet.getAccountAddress.mockResolvedValue(undefined);
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
