import { Horizon, Networks, TransactionBuilder, BASE_FEE, Contract, Address } from "stellar-sdk";

export const CONTRACT_ID = "CBYP7L3KXYZABCDEF1234567890EXAMPLECONTRACTADDRESS1234567";
export const DEMO_MODE = true;
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

let _yesVotes = 47;
let _noVotes = 31;

const SEED_ADDRESSES = [
  "GD4Q","GBZM","GCTN","GDWX","GEAX","GFBY","GGCZ","GHDA","GIEB","GJFC","GKGD","GLHE",
];
const SEED_FULLS = [
  "GD4QXJ7GK9N2M8UVLP3A1","GBZM2PLWQRX4N7YVSDE91H","GCTN5MXYWQ8K3JABUVSF62",
  "GDWX6NYZMR4K8LBCUTVE73","GEAX7OZWNQ5L9MBDVWG84J","GFBY8PANR06M0NCEWXH95K",
  "GGCZ9QBOS17N1ODXYI06LM","GHDA0RCPT28O2PEYZJ17MN","GIEB1SDQU39P3QFZAK28NO",
  "GJFC2TERV40Q4RGABL39OP","GKGD3UFSW51R5SHBCM40PQ","GLHE4VGTX62S6TICDN51QR",
];

function shortAddr(i) { return SEED_ADDRESSES[i] + "…" + "F7KL"; }
function minsAgo(mins) { return new Date(Date.now() - mins * 60 * 1000).toISOString(); }
function fakeHash(seed) { return seed.toString(16).padStart(2,"0").repeat(32); }

export let activityFeed = [
  { addr: shortAddr(0),  vote: "YES", time: minsAgo(2),   hash: fakeHash(1) },
  { addr: shortAddr(1),  vote: "NO",  time: minsAgo(7),   hash: fakeHash(2) },
  { addr: shortAddr(2),  vote: "YES", time: minsAgo(15),  hash: fakeHash(3) },
  { addr: shortAddr(3),  vote: "YES", time: minsAgo(23),  hash: fakeHash(4) },
  { addr: shortAddr(4),  vote: "NO",  time: minsAgo(38),  hash: fakeHash(5) },
  { addr: shortAddr(5),  vote: "YES", time: minsAgo(51),  hash: fakeHash(6) },
  { addr: shortAddr(6),  vote: "NO",  time: minsAgo(67),  hash: fakeHash(7) },
  { addr: shortAddr(7),  vote: "YES", time: minsAgo(84),  hash: fakeHash(8) },
  { addr: shortAddr(8),  vote: "YES", time: minsAgo(102), hash: fakeHash(9) },
  { addr: shortAddr(9),  vote: "NO",  time: minsAgo(118), hash: fakeHash(10) },
  { addr: shortAddr(10), vote: "YES", time: minsAgo(141), hash: fakeHash(11) },
  { addr: shortAddr(11), vote: "NO",  time: minsAgo(159), hash: fakeHash(12) },
];

// Getter so App.js always reads the latest mutated array
export function getActivityFeed() {
  return activityFeed;
}

export async function getResults() {
  return [_yesVotes, _noVotes];
}

export async function castVote(wallet, voteType) {
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 1500));
    if (voteType === "yes") _yesVotes++;
    else _noVotes++;
    const fakeH = Array.from({length:64},()=>"0123456789abcdef"[Math.floor(Math.random()*16)]).join("");
    activityFeed = [{
      addr: wallet.slice(0,4)+"…"+wallet.slice(-4),
      vote: voteType==="yes"?"YES":"NO",
      time: new Date().toISOString(),
      hash: fakeH, isNew: true,
    }, ...activityFeed.slice(0,19)];
    return fakeH;
  }
  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(wallet);
  const contract = new Contract(CONTRACT_ID);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(contract.call(voteType==="yes"?"vote_yes":"vote_no", Address.fromString(wallet).toScVal()))
    .setTimeout(30).build();
  const signed = await window.freighterApi.signTransaction(tx.toXDR(), { network: "TESTNET" });
  if (!signed) throw new Error("Transaction rejected");
  const result = await server.submitTransaction(TransactionBuilder.fromXDR(signed, NETWORK_PASSPHRASE));
  if (voteType==="yes") _yesVotes++; else _noVotes++;
  activityFeed = [{
    addr: wallet.slice(0,4)+"…"+wallet.slice(-4),
    vote: voteType==="yes"?"YES":"NO",
    time: new Date().toISOString(),
    hash: result.hash, isNew: true,
  }, ...activityFeed.slice(0,19)];
  return result.hash;
}