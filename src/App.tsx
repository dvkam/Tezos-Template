import { useEffect, useState } from "react";
import { getAccountAddress, switchAccount, unsync } from "./Wallet";

export function getShorterAccount(address: string) {
  const lastIndex = address.length;
  return (
    address.substring(0, 5) +
    "..." +
    address.substring(lastIndex - 5, lastIndex)
  );
}

function App() {
  const [walletAddress, setWalletAddress] = useState<string | undefined>(
    undefined
  );
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    getAccountAddress().then((address) => setWalletAddress(address));
  }, []);

  const handleWalletAction = () => {
    setError(undefined); // Clear any existing error message

    getAccountAddress().then((r) =>
      r
        ? unsync().then(() => setWalletAddress(undefined))
        : switchAccount()
            .then((address) => setWalletAddress(address))
            .catch(() => {
              alert(
                "An error occurred while switching accounts. Please refresh and try again."
              );
              // setError(
              //   "An error occurred while switching accounts. Please refresh and try again."
              // );
              setWalletAddress(undefined);
            })
    );
  };

  const handleSwitchAccount = async () => {
    setError(undefined); // Clear any existing error message

    try {
      const address = await switchAccount();
      setWalletAddress(address);
    } catch (error) {
      alert("An error occurred while switching accounts. Please try again.");
      //setError("An error occurred while switching accounts. Please try again.");
    }
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
        {/* {error && <p style={{ color: "red" }}>{error}</p>} */}
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
      </div>
    </div>
  );
}

export default App;
