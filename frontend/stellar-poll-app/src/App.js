import { useState, useEffect } from "react";
import S, { colors } from "./styles";
import { useWallet } from "./wallet";
import { getResults, castVote, CONTRACT_ID, getActivityFeed } from "./contract";

const EXPERT_BASE = "https://stellar.expert/explorer/testnet";

function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}
function short(addr) {
  if (!addr) return "";
  return addr.slice(0,6)+"…"+addr.slice(-6);
}


const WALLETS = [
  { id:"freighter", name:"Freighter", emoji:"🪐", tag:"Chrome Extension Wallet",    color:"#7c3aed" },
  { id:"albedo",    name:"Albedo",    emoji:"⚡", tag:"Web Wallet · No install",     color:"#f59e0b" },
  { id:"xbull",     name:"xBull",     emoji:"🐂", tag:"Advanced DeFi Wallet",        color:"#10b981" },
];

function SendModal({ balance, onSend, onClose }) {
  const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [err, setErr] = useState("");
  const maxAmt = Math.max(0, parseFloat(balance||0) - 1).toFixed(7);

  const handleSend = async () => {
    setErr("");
    if (!dest || dest.length !== 56 || !dest.startsWith("G")) { setErr("❌ Invalid destination address"); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr("❌ Enter a valid amount"); return; }
    if (amt > parseFloat(maxAmt)) { setErr("❌ Insufficient balance (1 XLM reserve required)"); return; }
    setSending(true);
    try {
      const hash = await onSend(dest, amount);
      setTxHash(hash);
    } catch(e) {
      const msg = e.message||String(e);
      if (msg.includes("reject")||msg.includes("denied")) setErr("⛔ Rejected by Freighter");
      else if (msg.includes("balance")||msg.includes("fund")) setErr("❌ Insufficient balance");
      else setErr("⚠️ Error: "+msg);
    }
    setSending(false);
  };

  return (
    <div style={S.overlay} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={S.modal}>
        <div style={S.modalTitle}>↑ Send XLM</div>
        {txHash ? (
          <>
            <div style={{...S.statusBar,background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",color:"#10b981"}}>✅ Sent successfully!</div>
            <div style={{fontSize:12,color:"#6b7fa3"}}>Transaction hash:</div>
            <a href={`${EXPERT_BASE}/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{...S.txHashLink,wordBreak:"break-all"}}>{txHash} ↗</a>
            <button style={S.cancelBtn} onClick={onClose}>Close</button>
          </>
        ) : (
          <>
            <div>
              <label style={S.inputLabel}>Destination address</label>
              <input style={S.input} placeholder="G…" value={dest} onChange={e=>setDest(e.target.value)} />
            </div>
            <div style={S.amountWrap}>
              <label style={S.inputLabel}>Amount (XLM)</label>
              <input style={S.input} placeholder="0.0" value={amount} onChange={e=>setAmount(e.target.value)} type="number" min="0" />
              <button style={S.maxBtn} onClick={()=>setAmount(maxAmt)}>MAX</button>
            </div>
            <div style={{fontSize:12,color:"#6b7fa3"}}>Available: <span style={{color:"#38bdf8"}}>{maxAmt} XLM</span></div>
            {err && <div style={S.errorBox}>{err}</div>}
            {sending && <div style={{...S.statusBar,background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.3)",color:"#a78bfa"}}>⏳ Waiting for Freighter approval…</div>}
            <div style={S.modalBtns}>
              <button style={S.cancelBtn} onClick={onClose} disabled={sending}>Cancel</button>
              <button style={S.sendBtn} onClick={handleSend} disabled={sending}>{sending?"Sending…":"Send →"}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const wallet = useWallet();
  const [yesVotes, setYesVotes] = useState(47);
  const [noVotes, setNoVotes]   = useState(31);
  const [voteStatus, setVoteStatus] = useState("");
  const [lastTxHash, setLastTxHash] = useState("");
  const [feed, setFeed] = useState([]);
  const [showSend, setShowSend] = useState(false);
  const [copied, setCopied] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const refresh = async () => {
      try {
        const [y, n] = await getResults();
        setYesVotes(y); setNoVotes(n);
        setFeed([...getActivityFeed()]);
      } catch(e) { console.error("refresh error:", e); }
    };
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setTick(t=>t+1), 30000);
    return () => clearInterval(id);
  }, []);

  const handleVote = async (type) => {
    if (!wallet.publicKey) { alert("Please connect a wallet from the sidebar to cast your vote."); return; }
    setVoteStatus("pending"); setLastTxHash("");
    try {
      const hash = await castVote(wallet.publicKey, type);
      setLastTxHash(hash);
      setVoteStatus("success");
      const [y, n] = await getResults();
      setYesVotes(y); setNoVotes(n);
      setFeed([...getActivityFeed()]);
    } catch(e) {
      console.error("vote error:", e);
      setVoteStatus("failed");
    }
  };

  const handleWalletClick = (w) => {
    if (wallet.status === "connected") return; // already connected
    wallet.connectWallet(w.id); // w.id matches ModuleType values: "freighter", "xbull", "albedo"
  };

  const copyAddr = () => {
    navigator.clipboard.writeText(wallet.publicKey);
    setCopied(true); setTimeout(()=>setCopied(false),1500);
  };

  const total = yesVotes + noVotes;
  const yesPct = total ? Math.round(yesVotes/total*100) : 50;

  return (
    <div style={S.root}>
      {/* NAV */}
      <nav style={S.nav}>
        <div style={S.logo}>StellarVote</div>
        <a href={`${EXPERT_BASE}/contract/${CONTRACT_ID}`} target="_blank" rel="noopener noreferrer" style={S.contractPill}>
          📋 Contract: {CONTRACT_ID.slice(0,6)}…{CONTRACT_ID.slice(-4)} ↗
        </a>
      </nav>

      <div style={S.body}>
        {/* SIDEBAR */}
        <aside style={S.sidebar}>
          <div style={S.sectionLabel}>Connect Wallet</div>

          {WALLETS.map(w => {
            const active  = wallet.status === "connected" && wallet.connectedWallet === w.id;
            const loading = wallet.status === "connecting";
            return (
              <div
                key={w.id}
                style={{
                  ...S.walletCard,
                  borderColor: active ? w.color : "#1e2d48",
                  boxShadow: active ? `0 0 18px ${w.color}33` : "none",
                  background: active ? "#120d2a" : "#0c1526",
                }}
                onClick={()=>!active&&handleWalletClick(w)}
              >
                <div style={{...S.walletIcon, border:`1px solid ${w.color}44`}}>{w.emoji}</div>
                <div style={S.walletInfo}>
                  <div style={{...S.walletName, color: active ? w.color : "#e8edf7"}}>
                    {w.name}{loading?" …":""}
                  </div>
                  <div style={S.walletTag}>
                    <div style={{
                      ...S.walletDot,
                      background: active ? "#10b981" : loading ? "#f59e0b" : "#6b7fa3"
                    }} />
                    {active ? "Connected ✓" : loading ? "Connecting…" : w.tag}
                  </div>
                </div>
                {!active && <span style={{fontSize:12,color:"#4a5a7a"}}>→</span>}
              </div>
            );
          })}

          {wallet.error && (
            <div style={{...S.errorBox, lineHeight:1.6}}>
              {wallet.error}
              <button
                onClick={() => wallet.connectFreighter()}
                style={{marginTop:10,width:"100%",padding:"8px",borderRadius:8,background:"#1e3a5f",border:"1px solid #38bdf8",color:"#38bdf8",fontSize:12,fontWeight:700,cursor:"pointer"}}
              >↺ Try Again</button>
            </div>
          )}

          {/* Connected panel */}
          {wallet.status==="connected" && wallet.publicKey && (
            <div style={S.connectedCard}>
              <div style={S.balanceLbl}>Balance</div>
              <div style={S.balanceNum}>
                {wallet.balance ?? "—"} <span style={{fontSize:16,opacity:0.7}}>XLM</span>
              </div>
              <div style={S.addrRow}>
                <span style={S.addrText}>{short(wallet.publicKey)}</span>
                <button style={S.iconBtn} onClick={copyAddr}>{copied?"✅":"📋"}</button>
                <a href={`${EXPERT_BASE}/account/${wallet.publicKey}`} target="_blank" rel="noopener noreferrer" style={{...S.iconBtn}}>↗</a>
              </div>
              <div style={S.actionRow}>
                <button
                  style={{...S.actionBtn,background:"linear-gradient(135deg,#7c3aed,#38bdf8)",color:"#fff"}}
                  onClick={()=>setShowSend(true)}
                >↑ Send XLM</button>
                <a
                  href={`${EXPERT_BASE}/account/${wallet.publicKey}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{...S.actionBtn,background:"#0f1f38",border:"1px solid #1a3050",color:"#94a3c4"}}
                >⊞ Explorer</a>
              </div>

              {wallet.transactions.length>0 && (
                <>
                  <div style={{...S.sectionLabel,marginTop:14}}>Recent Transactions</div>
                  <div style={S.txList}>
                    {wallet.transactions.map(tx=>(
                      <div key={tx.id} style={S.txItem}>
                        <div style={{...S.txDot,background:tx.successful?"#10b981":"#ef4444"}} />
                        <a href={`${EXPERT_BASE}/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" style={S.txHash}>{tx.hash.slice(0,10)}…</a>
                        <span style={S.txTime}>{timeAgo(tx.created)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <button style={S.disconnectBtn} onClick={wallet.disconnect}>Disconnect</button>
            </div>
          )}
        </aside>

        {/* MAIN */}
        <main style={S.main}>
          {/* POLL */}
          <div style={S.pollCard}>
            <div style={S.pollTitle}>🔴 Live Poll · Testnet</div>
            <div style={S.pollQuestion}>Should Stellar expand its DeFi ecosystem in 2026?</div>

            <div style={S.voteRow}>
              {[
                {type:"yes",label:"✅ Vote Yes",bg:"linear-gradient(135deg,#065f46,#059669)"},
                {type:"no",label:"❌ Vote No",bg:"linear-gradient(135deg,#7f1d1d,#dc2626)"},
              ].map(b=>(
                <button
                  key={b.type}
                  style={{...S.voteBtn,background:b.bg,color:"#fff",opacity:voteStatus==="pending"?0.5:1,cursor:voteStatus==="pending"?"not-allowed":"pointer"}}
                  onClick={()=>handleVote(b.type)}
                  disabled={voteStatus==="pending"}
                >
                  <span style={S.voteCount}>{b.type==="yes"?yesVotes:noVotes}</span>
                  <span style={S.voteLabel}>{b.label}</span>
                </button>
              ))}
            </div>

            <div style={S.barWrap}><div style={{...S.barFill,width:`${yesPct}%`}}/></div>
            <div style={S.barLabels}>
              <span>YES {yesPct}%</span>
              <span>{total} total votes</span>
              <span>{100-yesPct}% NO</span>
            </div>

            {voteStatus==="pending" && (
              <div style={{...S.statusBar,background:"rgba(124,58,237,0.1)",border:"1px solid rgba(124,58,237,0.3)",color:"#a78bfa"}}>
                ⏳ Transaction pending — approve in Freighter
              </div>
            )}
            {voteStatus==="success" && (
              <div style={{...S.statusBar,background:"rgba(16,185,129,0.1)",border:"1px solid rgba(16,185,129,0.3)",color:"#10b981"}}>
                ✅ Vote recorded!
                {lastTxHash && (
                  <a href={`${EXPERT_BASE}/tx/${lastTxHash}`} target="_blank" rel="noopener noreferrer" style={{...S.txHashLink,marginLeft:10}}>
                    TX: {lastTxHash.slice(0,14)}… ↗
                  </a>
                )}
              </div>
            )}
            {voteStatus==="failed" && (
              <div style={{...S.statusBar,background:"rgba(220,38,38,0.1)",border:"1px solid rgba(220,38,38,0.3)",color:"#fca5a5"}}>
                ❌ Vote failed — check wallet connection and try again
              </div>
            )}
            {!wallet.publicKey && voteStatus==="" && (
              <div style={{...S.statusBar,background:"rgba(124,58,237,0.06)",border:"1px solid rgba(124,58,237,0.12)",color:"#6b7fa3"}}>
                ← Connect Freighter to cast your vote
              </div>
            )}
          </div>

          {/* ACTIVITY FEED */}
          <div style={S.feedCard}>
            <div style={S.feedHeader}>
              <div style={S.feedTitle}>Live Activity</div>
              <div style={S.livePill}>
                <div style={{width:6,height:6,borderRadius:3,background:"currentColor",animation:"pulse 1.5s infinite"}}/>
                LIVE
              </div>
            </div>
            {feed.map((item,i)=>(
              <div key={i} style={{
                ...S.feedItem,
                background: item.isNew&&i===0 ? "rgba(124,58,237,0.08)" : "transparent",
                border: item.isNew&&i===0 ? "1px solid rgba(124,58,237,0.15)" : "1px solid transparent",
              }}>
                <div style={{
                  width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,flexShrink:0,
                  background:item.vote==="YES"?"rgba(5,150,105,0.15)":"rgba(220,38,38,0.15)",
                  border:`1px solid ${item.vote==="YES"?"rgba(5,150,105,0.3)":"rgba(220,38,38,0.3)"}`,
                }}>
                  {item.vote==="YES"?"✅":"❌"}
                </div>
                <span style={S.feedAddr}>{item.addr}</span>
                <span style={{
                  ...S.feedVoteBadge,
                  background:item.vote==="YES"?"rgba(5,150,105,0.15)":"rgba(220,38,38,0.15)",
                  color:item.vote==="YES"?"#34d399":"#f87171",
                  border:`1px solid ${item.vote==="YES"?"rgba(5,150,105,0.3)":"rgba(220,38,38,0.3)"}`,
                }}>{item.vote}</span>
                {item.hash && (
                  <a href={`${EXPERT_BASE}/tx/${item.hash}`} target="_blank" rel="noopener noreferrer" style={{...S.txHashLink,marginLeft:4,flexShrink:0}}>
                    {item.hash.slice(0,8)}… ↗
                  </a>
                )}
                <span style={S.feedTime}>{timeAgo(item.time)}</span>
              </div>
            ))}
          </div>
        </main>
      </div>

      {showSend && <SendModal balance={wallet.balance} onSend={wallet.sendXLM} onClose={()=>setShowSend(false)} />}

      <style>{`
        *{box-sizing:border-box;}
        body{margin:0;background:#070b14;}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        a:hover{opacity:0.8;}
        button:hover:not(:disabled){filter:brightness(1.1);}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:#1e2d48;border-radius:2px;}
      `}</style>
    </div>
  );
}