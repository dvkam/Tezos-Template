import { useEffect, useState } from "react";
import { getAccountAddress, sync, unsync } from "./Wallet";

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
        : sync()
            .then((address) => setWalletAddress(address))
            .catch(() => {
              setError("An error occurred while syncing. Please try again.");
              setWalletAddress(undefined);
            })
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
        <button onClick={handleWalletAction}>
          {walletAddress ? "Unsync" : "Sync"}
        </button>
        {error && <p style={{ color: "red" }}>{error}</p>}
        {walletAddress && (
          <>
            <p style={{ fontWeight: "normal" }}>Full Wallet Address: </p>
            <span style={{ fontWeight: "normal" }}>{walletAddress}</span>
          </>
        )}
        {walletAddress && (
          <>
            <p style={{ fontWeight: "bold" }}>
              In case you dont want to display the whole address:{" "}
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
