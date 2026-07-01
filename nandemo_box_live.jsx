import React, { useState, useRef } from "react";

// ── カテゴリ定義 ──
const CATS = {
  event: { label: "予定", en: "Event", grad: "linear-gradient(145deg,#ff6b9d,#ff8f6b)", chip: "rgba(255,94,138,0.13)", chipC: "#f0436c", dot: "#ff5e8a" },
  task:  { label: "タスク", en: "Task", grad: "linear-gradient(145deg,#a06bff,#6b8bff)", chip: "rgba(155,107,255,0.13)", chipC: "#8b54f5", dot: "#9b6bff" },
  mono:  { label: "モノ", en: "Want", grad: "linear-gradient(145deg,#ffc247,#ff9a3d)", chip: "rgba(255,182,39,0.16)", chipC: "#d18908", dot: "#ffb627" },
  basho: { label: "場所", en: "Place", grad: "linear-gradient(145deg,#3fe08a,#1fc8b0)", chip: "rgba(47,216,122,0.14)", chipC: "#1aa85c", dot: "#2fd87a" },
  joho:  { label: "情報", en: "Info", grad: "linear-gradient(145deg,#47bfff,#6b9aff)", chip: "rgba(55,182,255,0.14)", chipC: "#1690d8", dot: "#37b6ff" },
};

// ── 初期サンプル ──
const SEED = [
  { id: 1, category: "event", title: "Amazon Ads Local Osaka 見逃し配信", meta: "オンライン・期間限定", chip: "期限を確認" },
  { id: 2, category: "mono", title: "G-SHOCK GW-B5600", meta: "", chip: "¥28,600" },
  { id: 3, category: "task", title: "請求書をLIMUに送る", meta: "", chip: "今週中" },
  { id: 4, category: "basho", title: "渋谷の角打ちバー", meta: "道玄坂・徒歩5分", chip: "行きたい" },
  { id: 5, category: "joho", title: "Claude Code 活用術まとめ", meta: "note記事", chip: "" },
];

export default function App() {
  const [items, setItems] = useState(SEED);
  const [filter, setFilter] = useState("all");
  const [sheet, setSheet] = useState(false);      // 放り込みシート
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);     // 解析結果プレビュー
  const [error, setError] = useState("");
  const [image, setImage] = useState(null);       // 放り込んだ画像(base64)
  const fileRef = useRef(null);
  const nextId = useRef(100);

  // ── 画像を読み込んでbase64に ──
  function pickImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result);
    reader.readAsDataURL(file);
  }

  // ── Claude APIで解析（テキスト＋画像対応）──
  async function analyze(text, img) {
    setBusy(true); setError(""); setResult(null);
    try {
      const prompt = `あなたは「なんでも箱」アプリの仕分けエンジンです。
ユーザーが放り込んだ内容（テキスト、画像、またはその両方）を読み、5カテゴリのどれかに分類してJSONだけ返してください。

カテゴリ定義:
- event: 日時のあるイベント・ウェビナー・講座・セミナー・配信
- task: やること・締切のある作業
- mono: 欲しいもの（商品・ガジェット・服など）
- basho: 行きたい場所・店・スポット
- joho: あとで読む記事・動画・情報・メモ

${text ? `放り込まれたテキスト:\n"""${text}"""` : "画像が放り込まれました。画像の内容を読み取って分類してください。"}

以下のJSON形式だけを返してください。前置きや説明、マークダウンのコードブロックは一切不要:
{"category":"event|task|mono|basho|joho","title":"30字以内の簡潔なタイトル","meta":"補足(場所/媒体/価格など。なければ空文字)","chip":"日時or状態or価格の短いラベル(なければ空文字)","confidence":0.0〜1.0}`;

      // メッセージ内容を組み立て（画像があれば image ブロックを先頭に）
      const content = [];
      if (img) {
        const m = img.match(/^data:(image\/\w+);base64,(.+)$/);
        if (m) content.push({ type: "image", source: { type: "base64", media_type: m[1], data: m[2] } });
      }
      content.push({ type: "text", text: prompt });

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content }]
        })
      });
      const data = await res.json();
      let txt = data.content.filter(c => c.type === "text").map(c => c.text).join("");
      txt = txt.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(txt);
      if (!CATS[parsed.category]) parsed.category = "joho";
      if (img) parsed._img = img;  // カードに画像を残す
      setResult(parsed);
    } catch (e) {
      setError("解析できませんでした。もう一度試してください。");
    } finally {
      setBusy(false);
    }
  }

  function confirmAdd() {
    if (!result) return;
    setItems(prev => [{ id: nextId.current++, ...result }, ...prev]);
    setResult(null); setInput(""); setImage(null); setSheet(false);
  }

  function changeCat(id, cat) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, category: cat } : it));
    setMenuId(null);
  }
  const [menuId, setMenuId] = useState(null);

  const visible = items.filter(it => filter === "all" || it.category === filter);

  return (
    <div style={S.bg}>
      <div style={S.phone}>
        {/* ステータス */}
        <div style={S.sb}><span style={S.sbt}>9:41</span><span style={S.sbi}>●●● ⛁</span></div>

        {/* ヘッダー */}
        <div style={S.hd}>
          <div style={S.hdName}>なんでも<span style={S.accent}>箱</span></div>
          <div style={S.hdMonth}>6月 <span style={{ color: "#a0a0b0", fontSize: 12 }}>2026</span></div>
        </div>

        {/* 週カレンダー */}
        <div style={S.cal}>
          <div style={S.calWeek}>
            {[["日",15,"sun"],["月",16],["火",17,"today"],["水",18],["木",19],["金",20],["土",21,"sat"]].map(([n,d,t],i)=>(
              <div key={i} style={{...S.day, ...(t==="today"?S.dayToday:{})}}>
                <span style={{...S.dayName, ...(t==="sun"?{color:"#ff8a9a"}:t==="sat"?{color:"#8aa8ff"}:{}), ...(t==="today"?{color:"rgba(255,255,255,0.6)"}:{})}}>{n}</span>
                <span style={{...S.dayNum, ...(t==="sun"?{color:"#ff8a9a"}:t==="sat"?{color:"#8aa8ff"}:{}), ...(t==="today"?{color:"#fff"}:{})}}>{d}</span>
                <span style={S.dayDots}>
                  {d===17 && <><i style={{...S.dot,background:t==="today"?"#fff":"#ff5e8a"}}/><i style={{...S.dot,background:t==="today"?"rgba(255,255,255,0.6)":"#9b6bff"}}/></>}
                  {d===19 && <i style={{...S.dot,background:"#ffb627"}}/>}
                </span>
              </div>
            ))}
          </div>
          <div style={S.calEvents}>
            <div style={S.calEv}>
              <span style={S.calEvTime}>19:00</span>
              <span style={{...S.calEvBar, background:"linear-gradient(180deg,#ff5e8a,#ff8a6b)"}}/>
              <div><div style={S.calEvTitle}>AIゼミ・最前線</div><div style={S.calEvMeta}>SHIFT AI · オンライン</div></div>
            </div>
          </div>
        </div>

        {/* タブ */}
        <div style={S.boxHead}>気になる箱</div>
        <div style={S.tabs}>
          {[["all","すべて","#16161e"],["task","タスク",CATS.task.dot],["mono","モノ",CATS.mono.dot],["basho","場所",CATS.basho.dot],["joho","情報",CATS.joho.dot],["event","予定",CATS.event.dot]].map(([c,l,col])=>(
            <div key={c} onClick={()=>setFilter(c)}
              style={{...S.tab, ...(filter===c?{...S.tabOn, background: c==="all"?"linear-gradient(120deg,#16161e,#3a3a4e)":CATS[c]?CATS[c].grad:"#16161e"}:{})}}>
              <span style={{...S.tabDot, background: filter===c?"#fff":col}}/>
              <span style={{...S.tabLbl, ...(filter===c?{color:"#fff"}:{})}}>{l}</span>
            </div>
          ))}
        </div>

        {/* ウォール */}
        <div style={S.wall}>
          {visible.map((it,i)=>{
            const c = CATS[it.category];
            return (
              <div key={it.id} style={S.card} onClick={()=>setMenuId(menuId===it.id?null:it.id)}>
                <div style={{...S.hero, background:c.grad}}>
                  {it._img && <img src={it._img} alt="" style={S.cardHeroImg} />}
                  <span style={S.heroGlow}/>
                  <span style={S.cardCat}>{c.en}</span>
                </div>
                <div style={S.cardBody}>
                  <div style={S.cardTitle}>{it.title}</div>
                  {it.meta && <div style={S.cardMeta}>{it.meta}</div>}
                  {it.chip && <span style={{...S.cardChip, background:c.chip, color:c.chipC}}>{it.chip}</span>}
                </div>
                {/* 誤分類リカバリ：カードタップで分類変更メニュー */}
                {menuId===it.id && (
                  <div style={S.menu} onClick={e=>e.stopPropagation()}>
                    <div style={S.menuHint}>分類を変える</div>
                    {Object.entries(CATS).map(([k,v])=>(
                      <div key={k} style={{...S.menuItem, ...(k===it.category?{opacity:0.4}:{})}} onClick={()=>changeCat(it.id,k)}>
                        <span style={{...S.tabDot, background:v.dot}}/>{v.label}{k===it.category && " ✓"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 放り込むボタン */}
        <div style={S.dock}>
          <div style={S.drop} onClick={()=>setSheet(true)}>
            <span style={S.dropPlus}>＋</span><span style={S.dropTxt}>放り込む</span>
          </div>
        </div>

        {/* ── 放り込みシート ── */}
        {sheet && (
          <div style={S.sheetWrap} onClick={()=>!busy && setSheet(false)}>
            <div style={S.sheet} onClick={e=>e.stopPropagation()}>
              <div style={S.sheetGrip}/>
              {!result ? (
                <>
                  <div style={S.sheetTitle}>気になるを放り込む</div>
                  <div style={S.sheetSub}>URL・テキスト・予定の案内など、何でも貼ってOK</div>
                  <textarea
                    style={S.textarea}
                    placeholder="例：LINEで来たイベント案内を貼り付け、URLを貼る、「渋谷の○○ってバー行きたい」など"
                    value={input}
                    onChange={e=>setInput(e.target.value)}
                    disabled={busy}
                  />

                  {/* 写真を放り込む */}
                  <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={pickImage} />
                  {!image ? (
                    <div style={S.photoBtn} onClick={()=>fileRef.current?.click()}>
                      <span style={{fontSize:18}}>📷</span>
                      <span>スクショ・写真を放り込む</span>
                    </div>
                  ) : (
                    <div style={S.photoPreview}>
                      <img src={image} alt="" style={S.photoThumb} />
                      <div style={{flex:1}}>
                        <div style={{fontSize:13, fontWeight:700, color:"#1a1a24"}}>写真を放り込みました</div>
                        <div style={{fontSize:11, color:"#9a9aaa", marginTop:2}}>AIが画像を読み取ります</div>
                      </div>
                      <div style={S.photoX} onClick={()=>setImage(null)}>✕</div>
                    </div>
                  )}

                  {error && <div style={S.error}>{error}</div>}
                  <div style={S.sheetBtns}>
                    <button style={S.btnGhost} onClick={()=>setSheet(false)} disabled={busy}>やめる</button>
                    <button style={{...S.btnMain, ...(busy||(!input.trim()&&!image)?{opacity:0.5}:{})}}
                      onClick={()=>analyze(input, image)} disabled={busy||(!input.trim()&&!image)}>
                      {busy ? "AIが読み取り中…" : "AIにまかせる →"}
                    </button>
                  </div>
                  {/* お試しサンプル */}
                  <div style={S.samples}>
                    <div style={S.samplesLabel}>試しに放り込む（テキスト）：</div>
                    {[
                      "Amazon Ads Local Osaka Business Accelerator 見逃し配信。期間限定オンライン配信中。フルファネル戦略×AIがテーマ。",
                      "G-SHOCK GW-B5600 楽天で28,600円。黒のやつ欲しい",
                      "来週までにKAISINのキックミットの商品写真撮る",
                      "https://note.com/ Claude Codeで業務自動化する方法まとめ"
                    ].map((s,i)=>(
                      <div key={i} style={S.sampleChip} onClick={()=>{setInput(s);}}>{s.slice(0,22)}…</div>
                    ))}
                  </div>
                </>
              ) : (
                // 解析結果プレビュー
                <>
                  <div style={S.sheetTitle}>AIが読み取りました</div>
                  <div style={S.preview}>
                    <div style={{...S.previewHero, background:CATS[result.category].grad}}>
                      {result._img && <img src={result._img} alt="" style={S.previewImg} />}
                      <span style={S.cardCat}>{CATS[result.category].en}</span>
                    </div>
                    <div style={{padding:"14px 16px 16px"}}>
                      <div style={S.cardTitle}>{result.title}</div>
                      {result.meta && <div style={S.cardMeta}>{result.meta}</div>}
                      {result.chip && <span style={{...S.cardChip, background:CATS[result.category].chip, color:CATS[result.category].chipC}}>{result.chip}</span>}
                    </div>
                  </div>
                  {/* 分類が違ったら直せる */}
                  <div style={S.reclassLabel}>違ったら選び直す</div>
                  <div style={S.reclass}>
                    {Object.entries(CATS).map(([k,v])=>(
                      <div key={k} onClick={()=>setResult({...result, category:k})}
                        style={{...S.reclassChip, ...(k===result.category?{background:v.grad, color:"#fff", borderColor:"transparent"}:{})}}>
                        <span style={{...S.tabDot, background: k===result.category?"#fff":v.dot}}/>{v.label}
                      </div>
                    ))}
                  </div>
                  <div style={S.sheetBtns}>
                    <button style={S.btnGhost} onClick={()=>setResult(null)}>戻る</button>
                    <button style={S.btnMain} onClick={confirmAdd}>箱に入れる ✓</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const S = {
  bg: { minHeight:"100vh", display:"flex", justifyContent:"center", alignItems:"flex-start", padding:"24px 12px",
    background:"radial-gradient(circle at 20% 10%,#ffe8f0 0%,transparent 45%),radial-gradient(circle at 85% 25%,#e8f0ff 0%,transparent 50%),radial-gradient(circle at 50% 90%,#fff0e0 0%,transparent 45%),#f5f5f7",
    fontFamily:"'Inter',-apple-system,'Hiragino Sans',sans-serif" },
  phone: { width:380, height:824, borderRadius:54, overflow:"hidden", position:"relative",
    background:"radial-gradient(circle at 25% 5%,rgba(255,180,210,0.32) 0%,transparent 36%),radial-gradient(circle at 90% 14%,rgba(150,190,255,0.30) 0%,transparent 40%),radial-gradient(circle at 50% 97%,rgba(255,200,140,0.26) 0%,transparent 40%),#f6f6f8",
    boxShadow:"0 50px 130px rgba(80,80,120,0.35), inset 0 0 0 1px rgba(255,255,255,0.6)", border:"1px solid rgba(255,255,255,0.5)" },
  sb: { height:50, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 30px" },
  sbt: { fontSize:15, fontWeight:600, color:"#1a1a2e" }, sbi:{ fontSize:11, color:"#1a1a2e", letterSpacing:1 },
  hd: { padding:"6px 26px 12px", display:"flex", alignItems:"flex-end", justifyContent:"space-between" },
  hdName: { fontSize:26, fontWeight:900, color:"#16161e", letterSpacing:"-0.04em" },
  accent: { background:"linear-gradient(120deg,#ff6b9d,#a06bff,#56c4ff)", WebkitBackgroundClip:"text", backgroundClip:"text", WebkitTextFillColor:"transparent" },
  hdMonth: { fontSize:14, fontWeight:700, color:"#16161e" },
  cal: { margin:"0 18px 6px", padding:"14px 12px 12px", borderRadius:24, background:"rgba(255,255,255,0.7)", backdropFilter:"blur(28px)", WebkitBackdropFilter:"blur(28px)", border:"1px solid rgba(255,255,255,0.9)", boxShadow:"0 8px 26px rgba(100,100,150,0.1)" },
  calWeek: { display:"flex", justifyContent:"space-between" },
  day: { flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:7, padding:"6px 0 8px", borderRadius:16 },
  dayToday: { background:"linear-gradient(135deg,#16161e,#34344a)" },
  dayName: { fontSize:10, fontWeight:600, color:"#b0b0be" }, dayNum:{ fontSize:15, fontWeight:700, color:"#3a3a48" },
  dayDots: { display:"flex", gap:3, height:5 }, dot:{ width:5, height:5, borderRadius:3 },
  calEvents: { marginTop:11, paddingTop:11, borderTop:"1px solid rgba(0,0,0,0.05)" },
  calEv: { display:"flex", alignItems:"center", gap:10 },
  calEvTime: { fontSize:11, fontWeight:700, color:"#6a6a7a", width:42 },
  calEvBar: { width:3, height:26, borderRadius:2 },
  calEvTitle: { fontSize:12.5, fontWeight:600, color:"#1a1a24" }, calEvMeta:{ fontSize:10, color:"#a0a0b0", marginTop:1 },
  boxHead: { padding:"12px 26px 10px", fontSize:12, fontWeight:800, letterSpacing:"0.08em", color:"#16161e" },
  tabs: { display:"flex", gap:6, padding:"0 22px 12px", overflowX:"auto" },
  tab: { display:"flex", alignItems:"center", gap:6, padding:"7px 12px", borderRadius:100, background:"rgba(255,255,255,0.65)", backdropFilter:"blur(20px)", border:"1px solid rgba(255,255,255,0.8)", cursor:"pointer", whiteSpace:"nowrap", flexShrink:0 },
  tabOn: { transform:"scale(1.04)", borderColor:"transparent" },
  tabDot: { width:7, height:7, borderRadius:"50%", flexShrink:0 }, tabLbl:{ fontSize:12, fontWeight:600, color:"#6a6a7a" },
  wall: { padding:"2px 20px 130px", columns:2, columnGap:12, overflowY:"auto", height:"calc(100% - 430px)" },
  card: { breakInside:"avoid", marginBottom:12, borderRadius:22, background:"rgba(255,255,255,0.72)", backdropFilter:"blur(30px)", WebkitBackdropFilter:"blur(30px)", border:"1px solid rgba(255,255,255,0.9)", overflow:"hidden", cursor:"pointer", position:"relative", boxShadow:"0 8px 24px rgba(100,100,150,0.1)" },
  hero: { height:84, position:"relative", overflow:"hidden", display:"flex", alignItems:"flex-end", padding:13 },
  heroGlow: { position:"absolute", top:-30, right:-20, width:80, height:80, borderRadius:"50%", background:"radial-gradient(circle,rgba(255,255,255,0.5),transparent 70%)" },
  cardCat: { position:"absolute", top:13, left:14, fontSize:8.5, fontWeight:800, letterSpacing:"0.18em", color:"rgba(255,255,255,0.95)", textTransform:"uppercase" },
  cardBody: { padding:"12px 14px 15px" },
  cardTitle: { fontSize:13, fontWeight:700, color:"#1a1a24", lineHeight:1.45, marginBottom:5 },
  cardMeta: { fontSize:10.5, color:"#9a9aaa" },
  cardChip: { display:"inline-block", marginTop:9, padding:"5px 11px", borderRadius:100, fontSize:11, fontWeight:600 },
  menu: { position:"absolute", inset:0, background:"rgba(255,255,255,0.96)", backdropFilter:"blur(10px)", padding:12, display:"flex", flexDirection:"column", gap:2, justifyContent:"center" },
  menuHint: { fontSize:9, fontWeight:700, color:"#aaa", letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:4, textAlign:"center" },
  menuItem: { display:"flex", alignItems:"center", gap:8, padding:"7px 10px", borderRadius:10, fontSize:12, fontWeight:600, color:"#333", cursor:"pointer" },
  dock: { position:"absolute", bottom:0, left:0, right:0, padding:"16px 26px 30px", background:"linear-gradient(to top,rgba(246,246,248,0.96) 55%,transparent)" },
  drop: { height:56, borderRadius:19, background:"linear-gradient(120deg,#16161e,#34344a)", display:"flex", alignItems:"center", justifyContent:"center", gap:9, cursor:"pointer", boxShadow:"0 12px 32px rgba(30,30,50,0.35)" },
  dropPlus: { fontSize:20, fontWeight:300, color:"#fff" }, dropTxt:{ fontSize:15, fontWeight:700, color:"#fff" },
  sheetWrap: { position:"absolute", inset:0, background:"rgba(10,10,20,0.4)", backdropFilter:"blur(4px)", display:"flex", alignItems:"flex-end", zIndex:100 },
  sheet: { width:"100%", background:"#fbfbfd", borderRadius:"28px 28px 0 0", padding:"12px 22px 30px", maxHeight:"82%", overflowY:"auto", boxShadow:"0 -10px 40px rgba(0,0,0,0.2)" },
  sheetGrip: { width:38, height:5, borderRadius:3, background:"#ddd", margin:"0 auto 16px" },
  sheetTitle: { fontSize:18, fontWeight:800, color:"#16161e", marginBottom:4, letterSpacing:"-0.02em" },
  sheetSub: { fontSize:12, color:"#9a9aaa", marginBottom:16 },
  textarea: { width:"100%", minHeight:100, borderRadius:16, border:"1px solid #e8e8ee", background:"#fff", padding:14, fontSize:13, fontFamily:"inherit", color:"#1a1a24", resize:"none", outline:"none", lineHeight:1.6 },
  error: { color:"#f0436c", fontSize:12, marginTop:8 },
  sheetBtns: { display:"flex", gap:10, marginTop:14 },
  btnGhost: { flex:1, height:50, borderRadius:15, border:"1px solid #e8e8ee", background:"#fff", fontSize:14, fontWeight:600, color:"#888", cursor:"pointer" },
  btnMain: { flex:2, height:50, borderRadius:15, border:"none", background:"linear-gradient(120deg,#16161e,#34344a)", fontSize:14, fontWeight:700, color:"#fff", cursor:"pointer" },
  samples: { marginTop:20 },
  samplesLabel: { fontSize:11, fontWeight:700, color:"#aaa", marginBottom:8 },
  sampleChip: { padding:"9px 13px", borderRadius:12, background:"#f2f2f6", fontSize:11.5, color:"#666", marginBottom:6, cursor:"pointer", border:"1px solid #ececf0" },
  preview: { borderRadius:18, overflow:"hidden", border:"1px solid #eee", background:"#fff", marginBottom:16, boxShadow:"0 4px 16px rgba(0,0,0,0.06)" },
  previewHero: { height:72, position:"relative", display:"flex", alignItems:"flex-end", padding:13 },
  reclassLabel: { fontSize:11, fontWeight:700, color:"#aaa", marginBottom:8 },
  reclass: { display:"flex", gap:6, flexWrap:"wrap", marginBottom:4 },
  reclassChip: { display:"flex", alignItems:"center", gap:6, padding:"7px 12px", borderRadius:100, border:"1px solid #e8e8ee", background:"#fff", fontSize:12, fontWeight:600, color:"#666", cursor:"pointer" },
  photoBtn: { marginTop:10, height:52, borderRadius:14, border:"1.5px dashed #d8d8e2", background:"#fafafb", display:"flex", alignItems:"center", justifyContent:"center", gap:8, fontSize:13, fontWeight:600, color:"#888", cursor:"pointer" },
  photoPreview: { marginTop:10, padding:10, borderRadius:14, border:"1px solid #e8e8ee", background:"#fff", display:"flex", alignItems:"center", gap:12 },
  photoThumb: { width:48, height:48, borderRadius:10, objectFit:"cover", flexShrink:0 },
  photoX: { width:26, height:26, borderRadius:13, background:"#f2f2f6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, color:"#999", cursor:"pointer", flexShrink:0 },
  previewImg: { position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:0.55 },
  cardHeroImg: { position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", opacity:0.55 },
};
