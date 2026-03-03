import { useState, useRef, useEffect } from "react";

// ─── PACKING ─────────────────────────────────────────────────────────────────
function packPieces(sheetW, sheetH, pieces, kerf = 3) {
  const placed = [], unplaced = [];
  const sheets = [{ w: sheetW, h: sheetH, spaces: [{ x: 0, y: 0, w: sheetW, h: sheetH }] }];
  const expanded = [];
  pieces.forEach((p) => { for (let i = 0; i < p.qty; i++) expanded.push({ ...p }); });
  expanded.sort((a, b) => b.w * b.h - a.w * a.h);

  for (const piece of expanded) {
    if (piece.w > sheetW || piece.h > sheetH) { unplaced.push(piece); continue; }
    let best = null, bestSi = -1, bestRot = false;
    const tryFit = (si, sp, rot) => {
      const pw = rot ? piece.h : piece.w, ph = rot ? piece.w : piece.h;
      if (pw > sp.w || ph > sp.h) return;
      const waste = sp.w * sp.h - pw * ph;
      if (!best || waste < best.waste) { best = { sp, waste, pw, ph }; bestSi = si; bestRot = rot; }
    };
    for (let si = 0; si < sheets.length; si++)
      for (const sp of sheets[si].spaces) { tryFit(si, sp, false); if (piece.w !== piece.h) tryFit(si, sp, true); }
    if (!best) {
      sheets.push({ w: sheetW, h: sheetH, spaces: [{ x: 0, y: 0, w: sheetW, h: sheetH }] });
      bestSi = sheets.length - 1;
      for (const sp of sheets[bestSi].spaces) { tryFit(bestSi, sp, false); if (piece.w !== piece.h) tryFit(bestSi, sp, true); }
    }
    const { sp, pw, ph } = best;
    placed.push({ sheetIndex: bestSi, x: sp.x, y: sp.y, w: pw, h: ph, rotated: bestRot, id: piece.id, label: piece.label, origW: piece.w, origH: piece.h });
    const sheet = sheets[bestSi];
    sheet.spaces = sheet.spaces.filter((s) => s !== sp);
    const rw = sp.w - pw - kerf, rh = sp.h - ph - kerf;
    if (rw > 0) sheet.spaces.push({ x: sp.x + pw + kerf, y: sp.y, w: rw, h: sp.h });
    if (rh > 0) sheet.spaces.push({ x: sp.x, y: sp.y + ph + kerf, w: pw, h: sp.h - ph - kerf });
  }
  const cutsPerSheet = Array.from({ length: sheets.length }, () => 0);
  const cutLengthPerSheet = Array.from({ length: sheets.length }, () => 0);
  for (let si = 0; si < sheets.length; si++) {
    placed.filter(p => p.sheetIndex === si).forEach(p => {
      cutsPerSheet[si] += 2;
      cutLengthPerSheet[si] += p.w + p.h;
    });
  }
  return { placed, unplaced, sheetCount: sheets.length, cutsPerSheet, cutLengthPerSheet };
}

const COLORS = ["#4F86C6","#E8834D","#5BB98B","#C05F8A","#7B6CD4","#C4A73A","#4AABB8","#D45F5F","#82B84A","#8F7EC4","#D48B4A","#5A9EC9","#C96B6B","#6BC996","#C96BAD"];

function SheetCanvas({ sheetW, sheetH, placements, maxW }) {
  const RULER = 22, PAD_R = 6, PAD_B = 14;
  const MAX_W = maxW || 560, MAX_H = 400;
  const scale = Math.min((MAX_W - RULER - PAD_R) / sheetW, (MAX_H - RULER - PAD_B) / sheetH);
  const dw = sheetW * scale, dh = sheetH * scale;
  const totalW = dw + RULER + PAD_R, totalH = dh + RULER + PAD_B;
  const stepMm = sheetW > 2000 ? 500 : sheetW > 1000 ? 250 : 100;
  const hTicks = [], vTicks = [];
  for (let x = 0; x <= sheetW; x += stepMm) hTicks.push(x);
  for (let y = 0; y <= sheetH; y += stepMm) vTicks.push(y);

  return (
    <svg width={totalW} height={totalH} style={{ display: "block", maxWidth: "100%" }}>
      <rect x={0} y={0} width={RULER} height={totalH} fill="#101e2d"/>
      <rect x={0} y={0} width={totalW} height={RULER} fill="#101e2d"/>
      <rect x={0} y={0} width={RULER} height={RULER} fill="#0a1520"/>
      {hTicks.map(x => {
        const px = RULER + x * scale;
        return <g key={"ht"+x}>
          <line x1={px} y1={RULER-6} x2={px} y2={RULER} stroke="#2a6a9a" strokeWidth="1"/>
          {x > 0 && x < sheetW && <text x={px} y={RULER-8} textAnchor="middle" fontSize="7" fill="#3a7aaa" fontFamily="monospace">{x}</text>}
        </g>;
      })}
      {vTicks.map(y => {
        const py = RULER + y * scale;
        return <g key={"vt"+y}>
          <line x1={RULER-6} y1={py} x2={RULER} y2={py} stroke="#2a6a9a" strokeWidth="1"/>
          {y > 0 && y < sheetH && <text x={RULER-8} y={py+3} textAnchor="end" fontSize="7" fill="#3a7aaa" fontFamily="monospace">{y}</text>}
        </g>;
      })}
      <rect x={RULER} y={RULER} width={dw} height={dh} fill="#c8e8f4" stroke="#5a9ab8" strokeWidth="1.5"/>
      {hTicks.filter(x=>x>0&&x<sheetW).map(x=>(
        <line key={"gv"+x} x1={RULER+x*scale} y1={RULER} x2={RULER+x*scale} y2={RULER+dh} stroke="#a0c8dc" strokeWidth="0.4" strokeDasharray="3,4"/>
      ))}
      {vTicks.filter(y=>y>0&&y<sheetH).map(y=>(
        <line key={"gh"+y} x1={RULER} y1={RULER+y*scale} x2={RULER+dw} y2={RULER+y*scale} stroke="#a0c8dc" strokeWidth="0.4" strokeDasharray="3,4"/>
      ))}
      {placements.map((p, i) => {
        const px = RULER + p.x * scale, py = RULER + p.y * scale;
        const pw = p.w * scale, ph = p.h * scale;
        const col = COLORS[p.id % COLORS.length];
        const fs = Math.max(6, Math.min(12, pw / 7, ph / 3));
        return <g key={i}>
          <rect x={px} y={py} width={pw} height={ph} fill={col} fillOpacity="0.88" stroke="rgba(255,255,255,0.6)" strokeWidth="1" rx="1"/>
          {pw > 28 && ph > 18 && <>
            <text x={px+pw/2} y={py+ph/2-(fs*0.55)} textAnchor="middle" fontSize={fs} fontWeight="700" fill="#fff" fontFamily="monospace">
              {p.rotated ? `↺${p.origH}×${p.origW}` : `${p.origW}×${p.origH}`}
            </text>
            <text x={px+pw/2} y={py+ph/2+(fs*0.85)} textAnchor="middle" fontSize={Math.max(5,fs-1.5)} fill="rgba(255,255,255,0.75)" fontFamily="monospace">{p.label}</text>
          </>}
        </g>;
      })}
      <text x={RULER+dw/2} y={RULER+dh+PAD_B-2} textAnchor="middle" fontSize="8" fill="#5a9ab8" fontFamily="monospace">{sheetW} mm</text>
    </svg>
  );
}

const inp = { flex:1, background:"#07111a", border:"1px solid #1a3248", color:"#7ab8d4", padding:"9px 10px", borderRadius:6, fontSize:14, fontFamily:"monospace", outline:"none", minWidth:0 };
const addBtnSt = { marginTop:6, padding:"10px", background:"transparent", border:"1px dashed #1e4a6a", color:"#3a7aaa", borderRadius:6, fontSize:12, cursor:"pointer", width:"100%", fontFamily:"monospace" };
const removeBtnSt = { width:32, height:36, background:"transparent", border:"1px solid #1a2e40", color:"#2a5a7a", borderRadius:5, cursor:"pointer", fontSize:12, flexShrink:0 };

function SectionTitle({children}) {
  return <div style={{fontSize:10,fontWeight:700,color:"#2a6a9a",letterSpacing:2,marginBottom:10,textTransform:"uppercase"}}>{children}</div>;
}
function StatPanel({title,children}) {
  return (
    <div style={{background:"#0d1e2e",border:"1px solid #142030",borderRadius:8,padding:"12px 14px"}}>
      <div style={{fontSize:8,fontWeight:700,color:"#2a5a7a",letterSpacing:2,marginBottom:10,textTransform:"uppercase"}}>{title}</div>
      {children}
    </div>
  );
}
function StatRow({label,value,highlight,warn}) {
  const col = highlight?"#6ad4f2":warn&&value&&value!=="0"?"#e08080":"#8ab8d0";
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:6,fontSize:11}}>
      <span style={{color:"#2a5a7a",fontSize:10}}>{label}</span>
      <span style={{color:col,fontWeight:highlight?900:700}}>{value}</span>
    </div>
  );
}

export default function App() {
  const [pieces, setPieces] = useState([{ id:0, w:"", h:"", qty:1, label:"A" }]);
  const [sheets, setSheets] = useState([{ w:3210, h:2250, qty:10 }]);
  const [kerf, setKerf] = useState(3);
  const [allowRot, setAllowRot] = useState(true);
  const [result, setResult] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showInputs, setShowInputs] = useState(true);
  const printRef = useRef();
  const resultRef = useRef();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const addPiece = () => { const n=pieces.length; setPieces([...pieces,{id:n,w:"",h:"",qty:1,label:String.fromCharCode(65+n%26)}]); };
  const updPiece = (i,f,v) => { const a=[...pieces]; a[i]={...a[i],[f]:v}; setPieces(a); };
  const addSheet = () => setSheets([...sheets,{w:3210,h:2250,qty:1}]);
  const updSheet = (i,f,v) => { const a=[...sheets]; a[i]={...a[i],[f]:v}; setSheets(a); };

  const calc = () => {
    const vp = pieces.map(p=>({...p,w:parseInt(p.w),h:parseInt(p.h),qty:parseInt(p.qty)||1})).filter(p=>p.w>0&&p.h>0);
    if(!vp.length) return;
    const sw=parseInt(sheets[0]?.w)||3210, sh=parseInt(sheets[0]?.h)||2250;
    const res = packPieces(sw, sh, vp, parseInt(kerf)||3);
    const {placed,unplaced,sheetCount,cutsPerSheet,cutLengthPerSheet} = res;
    const sa = sw*sh;
    const util = Array.from({length:sheetCount},(_,si)=>{
      const used = placed.filter(p=>p.sheetIndex===si).reduce((s,p)=>s+p.w*p.h,0);
      return { pct: ((used/sa)*100).toFixed(1), used, wasted: sa - used };
    });
    const totalUsed = placed.reduce((s,p)=>s+p.w*p.h,0);
    const totalPieces = vp.reduce((s,p)=>s+p.qty,0);
    const totalWasted = sheetCount*sa - totalUsed;
    const totalCuts = cutsPerSheet.reduce((a,b)=>a+b,0);
    const totalCutLen = cutLengthPerSheet.reduce((a,b)=>a+b,0);
    setResult({placed,unplaced,sheetCount,sw,sh,util,overall:((totalUsed/(sheetCount*sa))*100).toFixed(1),totalPieces,totalWasted,totalUsed,totalCuts,totalCutLen,sheetArea:sa});
    if (isMobile) {
      setShowInputs(false);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const printPDF = () => {
    const win = window.open("","_blank");
    win.document.write(`<!DOCTYPE html><html><head><title>Nářezový plán</title>
    <style>body{font-family:monospace;background:#fff;color:#000;padding:16px}
    svg{background:#f5faff}.row{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
    .box{border:1px solid #ccc;border-radius:6px;padding:8px 14px;min-width:100px}
    .lbl{font-size:9px;color:#666;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
    .val{font-size:18px;font-weight:700}h1{font-size:16px;margin:0 0 4px}
    .meta{font-size:11px;color:#555;margin-bottom:14px}
    @media print{@page{margin:10mm}}</style></head><body>
    <h1>GlassCut Pro — Nářezový plán</h1>
    <div class="meta">Formát: ${result?.sw}×${result?.sh} mm | Tabulí: ${result?.sheetCount} | Kusů: ${result?.totalPieces} | Využití: ${result?.overall}% | Řez: ${kerf} mm</div>
    <div class="row">
      <div class="box"><div class="lbl">Tabulí</div><div class="val">${result?.sheetCount}</div></div>
      <div class="box"><div class="lbl">Kusů</div><div class="val">${result?.totalPieces}</div></div>
      <div class="box"><div class="lbl">Využití</div><div class="val">${result?.overall}%</div></div>
      <div class="box"><div class="lbl">Odpad</div><div class="val">${((result?.totalWasted||0)/1e6).toFixed(3)} m²</div></div>
      <div class="box"><div class="lbl">Řezů</div><div class="val">${result?.totalCuts}</div></div>
    </div>
    ${printRef.current?.innerHTML||''}
    </body></html>`);
    win.document.close(); win.focus(); setTimeout(()=>win.print(),600);
  };

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{minHeight:"100vh",background:"#0a1620",color:"#c0ddf0",fontFamily:"monospace",display:"flex",flexDirection:"column"}}>
        {/* Header */}
        <div style={{background:"#0d1e2e",borderBottom:"2px solid #1a3a54",padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:28,height:28,background:"linear-gradient(135deg,#3a76b6,#144060)",borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>◫</div>
            <div>
              <div style={{fontSize:13,fontWeight:900,letterSpacing:2,color:"#6ab2d0"}}>GLASSCUT PRO</div>
              <div style={{fontSize:8,color:"#2a5a7a"}}>AGC LDC Olomouc</div>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            {result && <button onClick={printPDF} style={{padding:"7px 12px",background:"transparent",border:"1px solid #2a6a9a",color:"#6ab2d0",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"monospace"}}>⬇ PDF</button>}
            <button onClick={()=>setShowInputs(!showInputs)} style={{padding:"7px 12px",background:showInputs?"#1a3a52":"transparent",border:"1px solid #2a6a9a",color:"#6ab2d0",borderRadius:5,fontSize:10,cursor:"pointer",fontFamily:"monospace"}}>
              {showInputs ? "▼ Vstupy" : "▲ Vstupy"}
            </button>
          </div>
        </div>

        {/* Inputs (collapsible on mobile) */}
        {showInputs && (
          <div style={{background:"#0d1a26",padding:"16px",borderBottom:"1px solid #1a3048"}}>
            {/* Pieces */}
            <div style={{marginBottom:18}}>
              <SectionTitle>🔲 Požadované kusy</SectionTitle>
              <div style={{display:"flex",gap:4,fontSize:9,color:"#1e5a7a",marginBottom:6}}>
                <span style={{width:28}}></span>
                <span style={{flex:1,textAlign:"center"}}>DÉLKA mm</span>
                <span style={{flex:1,textAlign:"center"}}>ŠÍŘKA mm</span>
                <span style={{width:52,textAlign:"center"}}>KS</span>
                <span style={{width:32}}></span>
              </div>
              {pieces.map((p,i)=>(
                <div key={i} style={{display:"flex",gap:4,marginBottom:6,alignItems:"center"}}>
                  <div style={{width:28,height:36,background:COLORS[p.id%COLORS.length],borderRadius:4,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:900,color:"#fff",flexShrink:0}}>{p.label}</div>
                  <input type="number" placeholder="800" value={p.w} onChange={e=>updPiece(i,"w",e.target.value)} style={inp} inputMode="numeric"/>
                  <input type="number" placeholder="600" value={p.h} onChange={e=>updPiece(i,"h",e.target.value)} style={inp} inputMode="numeric"/>
                  <input type="number" min="1" value={p.qty} onChange={e=>updPiece(i,"qty",e.target.value)} style={{...inp,width:52,flex:"none"}} inputMode="numeric"/>
                  <button onClick={()=>setPieces(pieces.filter((_,x)=>x!==i))} style={removeBtnSt}>✕</button>
                </div>
              ))}
              <button onClick={addPiece} style={addBtnSt}>+ Přidat kus</button>
            </div>

            {/* Sheets */}
            <div style={{marginBottom:18}}>
              <SectionTitle>🪟 Výchozí tabule</SectionTitle>
              <div style={{display:"flex",gap:4,fontSize:9,color:"#1e5a7a",marginBottom:6}}>
                <span style={{flex:1,textAlign:"center"}}>DÉLKA mm</span>
                <span style={{flex:1,textAlign:"center"}}>ŠÍŘKA mm</span>
                <span style={{width:60,textAlign:"center"}}>SKLAD</span>
                <span style={{width:32}}></span>
              </div>
              {sheets.map((s,i)=>(
                <div key={i} style={{display:"flex",gap:4,marginBottom:6,alignItems:"center"}}>
                  <input type="number" value={s.w} onChange={e=>updSheet(i,"w",e.target.value)} style={inp} inputMode="numeric"/>
                  <input type="number" value={s.h} onChange={e=>updSheet(i,"h",e.target.value)} style={inp} inputMode="numeric"/>
                  <input type="number" min="1" value={s.qty} onChange={e=>updSheet(i,"qty",e.target.value)} style={{...inp,width:60,flex:"none"}} inputMode="numeric"/>
                  <button onClick={()=>setSheets(sheets.filter((_,x)=>x!==i))} style={removeBtnSt}>✕</button>
                </div>
              ))}
              <button onClick={addSheet} style={addBtnSt}>+ Přidat formát</button>
            </div>

            {/* Settings */}
            <div style={{marginBottom:16}}>
              <SectionTitle>⚙ Nastavení</SectionTitle>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <span style={{fontSize:12,color:"#4a8aaa",minWidth:130}}>Šíře řezu (mm):</span>
                <input type="number" value={kerf} min={0} max={10} onChange={e=>setKerf(e.target.value)} style={{...inp,width:60,flex:"none"}} inputMode="numeric"/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <span style={{fontSize:12,color:"#4a8aaa",minWidth:130}}>Povolit rotaci:</span>
                <div onClick={()=>setAllowRot(!allowRot)} style={{width:40,height:22,background:allowRot?"#1e5a8a":"#1a2a3a",borderRadius:11,position:"relative",cursor:"pointer",border:"1px solid #2a5a7a"}}>
                  <div style={{position:"absolute",top:2,left:allowRot?19:2,width:16,height:16,background:allowRot?"#6ab8e0":"#3a5a7a",borderRadius:"50%",transition:"left 0.2s"}}/>
                </div>
              </div>
            </div>

            <button onClick={calc} style={{width:"100%",padding:"14px",background:"linear-gradient(135deg,#1a4466,#0c2236)",color:"#6ad4f2",border:"1px solid #2060a0",borderRadius:8,fontSize:15,fontWeight:900,letterSpacing:2,cursor:"pointer",textTransform:"uppercase",fontFamily:"monospace"}}>
              ▶ Vypočítat nářez
            </button>
          </div>
        )}

        {/* Results */}
        <div ref={resultRef} style={{padding:"16px",flex:1}}>
          {!result ? (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 0",color:"#132030",textAlign:"center",gap:12}}>
              <div style={{fontSize:60}}>◫</div>
              <div style={{fontSize:11,letterSpacing:2,color:"#1a3a54"}}>ZADEJTE KUSY A VYPOČÍTEJTE</div>
            </div>
          ) : (
            <>
              {/* Quick stats row */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
                {[["🪟","Tabulí",result.sheetCount],["🔲","Kusů",result.totalPieces],["📊","Využití",result.overall+"%"],["♻️","Odpad",((result.totalWasted/1e6).toFixed(2))+" m²"]].map(([ic,lb,vl],i)=>(
                  <div key={i} style={{background:"#0d1e2e",border:"1px solid #142030",borderRadius:8,padding:"10px 12px"}}>
                    <div style={{fontSize:13,marginBottom:2}}>{ic}</div>
                    <div style={{fontSize:8,color:"#2a5a7a",letterSpacing:1,marginBottom:2}}>{lb}</div>
                    <div style={{fontSize:18,fontWeight:900,color:i===2?"#6ad4f2":"#c0ddf0"}}>{vl}</div>
                  </div>
                ))}
              </div>

              {/* Unplaced warning */}
              {result.unplaced.length > 0 && (
                <div style={{background:"#2a1010",border:"1px solid #7a2020",borderRadius:7,padding:"10px 14px",marginBottom:14,fontSize:11,color:"#f08080"}}>
                  ⚠ {result.unplaced.length} kus(ů) nelze umístit
                </div>
              )}

              {/* Sheets */}
              <div ref={printRef}>
                {Array.from({length:result.sheetCount}).map((_,si)=>{
                  const sp=result.placed.filter(p=>p.sheetIndex===si);
                  const u=result.util[si];
                  const pct=parseFloat(u.pct);
                  const col=pct>70?"#5BB98B":pct>40?"#C4A73A":"#C05F8A";
                  return (
                    <div key={si} style={{marginBottom:20}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                        <div style={{fontSize:10,color:"#3a7aaa",letterSpacing:1}}>▸ TABULE {si+1}</div>
                        <div style={{height:1,flex:1,background:"#0f2030"}}/>
                        <div style={{fontSize:11,color:col,fontWeight:700}}>{u.pct}%</div>
                      </div>
                      <div style={{background:"#0d1e2e",borderRadius:8,padding:"8px",border:"1px solid #142030",overflowX:"auto"}}>
                        <SheetCanvas sheetW={result.sw} sheetH={result.sh} placements={sp} maxW={window.innerWidth - 60}/>
                      </div>
                      <div style={{marginTop:6,display:"flex",gap:4,flexWrap:"wrap"}}>
                        {sp.map((p,i)=>(
                          <div key={i} style={{display:"flex",alignItems:"center",gap:4,background:"#0d1a24",border:"1px solid #122030",borderRadius:4,padding:"3px 8px",fontSize:9}}>
                            <div style={{width:7,height:7,background:COLORS[p.id%COLORS.length],borderRadius:1,flexShrink:0}}/>
                            <span style={{color:"#5a9ab8",fontWeight:700}}>{p.label}</span>
                            <span style={{color:"#2a5a7a"}}>{p.origW}×{p.origH}{p.rotated?" ↺":""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Stats panels */}
              <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:4}}>
                <StatPanel title="Detailní statistiky">
                  <StatRow label="Použité tabule" value={`${result.sheetCount}×${result.sw}×${result.sh}`}/>
                  <StatRow label="Celkem kusů" value={result.totalPieces}/>
                  <StatRow label="Nevmístěné" value={result.unplaced.length} warn={true}/>
                  <div style={{height:1,background:"#0f2030",margin:"6px 0"}}/>
                  <StatRow label="Využitá plocha" value={`${(result.totalUsed/1e6).toFixed(3)} m²`}/>
                  <StatRow label="Odpad celkem" value={`${(result.totalWasted/1e6).toFixed(3)} m²`} warn={true}/>
                  <StatRow label="Využití" value={result.overall+"%"} highlight={true}/>
                  <div style={{height:1,background:"#0f2030",margin:"6px 0"}}/>
                  <StatRow label="Počet řezů" value={result.totalCuts}/>
                  <StatRow label="Délka řezů" value={`${(result.totalCutLen/1000).toFixed(1)} m`}/>
                </StatPanel>

                <StatPanel title="Využití po tabulích">
                  {result.util.map((u,i)=>{
                    const v=parseFloat(u.pct);
                    const col=v>70?"#5BB98B":v>40?"#C4A73A":"#C05F8A";
                    return <div key={i} style={{marginBottom:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,marginBottom:3}}>
                        <span style={{color:"#3a6a8a"}}>Tabule {i+1}</span>
                        <span style={{color:col,fontWeight:700}}>{u.pct}%</span>
                      </div>
                      <div style={{height:6,background:"#0a1620",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:u.pct+"%",background:col,borderRadius:3}}/>
                      </div>
                    </div>;
                  })}
                </StatPanel>
              </div>

              {/* PDF button at bottom on mobile */}
              <button onClick={printPDF} style={{width:"100%",marginTop:16,padding:"14px",background:"transparent",border:"1px solid #2a6a9a",color:"#6ab2d0",borderRadius:8,fontSize:13,cursor:"pointer",letterSpacing:1,fontFamily:"monospace"}}>
                ⬇ Exportovat / Tisknout PDF
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div style={{height:"100vh",background:"#0a1620",color:"#c0ddf0",fontFamily:"monospace",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <div style={{background:"#0d1e2e",borderBottom:"2px solid #1a3a54",padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,background:"linear-gradient(135deg,#3a76b6,#144060)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,color:"#fff"}}>◫</div>
          <div>
            <div style={{fontSize:15,fontWeight:900,letterSpacing:3,color:"#6ab2d0",textTransform:"uppercase"}}>GlassCut Pro</div>
            <div style={{fontSize:8,color:"#2a5a7a",letterSpacing:1}}>Nářezový plán · AGC LDC Olomouc</div>
          </div>
        </div>
        {result && <button onClick={printPDF} style={{padding:"7px 18px",background:"transparent",border:"1px solid #2a6a9a",color:"#6ab2d0",borderRadius:6,fontSize:10,cursor:"pointer",letterSpacing:1,fontFamily:"monospace"}}>⬇ Export PDF</button>}
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        <div style={{width:310,background:"#0d1a26",borderRight:"1px solid #172840",padding:"14px 12px",overflowY:"auto",flexShrink:0,display:"flex",flexDirection:"column",gap:16}}>
          <div>
            <SectionTitle>🔲 Požadované kusy</SectionTitle>
            <div style={{display:"flex",gap:4,fontSize:8,color:"#1e5a7a",marginBottom:4}}>
              <span style={{width:22}}></span><span style={{flex:1,textAlign:"center"}}>DÉLKA mm</span><span style={{flex:1,textAlign:"center"}}>ŠÍŘKA mm</span><span style={{width:42,textAlign:"center"}}>KS</span><span style={{width:26}}></span>
            </div>
            {pieces.map((p,i)=>(
              <div key={i} style={{display:"flex",gap:4,marginBottom:4,alignItems:"center"}}>
                <div style={{width:22,height:28,background:COLORS[p.id%COLORS.length],borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:900,color:"#fff",flexShrink:0}}>{p.label}</div>
                <input type="number" placeholder="800" value={p.w} onChange={e=>updPiece(i,"w",e.target.value)} style={inp}/>
                <input type="number" placeholder="600" value={p.h} onChange={e=>updPiece(i,"h",e.target.value)} style={inp}/>
                <input type="number" min="1" value={p.qty} onChange={e=>updPiece(i,"qty",e.target.value)} style={{...inp,width:42,flex:"none"}}/>
                <button onClick={()=>setPieces(pieces.filter((_,x)=>x!==i))} style={removeBtnSt}>✕</button>
              </div>
            ))}
            <button onClick={addPiece} style={addBtnSt}>+ Přidat kus</button>
          </div>

          <div>
            <SectionTitle>🪟 Výchozí tabule</SectionTitle>
            <div style={{display:"flex",gap:4,fontSize:8,color:"#1e5a7a",marginBottom:4}}>
              <span style={{flex:1,textAlign:"center"}}>DÉLKA mm</span><span style={{flex:1,textAlign:"center"}}>ŠÍŘKA mm</span><span style={{width:50,textAlign:"center"}}>SKLAD</span><span style={{width:26}}></span>
            </div>
            {sheets.map((s,i)=>(
              <div key={i} style={{display:"flex",gap:4,marginBottom:4,alignItems:"center"}}>
                <input type="number" value={s.w} onChange={e=>updSheet(i,"w",e.target.value)} style={inp} placeholder="3210"/>
                <input type="number" value={s.h} onChange={e=>updSheet(i,"h",e.target.value)} style={inp} placeholder="2250"/>
                <input type="number" min="1" value={s.qty} onChange={e=>updSheet(i,"qty",e.target.value)} style={{...inp,width:50,flex:"none"}} placeholder="10"/>
                <button onClick={()=>setSheets(sheets.filter((_,x)=>x!==i))} style={removeBtnSt}>✕</button>
              </div>
            ))}
            <button onClick={addSheet} style={addBtnSt}>+ Přidat formát</button>
          </div>

          <div>
            <SectionTitle>⚙ Nastavení</SectionTitle>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:10,color:"#4a8aaa",minWidth:110}}>Šíře řezu (mm):</span>
              <input type="number" value={kerf} min={0} max={10} onChange={e=>setKerf(e.target.value)} style={{...inp,width:50,flex:"none"}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:10,color:"#4a8aaa",minWidth:110}}>Povolit rotaci:</span>
              <div onClick={()=>setAllowRot(!allowRot)} style={{width:36,height:20,background:allowRot?"#1e5a8a":"#1a2a3a",borderRadius:10,position:"relative",cursor:"pointer",border:"1px solid #2a5a7a",transition:"background 0.2s"}}>
                <div style={{position:"absolute",top:2,left:allowRot?17:2,width:14,height:14,background:allowRot?"#6ab8e0":"#3a5a7a",borderRadius:"50%",transition:"left 0.2s"}}/>
              </div>
            </div>
          </div>

          <div style={{marginTop:"auto",paddingTop:8}}>
            <button onClick={calc} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#1a4466,#0c2236)",color:"#6ad4f2",border:"1px solid #2060a0",borderRadius:7,fontSize:13,fontWeight:900,letterSpacing:2,cursor:"pointer",textTransform:"uppercase",fontFamily:"monospace"}}>
              ▶ Vypočítat
            </button>
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:14,background:"#0a1620"}}>
          {!result ? (
            <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#132030",textAlign:"center",gap:10}}>
              <div style={{fontSize:70}}>◫</div>
              <div style={{fontSize:11,letterSpacing:3,color:"#1a3a54"}}>ZADEJTE KUSY A STISKNĚTE VYPOČÍTAT</div>
            </div>
          ) : (
            <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0}}>
                {result.unplaced.length > 0 && (
                  <div style={{background:"#2a1010",border:"1px solid #7a2020",borderRadius:7,padding:"9px 12px",marginBottom:12,fontSize:10,color:"#f08080"}}>
                    ⚠ {result.unplaced.length} kus(ů) nelze umístit: {result.unplaced.map(p=>`${p.w}×${p.h}`).join(", ")}
                  </div>
                )}
                <div ref={printRef}>
                  {Array.from({length:result.sheetCount}).map((_,si)=>{
                    const sp=result.placed.filter(p=>p.sheetIndex===si);
                    const u=result.util[si];
                    const pct=parseFloat(u.pct);
                    const col=pct>70?"#5BB98B":pct>40?"#C4A73A":"#C05F8A";
                    return (
                      <div key={si} style={{marginBottom:22}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                          <div style={{fontSize:9,color:"#3a7aaa",letterSpacing:2}}>▸ TABULE {si+1}</div>
                          <div style={{height:1,flex:1,background:"#0f2030"}}/>
                          <div style={{fontSize:10,color:col,fontWeight:700}}>{u.pct}%</div>
                          <div style={{fontSize:8,color:"#2a5a7a"}}>odpad: {(u.wasted/1e6).toFixed(4)} m²</div>
                        </div>
                        <div style={{background:"#0d1e2e",borderRadius:7,padding:"8px",border:"1px solid #142030",display:"inline-block",maxWidth:"100%",overflowX:"auto"}}>
                          <SheetCanvas sheetW={result.sw} sheetH={result.sh} placements={sp}/>
                        </div>
                        <div style={{marginTop:6,display:"flex",gap:4,flexWrap:"wrap"}}>
                          {sp.map((p,i)=>(
                            <div key={i} style={{display:"flex",alignItems:"center",gap:4,background:"#0d1a24",border:"1px solid #122030",borderRadius:4,padding:"2px 7px",fontSize:8}}>
                              <div style={{width:6,height:6,background:COLORS[p.id%COLORS.length],borderRadius:1,flexShrink:0}}/>
                              <span style={{color:"#5a9ab8",fontWeight:700}}>{p.label}</span>
                              <span style={{color:"#2a5a7a"}}>{p.origW}×{p.origH}{p.rotated?" ↺":""}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{width:185,flexShrink:0,display:"flex",flexDirection:"column",gap:10}}>
                <StatPanel title="Globální statistiky">
                  <StatRow label="Formát tabule" value={`${result.sw}×${result.sh}`}/>
                  <StatRow label="Použité tabule" value={result.sheetCount}/>
                  <StatRow label="Celkem kusů" value={result.totalPieces}/>
                  <StatRow label="Nevmístěné" value={result.unplaced.length} warn={true}/>
                  <div style={{height:1,background:"#0f2030",margin:"6px 0"}}/>
                  <StatRow label="Využitá plocha" value={`${(result.totalUsed/1e6).toFixed(3)} m²`}/>
                  <StatRow label="Odpad celkem" value={`${(result.totalWasted/1e6).toFixed(3)} m²`} warn={true}/>
                  <StatRow label="Využití" value={result.overall+"%"} highlight={true}/>
                  <div style={{height:1,background:"#0f2030",margin:"6px 0"}}/>
                  <StatRow label="Počet řezů" value={result.totalCuts}/>
                  <StatRow label="Délka řezů" value={`${(result.totalCutLen/1000).toFixed(1)} m`}/>
                  <StatRow label="Šíře řezu" value={`${kerf} mm`}/>
                </StatPanel>
                <StatPanel title="Využití po tabulích">
                  {result.util.map((u,i)=>{
                    const v=parseFloat(u.pct);
                    const col=v>70?"#5BB98B":v>40?"#C4A73A":"#C05F8A";
                    return <div key={i} style={{marginBottom:7}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,marginBottom:2}}>
                        <span style={{color:"#3a6a8a"}}>Tabule {i+1}</span>
                        <span style={{color:col,fontWeight:700}}>{u.pct}%</span>
                      </div>
                      <div style={{height:4,background:"#0a1620",borderRadius:2,overflow:"hidden"}}>
                        <div style={{height:"100%",width:u.pct+"%",background:col,borderRadius:2}}/>
                      </div>
                    </div>;
                  })}
                </StatPanel>
                <StatPanel title="Seznam kusů">
                  {[...new Map(result.placed.map(p=>[p.id,p])).values()].map((p,i)=>{
                    const cnt=result.placed.filter(x=>x.id===p.id).length;
                    return <div key={i} style={{display:"flex",alignItems:"center",gap:4,marginBottom:5,fontSize:9}}>
                      <div style={{width:7,height:7,background:COLORS[p.id%COLORS.length],borderRadius:1,flexShrink:0}}/>
                      <span style={{color:"#5a9ab8",fontWeight:700,minWidth:14}}>{p.label}</span>
                      <span style={{color:"#2a5a7a",flex:1}}>{p.origW}×{p.origH}</span>
                      <span style={{color:"#3a7aaa",fontWeight:700}}>×{cnt}</span>
                    </div>;
                  })}
                </StatPanel>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
