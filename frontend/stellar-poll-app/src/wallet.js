import { useState, useEffect, useCallback } from "react";
import {
  Horizon,
  Networks as StellarNetworks,
  TransactionBuilder,
  Asset,
  Operation,
  BASE_FEE,
} from "stellar-sdk";
import * as FreighterPkg from "@stellar/freighter-api";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = StellarNetworks.TESTNET;

/* 🔹 Official wallet redirects (NON-Freighter) */
const WALLET_REDIRECTS = {
  albedo: "https://albedo.link",
  xbull: "https://xbull.app",
};

/* 🔹 Safely resolve Freighter API */
function getApi() {
  if (
    FreighterPkg.default &&
    typeof FreighterPkg.default.getPublicKey === "function"
  ) {
    return FreighterPkg.default;
  }
  if (typeof FreighterPkg.getPublicKey === "function") {
    return FreighterPkg;
  }
  if (FreighterPkg.FreighterApi) {
    return new FreighterPkg.FreighterApi();
  }
  return null;
}

export function useWallet() {
  const [publicKey, setPublicKey] = useState(null);
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | connecting | connected | error
  const [connectedWallet, setConnectedWallet] = useState(null);
  const [freighterReady, setFreighterReady] = useState(false);

  /* 🔹 Detect Freighter availability */
  useEffect(() => {
    const api = getApi();
    if (!api) return;

    api
      .isConnected()
      .then((r) => {
        const ok = typeof r === "boolean" ? r : r?.isConnected ?? false;
        setFreighterReady(ok);
      })
      .catch(() => {});
  }, []);

  /* 🔹 Fetch balance + recent tx */
  const fetchBalance = useCallback(async (key) => {
    try {
      const server = new Horizon.Server(HORIZON_URL);
      const acct = await server.loadAccount(key);

      const xlm = acct.balances.find((b) => b.asset_type === "native");
      setBalance(xlm ? parseFloat(xlm.balance).toFixed(7) : "0.0000000");

      const txs = await server
        .transactions()
        .forAccount(key)
        .order("desc")
        .limit(6)
        .call();

      setTransactions(
        txs.records.map((tx) => ({
          id: tx.id,
          hash: tx.hash,
          created: tx.created_at,
          successful: tx.successful,
        }))
      );
    } catch (e) {
      console.error("fetchBalance error:", e);
    }
  }, []);

  useEffect(() => {
    if (!publicKey) return;
    fetchBalance(publicKey);
    const id = setInterval(() => fetchBalance(publicKey), 15000);
    return () => clearInterval(id);
  }, [publicKey, fetchBalance]);

  /* ============================================================
     🔥 MAIN FIX: Wallet connection logic
     ============================================================ */
  const connectWallet = async (walletKey = "freighter") => {
    setError(null);

    /* 🔹 NON-FREIGHTER → redirect only */
    if (walletKey !== "freighter") {
      const url = WALLET_REDIRECTS[walletKey];
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
    }

    /* 🔹 FREIGHTER CONNECTION */
    setStatus("connecting");

    try {
      const api = getApi();
      if (!api) {
        setError("❌ Freighter not found. Install it from freighter.app");
        setStatus("error");
        return;
      }

      await api.requestAccess();
      const keyResult = await api.getPublicKey();

      const address =
        typeof keyResult === "string" ? keyResult : keyResult?.publicKey;

      if (!address) {
        setError("⛔ Connection rejected by user");
        setStatus("error");
        return;
      }

      setPublicKey(address);
      setConnectedWallet("freighter");
      setStatus("connected");
      setFreighterReady(true);
      await fetchBalance(address);
    } catch (e) {
      const msg = e.message || String(e);

      if (/reject|denied|cancel/i.test(msg))
        setError("⛔ User rejected Freighter connection");
      else if (/network|passphrase/i.test(msg))
        setError("🌐 Switch Freighter to Testnet");
      else if (/install|found/i.test(msg))
        setError("❌ Freighter not installed");
      else setError("⚠️ " + msg);

      setStatus("error");
    }
  };

  const connectFreighter = () => connectWallet("freighter");

  const disconnect = () => {
    setPublicKey(null);
    setBalance(null);
    setTransactions([]);
    setError(null);
    setStatus("idle");
    setConnectedWallet(null);
  };

  /* 🔹 Send XLM (Freighter only) */
  const sendXLM = async (destination, amount) => {
    if (!publicKey) throw new Error("Wallet not connected");

    const api = getApi();
    if (!api) throw new Error("Freighter API unavailable");

    const server = new Horizon.Server(HORIZON_URL);
    const acct = await server.loadAccount(publicKey);

    const tx = new TransactionBuilder(acct, {
      fee: BASE_FEE,
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        Operation.payment({
          destination,
          asset: Asset.native(),
          amount: String(amount),
        })
      )
      .setTimeout(30)
      .build();

    const signed = await api.signTransaction(tx.toXDR(), {
      networkPassphrase: NETWORK_PASSPHRASE,
    });

    const signedXdr =
      typeof signed === "string"
        ? signed
        : signed?.signedTxXdr || signed?.result;

    if (!signedXdr) throw new Error("Transaction rejected");

    const result = await server.submitTransaction(
      TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE)
    );

    setTimeout(() => fetchBalance(publicKey), 2000);
    setTimeout(() => fetchBalance(publicKey), 6000);

    return result.hash;
  };

  return {
    publicKey,
    balance,
    transactions,
    error,
    status,
    freighterReady,
    connectedWallet,
    connectWallet,
    connectFreighter,
    disconnect,
    sendXLM,
  };
}