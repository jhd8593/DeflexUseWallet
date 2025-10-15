import { useCallback, useState, useEffect } from "react";
import algosdk from "algosdk";
import { useWallet } from "@txnlab/use-wallet-react";

import { WalletButton } from "@txnlab/use-wallet-ui-react";

const VESTIGE_API_BASE =
  import.meta.env.VITE_VESTIGE_API_BASE || "https://api.vestigelabs.org";
const DEFLEX_API_BASE =
  import.meta.env.VITE_DEFLEX_API_BASE || "https://deflex.txnlab.dev/api";
const API_KEY = import.meta.env.VITE_API_KEY || "";
const ALGOD_URI =
  import.meta.env.VITE_ALGOD_URI || "https://mainnet-api.algonode.cloud";
const ALGOD_PORT = parseInt(import.meta.env.VITE_ALGOD_PORT || "443", 10);

if (!API_KEY) {
  console.warn(
    "API key is not set. Please add VITE_API_KEY to your .env file."
  );
}

function TokenSwap() {
  const { activeAddress, algodClient, transactionSigner } = useWallet();

  const [sellSearchQuery, setSellSearchQuery] = useState("");
  const [sellSearchResults, setSellSearchResults] = useState([]);
  const [isSellSearching, setIsSellSearching] = useState(false);
  const [showSellSearchResults, setShowSellSearchResults] = useState(false);
  const [buySearchQuery, setBuySearchQuery] = useState("");
  const [buySearchResults, setBuySearchResults] = useState([]);
  const [isBuySearching, setIsBuySearching] = useState(false);
  const [showBuySearchResults, setShowBuySearchResults] = useState(false);
  const [sellAsset, setSellAsset] = useState({
    id: 0,
    name: "ALGO",
    image: "https://asa-list.tinyman.org/assets/0/icon.png",
  });
  const [buyAsset, setBuyAsset] = useState({
    id: null,
    name: "",
    image: null,
  });
  const [sellAmount, setSellAmount] = useState("0.000000");
  const [buyAmount, setBuyAmount] = useState("0.000000");
  const [slippage, setSlippage] = useState(1);
  const [isLoadingQuote, setIsLoadingQuote] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [completedSwaps, setCompletedSwaps] = useState([]);
  const [quoteInfo, setQuoteInfo] = useState(null);
  const [walletBalances, setWalletBalances] = useState({});
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  const fetchWalletBalances = useCallback(async (address) => {
    if (!address) return;

    setIsLoadingBalances(true);
    try {
      const response = await fetch(
        `${VESTIGE_API_BASE}/wallets/${address}/value?network_id=0&denominating_asset_id=0`
      );
      const data = await response.json();

      if (data && data.balances) {
        setWalletBalances(data.balances);
      }
    } catch (error) {
      // Error fetching wallet balances
      setWalletBalances({});
    } finally {
      setIsLoadingBalances(false);
    }
  }, []);

  const searchTokens = useCallback(async (query, isSell = false) => {
    if (!query.trim()) {
      if (isSell) {
        setSellSearchResults([]);
        setShowSellSearchResults(false);
      } else {
        setBuySearchResults([]);
        setShowBuySearchResults(false);
      }
      return;
    }

    if (isSell) {
      setIsSellSearching(true);
    } else {
      setIsBuySearching(true);
    }

    try {
      const params = new URLSearchParams({
        network_id: "0",
        query: query.trim(),
        denominating_asset_id: "31566704",
        limit: "10",
        order_by: "rank",
        order_dir: "asc",
      });

      const response = await fetch(
        `${VESTIGE_API_BASE}/assets/search?${params}`
      );
      const data = await response.json();

      if (isSell) {
        setSellSearchResults(data.results || []);
        setShowSellSearchResults(true);
      } else {
        setBuySearchResults(data.results || []);
        setShowBuySearchResults(true);
      }
    } catch (error) {
      // Search error occurred
      if (isSell) {
        setSellSearchResults([]);
        setShowSellSearchResults(false);
      } else {
        setBuySearchResults([]);
        setShowBuySearchResults(false);
      }
    } finally {
      if (isSell) {
        setIsSellSearching(false);
      } else {
        setIsBuySearching(false);
      }
    }
  }, []);

  const handleSellSearchInputChange = useCallback(
    (event) => {
      const value = event.target.value;
      setSellSearchQuery(value);

      const timeoutId = setTimeout(() => {
        searchTokens(value, true);
      }, 500);

      return () => clearTimeout(timeoutId);
    },
    [searchTokens]
  );

  const handleBuySearchInputChange = useCallback(
    (event) => {
      const value = event.target.value;
      setBuySearchQuery(value);

      const timeoutId = setTimeout(() => {
        searchTokens(value, false);
      }, 500);

      return () => clearTimeout(timeoutId);
    },
    [searchTokens]
  );

  const selectToken = useCallback((asset, isSell = false) => {
    const tokenData = {
      id: asset.id,
      name: asset.ticker || asset.name || `ASA ${asset.id}`,
      image: asset.image,
    };

    if (isSell) {
      setSellAsset(tokenData);
      setShowSellSearchResults(false);
      setSellSearchQuery("");
    } else {
      setBuyAsset(tokenData);
      setShowBuySearchResults(false);
      setBuySearchQuery("");
    }
  }, []);

  const swapAssets = () => {
    const tempAsset = sellAsset;
    setSellAsset(buyAsset);
    setBuyAsset(tempAsset);

    const tempAmount = sellAmount;
    setSellAmount(buyAmount);
    setBuyAmount(tempAmount);
  };

  // Fetch balances when account address changes
  useEffect(() => {
    if (activeAddress) {
      fetchWalletBalances(activeAddress);
    }
  }, [activeAddress, fetchWalletBalances]);

  const fetchQuote = useCallback(
    async (sellAssetId, buyAssetId, amount) => {
      if (!amount || parseFloat(amount) <= 0) {
        setBuyAmount("0.000000");
        setQuoteInfo(null);
        return;
      }

      setIsLoadingQuote(true);
      try {
        const params = new URLSearchParams({
          chain: "mainnet",
          algodUri: ALGOD_URI,
          algodToken: "",
          algodPort: ALGOD_PORT.toString(),
          amount: Math.floor(parseFloat(amount) * 1000000).toString(),
          type: "fixed-input",
          fromASAID: sellAssetId.toString(),
          toASAID: buyAssetId.toString(),
          apiKey: API_KEY,
          maxGroupSize: "13",
          atomicOnly: "false",
          referrer: "",
        });

        const response = await fetch(`${DEFLEX_API_BASE}/fetchQuote?${params}`);
        const data = await response.json();

        if (data && data.quote) {
          const buyAmountCalculated = data.quote / 1000000;
          setBuyAmount(buyAmountCalculated.toFixed(6));

          // Calculate price information
          const sellAmountNum = parseFloat(amount);
          const buyAmountNum = buyAmountCalculated;

          // Price per unit (how much buy token you get per 1 sell token)
          const pricePerUnit = buyAmountNum / sellAmountNum;

          // If selling ALGO, show how much ALGO the buy amount is worth
          // If buying ALGO, show how much ALGO you're getting
          let algoEquivalent = null;
          if (sellAssetId === 0) {
            // Selling ALGO - show how much ALGO the received tokens are worth
            algoEquivalent = {
              amount: sellAmountNum,
              label: `${buyAmountCalculated.toFixed(6)} ${
                buyAsset.name
              } ≈ ${sellAmountNum.toFixed(6)} ALGO`,
            };
          } else if (buyAssetId === 0) {
            // Buying ALGO - show how much ALGO you're getting
            algoEquivalent = {
              amount: buyAmountNum,
              label: `${sellAmountNum.toFixed(6)} ${
                sellAsset.name
              } ≈ ${buyAmountNum.toFixed(6)} ALGO`,
            };
          } else {
            // Neither is ALGO - show exchange rate
            algoEquivalent = {
              amount: pricePerUnit,
              label: `1 ${sellAsset.name} = ${pricePerUnit.toFixed(6)} ${
                buyAsset.name
              }`,
            };
          }

          setQuoteInfo({
            pricePerUnit: pricePerUnit,
            algoEquivalent: algoEquivalent,
            sellAmount: sellAmountNum,
            buyAmount: buyAmountNum,
            sellAsset: sellAsset.name,
            buyAsset: buyAsset.name,
          });
        }
      } catch (error) {
        setBuyAmount("0.000000");
        setQuoteInfo(null);
      } finally {
        setIsLoadingQuote(false);
      }
    },
    [sellAsset.name, buyAsset.name]
  );

  const handleSellAmountChange = useCallback(
    (value) => {
      // Treat empty string as 0
      const numericValue = value === "" ? "0.000000" : value;
      setSellAmount(numericValue);

      // Debounce the quote fetching
      const timeoutId = setTimeout(() => {
        if (
          sellAsset.id !== undefined &&
          buyAsset.id !== undefined &&
          buyAsset.id !== null
        ) {
          fetchQuote(sellAsset.id, buyAsset.id, numericValue);
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    },
    [sellAsset.id, buyAsset.id, fetchQuote]
  );

  const getCurrentBalance = useCallback(
    (assetId) => {
      if (
        !walletBalances ||
        Object.keys(walletBalances).length === 0 ||
        assetId === null ||
        assetId === undefined
      ) {
        return 0;
      }

      const balance = walletBalances[assetId.toString()];
      return balance ? parseFloat(balance) : 0;
    },
    [walletBalances]
  );

  const handlePercentageClick = (percentage) => {
    const currentBalance = getCurrentBalance(sellAsset.id);
    let amount;

    if (percentage === "MAX") {
      amount = currentBalance;
    } else {
      const percentValue = parseInt(percentage) / 100;
      amount = currentBalance * percentValue;
    }

    const amountStr = amount.toFixed(6);
    setSellAmount(amountStr);

    if (sellAsset.id !== undefined && buyAsset.id !== undefined) {
      fetchQuote(sellAsset.id, buyAsset.id, amountStr);
    }
  };

  const isOptedIntoAsset = async (address, assetId) => {
    try {
      const accountInfo = await algodClient.accountInformation(address).do();
      return (
        accountInfo.assets &&
        accountInfo.assets.some((asset) => asset["asset-id"] === assetId)
      );
    } catch (error) {
      return false;
    }
  };

  const handleAssetOptIn = async (assetId) => {
    if (!activeAddress) {
      return false;
    }

    try {
      const isOptedIn = await isOptedIntoAsset(activeAddress, assetId);
      if (isOptedIn) {
        return true;
      }

      const suggestedParams = await algodClient.getTransactionParams().do();

      const optInTransaction =
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: activeAddress,
          receiver: activeAddress,
          amount: 0,
          assetIndex: assetId,
          suggestedParams,
        });

      const signedOptIn = async () => {
        const atc = new algosdk.AtomicTransactionComposer();
        atc.addTransaction({
          txn: optInTransaction,
          signer: transactionSigner,
        });
        await atc.execute(algodClient, 4);
      };

      const optInResult = await algod.sendRawTransaction(signedOptIn).do();
      const optInTxId =
        optInResult.txId ||
        optInResult.txid ||
        optInResult.transactionId ||
        optInResult.transaction_id;

      await algosdk.waitForConfirmation(algod, optInTxId, 4);

      return true;
    } catch (error) {
      throw new Error("Failed to opt into asset");
    }
  };

  const executeSwap = async () => {
    if (!activeAddress) {
      alert("Please connect your wallet first");
      return;
    }

    if (!sellAmount || parseFloat(sellAmount) <= 0) {
      alert("Please enter a valid sell amount");
      return;
    }

    setIsSwapping(true);
    try {
      const sellAmountFloat = parseFloat(sellAmount);
      const swapAmountInBaseUnits = Math.floor(sellAmountFloat * 1000000);

      // Check and handle opt-in for the buy asset (if it's not ALGO)
      if (buyAsset.id !== 0 && buyAsset.id !== "0") {
        const isOptedIn = await isOptedIntoAsset(
          activeAddress,
          parseInt(buyAsset.id)
        );

        if (!isOptedIn) {
          const optInSuccess = await handleAssetOptIn(parseInt(buyAsset.id));

          if (!optInSuccess) {
            alert("Opt-in failed. Cannot proceed with swap.");
            setIsSwapping(false);
            return;
          }
        }
      }

      const quoteParams = new URLSearchParams({
        chain: "mainnet",
        algodUri: ALGOD_URI,
        algodToken: "",
        algodPort: ALGOD_PORT.toString(),
        amount: swapAmountInBaseUnits.toString(),
        type: "fixed-input",
        fromASAID: sellAsset.id.toString(),
        toASAID: buyAsset.id.toString(),
        apiKey: API_KEY,
        maxGroupSize: "13",
        atomicOnly: "false",
        referrer: "",
      });

      const quoteResponse = await fetch(
        `${DEFLEX_API_BASE}/fetchQuote?${quoteParams}`
      );
      const freshQuote = await quoteResponse.json();

      if (!freshQuote.txnPayload) {
        alert("Invalid quote: missing transaction payload");
        return;
      }

      const params = await algodClient.getTransactionParams().do();

      const txnResponse = await fetch(
        `${DEFLEX_API_BASE}/fetchExecuteSwapTxns`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address: activeAddress,
            txnPayloadJSON: freshQuote.txnPayload,
            slippage: parseFloat(slippage),
            apiKey: API_KEY,
          }),
        }
      );

      const txnGroup = await txnResponse.json();

      if (!txnGroup || !txnGroup.txns || !Array.isArray(txnGroup.txns)) {
        alert("Invalid transaction response from server");
        return;
      }

      const decodedTxns = txnGroup.txns.map((dtx) => {
        if (!dtx.data) {
          throw new Error(`Missing transaction data`);
        }

        const txnBytes = Buffer.from(dtx.data, "base64");
        const decoded = algosdk.decodeUnsignedTransaction(txnBytes);

        decoded.firstRound = params.firstRound;
        decoded.lastRound = params.firstRound + 500;
        decoded.genesisHash = params.genesisHash;
        decoded.genesisID = params.genesisID;

        if (decoded.type === "appl" && decoded.apaa) {
          delete decoded.apaa;
        }

        delete decoded.group;

        return {
          txn: decoded,
          needsUserSignature: dtx.logicSigBlob === false,
          logicSigBlob: dtx.logicSigBlob,
        };
      });

      const txnsForGrouping = decodedTxns.map((item) => item.txn);
      algosdk.assignGroupID(txnsForGrouping);

      decodedTxns.forEach((item, index) => {
        item.txn.group = txnsForGrouping[index].group;
      });

      const swapTxnsForPera = decodedTxns.map((item) =>
        item.needsUserSignature
          ? { txn: item.txn, signers: [activeAddress] }
          : { txn: item.txn, signers: [] }
      );

      const swapSignedResult = () => {};
      // await peraWallet.signTransaction([swapTxnsForPera]);

      const finalSwapSignedTxns = [];
      let swapSignedIndex = 0;

      for (let i = 0; i < decodedTxns.length; i++) {
        const item = decodedTxns[i];
        if (item.needsUserSignature) {
          const walletSignedTxn = swapSignedResult[swapSignedIndex++];
          if (walletSignedTxn instanceof Uint8Array) {
            finalSwapSignedTxns.push(walletSignedTxn);
          } else if (typeof walletSignedTxn === "string") {
            if (!walletSignedTxn) {
              throw new Error("Wallet signed transaction is empty");
            }
            finalSwapSignedTxns.push(
              new Uint8Array(Buffer.from(walletSignedTxn, "base64"))
            );
          } else {
            throw new Error(`Unexpected signed transaction type`);
          }
        } else {
          const blob = item.logicSigBlob;
          let signedTxn;
          if (typeof blob === "string") {
            if (!blob) {
              throw new Error("LogicSig blob is empty");
            }
            signedTxn = new Uint8Array(Buffer.from(blob, "base64"));
          } else if (blob instanceof Uint8Array) {
            signedTxn = blob;
          } else if (Array.isArray(blob)) {
            signedTxn = new Uint8Array(blob);
          } else if (blob?.type === "Buffer" && Array.isArray(blob.data)) {
            signedTxn = new Uint8Array(blob.data);
          } else if (blob && Object.keys(blob).every((k) => !isNaN(k))) {
            const sortedKeys = Object.keys(blob).sort(
              (a, b) => Number(a) - Number(b)
            );
            signedTxn = new Uint8Array(sortedKeys.map((k) => blob[k]));
          } else {
            throw new Error(
              `LogicSigBlob format unrecognized at transaction ${i + 1}`
            );
          }
          finalSwapSignedTxns.push(signedTxn);
        }
      }

      const swapResult = await algod
        .sendRawTransaction(finalSwapSignedTxns)
        .do();
      const swapTxId =
        swapResult.txId ||
        swapResult.txid ||
        swapResult.transactionId ||
        swapResult.transaction_id;

      const confirmedSwapTxn = await algosdk.waitForConfirmation(
        algod,
        swapTxId,
        4
      );

      // Add completed swap to history
      const newSwap = {
        id: swapTxId,
        timestamp: new Date().toISOString(),
        sellAmount: sellAmount,
        sellAsset: sellAsset.name,
        sellAssetImage: sellAsset.image,
        buyAmount: buyAmount,
        buyAsset: buyAsset.name,
        buyAssetImage: buyAsset.image,
        txId: swapTxId,
        alloUrl: `https://allo.info/tx/${swapTxId}`,
        algoExplorerUrl: `https://algoexplorer.io/tx/${swapTxId}`,
        confirmedRound: confirmedSwapTxn["confirmed-round"],
      };

      setCompletedSwaps((prev) => [newSwap, ...prev]);
    } catch (error) {
      console.error("Swap error:", error);

      if (error.message?.includes("User rejected")) {
        alert("Swap cancelled by user");
      } else {
        alert("Swap failed: " + error.message);
      }
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "24px",
          padding: "32px",
          maxWidth: "520px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
        }}
      >
        <h1
          style={{
            fontSize: "28px",
            fontWeight: "bold",
            marginBottom: "24px",
            textAlign: "center",
            color: "#1a1a1a",
          }}
        >
          Token Swap
        </h1>

        <div
          style={{
            marginBottom: "24px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div data-wallet-ui>
            <WalletButton />
          </div>
        </div>

        <div
          style={{
            background: "#f8f8f8",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  background: "#ef4444",
                  borderRadius: "50%",
                }}
              ></span>
              <span
                style={{ fontSize: "14px", fontWeight: "600", color: "#666" }}
              >
                Sell
              </span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {["10", "25", "50", "75", "MAX"].map((pct) => (
                <button
                  key={pct}
                  onClick={() => handlePercentageClick(pct)}
                  style={{
                    padding: "4px 8px",
                    background: "white",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontWeight: "500",
                  }}
                >
                  {pct}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <input
              type="text"
              value={sellAmount === "0.000000" ? "" : sellAmount}
              onChange={(e) => handleSellAmountChange(e.target.value)}
              placeholder="Click to enter amount"
              style={{
                flex: 1,
                padding: "12px",
                border: "none",
                background: "white",
                borderRadius: "10px",
                fontSize: "18px",
                fontWeight: "600",
                outline: "none",
                cursor: "text",
              }}
            />
            <div style={{ position: "relative" }}>
              <div
                onClick={() => setShowSellSearchResults(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 16px",
                  background: "white",
                  borderRadius: "10px",
                  cursor: "pointer",
                  border: "1px solid #e0e0e0",
                  minWidth: "120px",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  {sellAsset.image && (
                    <img
                      src={sellAsset.image}
                      alt={sellAsset.name}
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "#333",
                    }}
                  >
                    {sellAsset.name}
                  </span>
                </div>
                <span style={{ fontSize: "14px", color: "#666" }}>▼</span>
              </div>

              {showSellSearchResults && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: "8px",
                    background: "white",
                    border: "2px solid #e0e0e0",
                    borderRadius: "12px",
                    width: "240px",
                    maxHeight: "250px",
                    zIndex: 20,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                  }}
                >
                  <div style={{ padding: "12px" }}>
                    <input
                      type="text"
                      placeholder="Search sell tokens..."
                      value={sellSearchQuery}
                      onChange={handleSellSearchInputChange}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                      autoFocus
                    />
                    {isSellSearching && (
                      <div
                        style={{
                          marginTop: "8px",
                          fontSize: "12px",
                          color: "#666",
                        }}
                      >
                        Searching...
                      </div>
                    )}
                  </div>

                  <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                    {sellSearchResults.map((asset) => (
                      <div
                        key={asset.id}
                        onClick={() => selectToken(asset, true)}
                        style={{
                          padding: "12px 16px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          borderBottom: "1px solid #f0f0f0",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#f8f8f8")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "white")
                        }
                      >
                        {asset.image && (
                          <img
                            src={asset.image}
                            alt={asset.name || asset.ticker}
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                            }}
                            onError={(e) => (e.target.style.display = "none")}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontSize: "14px",
                              fontWeight: "500",
                              color: "#333",
                            }}
                          >
                            {asset.name || asset.ticker || `ASA ${asset.id}`}
                          </div>
                          <div style={{ fontSize: "11px", color: "#666" }}>
                            {asset.ticker || `ID: ${asset.id}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: "8px" }}>
                    <button
                      onClick={() => setShowSellSearchResults(false)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        background: "#f0f0f0",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: "8px",
              fontSize: "12px",
              color: "#999",
            }}
          >
            Balance:{" "}
            {isLoadingBalances
              ? "Loading..."
              : getCurrentBalance(sellAsset.id).toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 6,
                })}{" "}
            {sellAsset.name}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            margin: "16px 0",
          }}
        >
          <button
            onClick={swapAssets}
            style={{
              width: "40px",
              height: "40px",
              background: "#667eea",
              color: "white",
              border: "none",
              borderRadius: "50%",
              cursor: "pointer",
              fontSize: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "bold",
            }}
          >
            ↓
          </button>
        </div>

        <div
          style={{
            background: "#f8f8f8",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "12px",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                background: "#10b981",
                borderRadius: "50%",
              }}
            ></span>
            <span
              style={{ fontSize: "14px", fontWeight: "600", color: "#666" }}
            >
              Buy
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <input
              type="text"
              value={isLoadingQuote ? "Loading..." : buyAmount}
              readOnly
              disabled={isLoadingQuote}
              style={{
                flex: 1,
                padding: "12px",
                border: "none",
                background: "white",
                borderRadius: "10px",
                fontSize: "18px",
                fontWeight: "600",
                outline: "none",
                cursor: "not-allowed",
              }}
            />
            <div style={{ position: "relative" }}>
              <div
                onClick={() => setShowBuySearchResults(true)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 16px",
                  background: "white",
                  borderRadius: "10px",
                  cursor: "pointer",
                  border: "1px solid #e0e0e0",
                  minWidth: "120px",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  {buyAsset.image && (
                    <img
                      src={buyAsset.image}
                      alt={buyAsset.name}
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: "16px",
                      fontWeight: "600",
                      color: buyAsset.name ? "#333" : "#999",
                    }}
                  >
                    {buyAsset.name || "Select token"}
                  </span>
                </div>
                <span style={{ fontSize: "14px", color: "#666" }}>▼</span>
              </div>

              {showBuySearchResults && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: "8px",
                    background: "white",
                    border: "2px solid #e0e0e0",
                    borderRadius: "12px",
                    width: "240px",
                    maxHeight: "250px",
                    zIndex: 20,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
                  }}
                >
                  <div style={{ padding: "12px" }}>
                    <input
                      type="text"
                      placeholder="Search buy tokens..."
                      value={buySearchQuery}
                      onChange={handleBuySearchInputChange}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        border: "1px solid #e0e0e0",
                        borderRadius: "8px",
                        fontSize: "14px",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                      autoFocus
                    />
                    {isBuySearching && (
                      <div
                        style={{
                          marginTop: "8px",
                          fontSize: "12px",
                          color: "#666",
                        }}
                      >
                        Searching...
                      </div>
                    )}
                  </div>

                  <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                    {buySearchResults.map((asset) => (
                      <div
                        key={asset.id}
                        onClick={() => selectToken(asset, false)}
                        style={{
                          padding: "12px 16px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          borderBottom: "1px solid #f0f0f0",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#f8f8f8")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "white")
                        }
                      >
                        {asset.image && (
                          <img
                            src={asset.image}
                            alt={asset.name || asset.ticker}
                            style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                            }}
                            onError={(e) => (e.target.style.display = "none")}
                          />
                        )}
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: "500" }}>
                            {asset.name || asset.ticker || `ASA ${asset.id}`}
                          </div>
                          <div style={{ fontSize: "11px", color: "#999" }}>
                            {asset.ticker || `ID: ${asset.id}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: "8px" }}>
                    <button
                      onClick={() => setShowBuySearchResults(false)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        background: "#f0f0f0",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        fontSize: "12px",
                      }}
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: "8px",
              fontSize: "12px",
              color: "#999",
            }}
          >
            Balance:{" "}
            {isLoadingBalances
              ? "Loading..."
              : getCurrentBalance(buyAsset.id).toLocaleString(undefined, {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 6,
                })}{" "}
            {buyAsset.name}
          </div>
        </div>

        {quoteInfo && (
          <div
            style={{
              background: "#f0f9ff",
              borderRadius: "16px",
              padding: "16px",
              marginBottom: "16px",
              border: "1px solid #bfdbfe",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  background: "#3b82f6",
                  borderRadius: "50%",
                }}
              ></span>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#1e40af",
                }}
              >
                Quote
              </span>
            </div>

            <div
              style={{
                fontSize: "14px",
                color: "#1e40af",
                fontWeight: "500",
                marginBottom: "4px",
              }}
            >
              {quoteInfo.algoEquivalent.label}
            </div>

            <div
              style={{
                fontSize: "12px",
                color: "#64748b",
              }}
            >
              Exchange Rate: 1 {quoteInfo.sellAsset} ={" "}
              {quoteInfo.pricePerUnit.toFixed(6)} {quoteInfo.buyAsset}
            </div>
          </div>
        )}

        <div
          style={{
            background: "#f8f8f8",
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <span
              style={{ fontSize: "14px", fontWeight: "600", color: "#666" }}
            >
              Slippage Tolerance
            </span>
            <span
              style={{ fontSize: "14px", fontWeight: "600", color: "#667eea" }}
            >
              {slippage}%
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={slippage}
            onChange={(e) => setSlippage(parseFloat(e.target.value))}
            style={{
              width: "100%",
              cursor: "pointer",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "11px",
              color: "#999",
              marginTop: "4px",
            }}
          >
            <span>0.1%</span>
            <span>5%</span>
          </div>
        </div>

        <button
          onClick={executeSwap}
          disabled={
            isSwapping ||
            !activeAddress ||
            parseFloat(sellAmount) <= 0 ||
            !buyAsset.name
          }
          style={{
            width: "100%",
            padding: "16px",
            background:
              isSwapping ||
              !activeAddress ||
              parseFloat(sellAmount) <= 0 ||
              !buyAsset.name
                ? "#ccc"
                : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            border: "none",
            borderRadius: "12px",
            cursor:
              isSwapping ||
              !activeAddress ||
              parseFloat(sellAmount) <= 0 ||
              !buyAsset.name
                ? "not-allowed"
                : "pointer",
            fontSize: "18px",
            fontWeight: "700",
            transition: "transform 0.1s",
          }}
          onMouseDown={(e) => {
            if (
              !isSwapping &&
              activeAddress &&
              parseFloat(sellAmount) > 0 &&
              buyAsset.name
            ) {
              e.currentTarget.style.transform = "scale(0.98)";
            }
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {isSwapping
            ? "Swapping..."
            : buyAsset.name
            ? `Swap ${sellAsset.name} → ${buyAsset.name}`
            : "Select a token to buy"}
        </button>

        {completedSwaps.length > 0 && (
          <div
            style={{
              marginTop: "32px",
              borderTop: "1px solid #e0e0e0",
              paddingTop: "24px",
            }}
          >
            <h2
              style={{
                fontSize: "20px",
                fontWeight: "bold",
                marginBottom: "16px",
                color: "#1a1a1a",
              }}
            >
              Recent Swaps
            </h2>

            <div
              style={{
                maxHeight: "300px",
                overflowY: "auto",
              }}
            >
              {completedSwaps.map((swap) => (
                <div
                  key={swap.id}
                  style={{
                    background: "#f8f8f8",
                    borderRadius: "12px",
                    padding: "16px",
                    marginBottom: "12px",
                    border: "1px solid #e0e0e0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "16px",
                      padding: "12px",
                      background: "white",
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {swap.sellAssetImage && (
                          <img
                            src={swap.sellAssetImage}
                            alt={swap.sellAsset}
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                            }}
                          />
                        )}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "16px",
                              fontWeight: "700",
                              color: "#333",
                            }}
                          >
                            {parseFloat(swap.sellAmount).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 6,
                              }
                            )}
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#666",
                              fontWeight: "500",
                            }}
                          >
                            {swap.sellAsset}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "32px",
                          height: "32px",
                          background: "#f0f0f0",
                          borderRadius: "50%",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "16px",
                            color: "#667eea",
                            fontWeight: "bold",
                          }}
                        >
                          →
                        </span>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                      >
                        {swap.buyAssetImage && (
                          <img
                            src={swap.buyAssetImage}
                            alt={swap.buyAsset}
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                            }}
                          />
                        )}
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "16px",
                              fontWeight: "700",
                              color: "#10b981",
                            }}
                          >
                            {parseFloat(swap.buyAmount).toLocaleString(
                              undefined,
                              {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 6,
                              }
                            )}
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              color: "#666",
                              fontWeight: "500",
                            }}
                          >
                            {swap.buyAsset}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 8px",
                        background: "#f0fdf4",
                        borderRadius: "12px",
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      <div
                        style={{
                          width: "6px",
                          height: "6px",
                          background: "#10b981",
                          borderRadius: "50%",
                        }}
                      ></div>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#10b981",
                          fontWeight: "600",
                        }}
                      >
                        SUCCESS
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: "12px",
                      color: "#666",
                      marginBottom: "8px",
                    }}
                  >
                    {new Date(swap.timestamp).toLocaleString()}
                  </div>

                  <div
                    style={{
                      fontSize: "11px",
                      color: "#999",
                      marginTop: "8px",
                      fontFamily: "monospace",
                    }}
                  >
                    <a
                      href={swap.algoExplorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#667eea",
                        textDecoration: "none",
                        cursor: "pointer",
                        fontWeight: "500",
                        transition: "color 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.color = "#5a67d8")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.color = "#667eea")
                      }
                    >
                      TX: {swap.txId.slice(0, 8)}...{swap.txId.slice(-8)}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TokenSwap;
