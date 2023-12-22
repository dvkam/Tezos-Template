import { useEffect, useState } from "react";
import { getAccountAddress, switchAccount, unsync, balance, sendTezos } from "./Wallet";

function App() {
  const [walletAddress, setWalletAddress] = useState<string | undefined>(
    undefined
  );
  const [, setError] = useState<string | undefined>(undefined);

  const [balanceValue, setBalanceValue] = useState<number | undefined>(
    undefined
  );
  const [receiver, setReceiver] = useState('');
  const [amountToSend, setAmountToSend] = useState(0);

  useEffect(() => {
    void getAccountAddress().then((address) => setWalletAddress(address));
  }, []);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        if (walletAddress) {
          const balanceResult = await balance();
          setBalanceValue(balanceResult.toNumber() / 1000000);
        } else {
          setBalanceValue(undefined);
        }
      } catch (error) {
        console.log(error);
        setError(
          "An error occurred while fetching the balance. Please try again."
        );
      }
    };

    void fetchBalance();
  }, [walletAddress]);

  const handleWalletAction = () => {
    setError(undefined);

    void getAccountAddress().then((r) =>
      r
        ? unsync().then(() => setWalletAddress(undefined))
        : switchAccount()
            .then((address) => setWalletAddress(address))
            .catch(() => {
              alert(
                "An error occurred while switching accounts. Please try again."
              );
              setWalletAddress(undefined);
            })
    );
  };

  const handleSwitchAccount = (): void => {
    setError(undefined);

    switchAccount()
      .then((address) => {
        setWalletAddress(address);
      })
      .catch(() => {
        alert("An error occurred while switching accounts. Please try again.");
        setWalletAddress(undefined);
      });
  };

  const handleSendTezos = (): void => {
    sendTezos(receiver, amountToSend)
      .then((opHash) => {
        alert(`Transaction successful with operation hash: ${opHash}`);
      })
      .catch((error) => {
        console.error(error);
        setError("Transaction failed. Please try again.");
      });
  };

  const getShorterAccount = (address: string) => {
    const lastIndex = address.length;
    return (
      address.substring(0, 5) +
      "..." +
      address.substring(lastIndex - 5, lastIndex)
    );
  };

  return (
    <div
      style={{
        width: "100vw",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
        }}
      >
        <button
          style={{
            margin: "5px",
          }}
          onClick={handleWalletAction}
        >
          {walletAddress ? "Unsync" : "Sync"}
        </button>
        {walletAddress && (
          <button
            style={{
              margin: "5px",
            }}
            onClick={handleSwitchAccount}
          >
            Switch Account
          </button>
        )}
        {walletAddress && (
          <>
            <p style={{ fontWeight: "normal" }}>Full Wallet Address: </p>
            <span style={{ fontWeight: "normal" }}>{walletAddress}</span>
          </>
        )}
        {walletAddress && (
          <>
            <p style={{ fontWeight: "bold" }}>
              In case you don't want to display the whole address:{" "}
            </p>
            <span style={{ fontWeight: "bold" }}>
              {getShorterAccount(walletAddress)}
            </span>
          </>
        )}
        {walletAddress && (
          <>
            {balanceValue !== undefined ? (
              <p style={{ fontWeight: "bold" }}>Balance: {balanceValue} ꜩ</p>
            ) : (
              <p>Loading balance...</p>
            )}
          </>
        )}
        {walletAddress && (
          <>
        <div style={{ display: "flex", flexDirection: "column", border: '2px dashed black' }}>
          <p style={{ fontWeight: "bold", textAlign: "center" }}>Send Tezos ꜩ</p>
          <input
            type="text"
            value={receiver}
            onChange={(e) => setReceiver(e.target.value)}
            placeholder="Receiver Address"
            style={{ margin: "5px", width: "250px", height: "30px" }}
          />
          <input
            type="number"
            value={amountToSend}
            onChange={(e) => setAmountToSend(parseFloat(e.target.value))}
            placeholder="Amount to Send ꜩ"
            style={{ margin: "5px", width: "250px", height: "30px" }}
          />
        </div>
        <button 
          style={{ margin: "5px" }}
          onClick={handleSendTezos}
          >
            Send Tezos</button>
          </>
      )}
      </div>
    </div>
  );
}

export default App;
