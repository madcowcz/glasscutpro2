import { useState, useRef } from "react";

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
    if (rh > 0) sheet.spaces.push({ x: sp.x, y: sp.y + ph + kerf, w: pw, h: rh });
  }

  // Count cuts per sheet
  const cutsPerSheet = Array.from({ length: sheets.length }, () => 0);
  const cutLengthPerSheet = Array.from({ length: sheets.length }, () => 0);
  for (let si = 0; si < sheets.length; si++) {
    const sp = placed.filter(p => p.sheetIndex === si);
    // approximate: each piece needs up to 2 cuts (right edge + bottom edge), minus edges
    sp.forEach(p => {
      cutsPerSheet[si] += 2;
      cutLengthPerSheet[si] += p.w + p.h;
    });
  }

  return { placed, unplaced, sheetCount: sheets.length, cutsPerSheet, cutLengthPerSheet };
}

const COLORS = ["#4F86C6","#E8834D","#5BB98B","#C05F8A","#7B6CD4","#C4A73A","#4AABB8","#D45F5F","#82B84A","#8F7EC4","#D48B4A","#5A9EC9","#C96B6B","#6BC996","#C96BAD"];

// ─── SHEET WITH RULERS ───────────────────────────────────────────────────────
function SheetCanvas({ sheetW, sheetH, placements }) {
  const RULER = 22, PAD_R = 6, PAD_B = 6;
  const MAX_W = 560, MAX_H = 400;
  const scale = Math.min((MAX_W - RULER - PAD_R) / sheetW, (MAX_H - RULER - PAD_B) / sheetH);
  const dw = sheetW * scale, dh = sheetH * scale;
  const totalW = dw + RULER + PAD_R, totalH = dh + RULER + PAD_B;

  // Ruler ticks
  const stepMm = sheetW > 2000 ? 500 : sheetW > 1000 ? 250 : 100;
  const hTicks = [], vTicks = [];
  for (let x = 0; x <= sheetW; x += stepMm) hTicks.push(x);
  for (let y = 0; y <= sheetH; y += stepMm) vTicks.push(y);

  return (
    <svg width={totalW} height={totalH} style={{ display: "block" }}>
      {/* Ruler backgrounds */}
      <rect x={0} y={0} width={RULER} height={totalH} fill="#101e2d"/>
      <rect x={0} y={0} width={totalW} height={RULER} fill="#101e2d"/>
      <rect x={0} y={0} width={RULER} height={RULER} fill="#0a1520"/>

      {/* H ruler ticks */}
      {hTicks.map(x => {
        const px = RULER + x * scale;
        return <g key={"ht"+x}>
          <line x1={px} y1={RULER-6} x2={px} y2={RULER} stroke="#2a6a9a" strokeWidth="1"/>
          {x > 0 && <text x={px} y={RULER-8} textAnchor="middle" fontSize="7" fill="#3a7aaa" fontFamily="monospace">{x}</text>}
        </g>;
      })}

      {/* V ruler ticks */}
      {vTicks.map(y => {
        const py = RULER + y * scale;
        return <g key={"vt"+y}>
          <line x1={RULER-6} y1={py} x2={RULER} y2={py} stroke="#2a6a9a" strokeWidth="1"/>
          {y > 0 && <text x={RULER-8} y={py+3} textAnchor="end" fontSize="7" fill="#3a7aaa" fontFamily="monospace">{y}</text>}
        </g>;
      })}

      {/* Sheet */}
      <rect x={RULER} y={RULER} width={dw} height={dh} fill="#c8e8f4" stroke="#5a9ab8" strokeWidth="1.5"/>

      {/* Grid lines */}
      {hTicks.filter(x=>x>0&&x<sheetW).map(x=>(
        <line key={"gv"+x} x1={RULER+x*scale} y1={RULER} x2={RULER+x*scale} y2={RULER+dh} stroke="#a0c8dc" strokeWidth="0.4" strokeDasharray="3,4"/>
      ))}
      {vTicks.filter(y=>y>0&&y<sheetH).map(y=>(
        <line key={"gh"+y} x1={RULER} y1={RULER+y*scale} x2={RULER+dw} y2={RULER+y*scale} stroke="#a0c8dc" strokeWidth="0.4" strokeDasharray="3,4"/>
      ))}

      {/* Pieces */}
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

      {/* Dimension arrows */}
      <line x1={RULER} y1={RULER+dh+3} x2={RULER+dw} y2={RULER+dh+3} stroke="#5a9ab8" strokeWidth="1" markerEnd="url(#arr)"/>
      <text x={RULER+dw/2} y={RULER+dh+PAD_B} textAnchor="middle" fontSize="8" fill="#5a9ab8" fontFamily="monospace">{sheetW} mm</text>
    </svg>
  );
}

const inp = { flex:1, background:"#07111a", border:"1px solid #1a3248", color:"#7ab8d4", padding:"7px 9px", borderRadius:5, fontSize:12, fontFamily:"monospace", outline:"none", minWidth:0 };
const addBtn = { marginTop:5, padding:"7px", background:"transparent", border:"1px dashed #1e4a6a", color:"#3a7aaa", borderRadius:5, fontSize:11, cursor:"pointer", width:"100%", fontFamily:"monospace" };
const removeBtn = { width:26, height:32, background:"transparent", border:"1px solid #1a2e40", color:"#2a5a7a", borderRadius:4, cursor:"pointer", fontSize:10, flexShrink:0 };

export default function App() {
  const [pieces, setPieces] = useState([{ id:0, w:"", h:"", qty:1, label:"A" }]);
  const [sheets, setSheets] = useState([{ w:3210, h:2250, qty:10 }]);
  const [kerf, setKerf] = useState(3);
  const [allowRot, setAllowRot] = useState(true);
  const [result, setResult] = useState(null);
  const printRef = useRef();

  const addPiece = () => { const n=pieces.length; setPieces([...pieces,{id:n,w:"",h:"",qty:1,label:String.fromCharCode(65+n%26)}]); };
  const updPiece = (i,f,v) => { const a=[...pieces]; a[i]={...a[i],[f]:v}; setPieces(a); };
  const addSheet = () => setSheets([...sheets,{w:3210,h:2250,qty:1}]);
  const updSheet = (i,f,v) => { const a=[...sheets]; a[i]={...a[i],[f]:v}; setSheets(a); };

  const calc = () => {
    const vp = pieces.map(p=>({...p,w:parseInt(p.w),h:parseInt(p.h),qty:parseInt(p.qty)||1})).filter(p=>p.w>0&&p.h>0);
    if(!vp.length) return;
    const sw=parseInt(sheets[0]?.w)||3210, sh=parseInt(sheets[0]?.h)||2250;
    const res = packPieces(sw, sh, vp, parseInt(kerf)||3);
    const {placed, unplaced, sheetCount, cutsPerSheet, cutLengthPerSheet} = res;
    const sa = sw*sh;
    const util = Array.from({length:sheetCount},(_,si)=>{
      const used = placed.filter(p=>p.sheetIndex===si).reduce((s,p)=>s+p.w*p.h,0);
      const wastedMm2 = sa - used;
      return { pct: ((used/sa)*100).toFixed(1), used, wasted: wastedMm2 };
    });
    const totalUsed = placed.reduce((s,p)=>s+p.w*p.h,0);
    const totalPieces = vp.reduce((s,p)=>s+p.qty,0);
    const totalWasted = sheetCount*sa - totalUsed;
    const totalCuts = cutsPerSheet.reduce((a,b)=>a+b,0);
    const totalCutLen = cutLengthPerSheet.reduce((a,b)=>a+b,0);
    setResult({placed,unplaced,sheetCount,sw,sh,util,overall:((totalUsed/(sheetCount*sa))*100).toFixed(1),totalPieces,totalWasted,totalUsed,totalCuts,totalCutLen,sheetArea:sa,cutsPerSheet,cutLengthPerSheet});
  };

  const printPDF = () => {
    const win = window.open("","_blank");
    const content = printRef.current?.innerHTML || "";
    win.document.write(`<!DOCTYPE html><html><head><title>Nářezový plán</title>
    <style>
      body { font-family: monospace; background: #fff; color: #000; padding: 16px; margin: 0; }
      .sheet-wrap { margin-bottom: 24px; page-break-inside: avoid; }
      h1 { font-size: 16px; margin: 0 0 4px; }
      .meta { font-size: 11px; color: #444; margin-bottom: 16px; }
      .stat-grid { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
      .stat-box { border: 1px solid #ccc; border-radius: 6px; padding: 8px 14px; min-width: 100px; }
      .stat-label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
      .stat-value { font-size: 18px; font-weight: 700; }
      svg rect { }
      @media print { @page { margin: 10mm; } }
    </style></head><body>
    <h1>Nářezový plán — GlassCut Pro</h1>
    <div class="meta">Formát tabule: ${result?.sw}×${result?.sh} mm &nbsp;|&nbsp; Tabulí: ${result?.sheetCount} &nbsp;|&nbsp; Kusů: ${result?.totalPieces} &nbsp;|&nbsp; Využití: ${result?.overall}% &nbsp;|&nbsp; Šíře řezu: ${kerf} mm</div>
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-label">Použité tabule</div><div class="stat-value">${result?.sheetCount}</div></div>
      <div class="stat-box"><div class="stat-label">Celkem kusů</div><div class="stat-value">${result?.totalPieces}</div></div>
      <div class="stat-box"><div class="stat-label">Využití plochy</div><div class="stat-value">${result?.overall}%</div></div>
      <div class="stat-box"><div class="stat-label">Odpad (mm²)</div><div class="stat-value">${result?.totalWasted?.toLocaleString()}</div></div>
      <div class="stat-box"><div class="stat-label">Počet řezů</div><div class="stat-value">${result?.totalCuts}</div></div>
    </div>
    ${content}
    </body></html>`);
    win.document.close(); win.focus(); setTimeout(()=>{ win.print(); }, 500);
  };

  return (
    <div style={{height:"100vh",background:"#0a1620",color:"#c0ddf0",fontFamily:"monospace",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      {/* HEADER */}
      <div style={{background:"#0d1e2e",borderBottom:"2px solid #1a3a54",padding:"11px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:32,height:32,background:"linear-gradient(135deg,#3a76b6,#144060)",borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,color:"#fff"}}>◫</div>
          <div>
            <div style={{fontSize:16,fontWeight:900,letterSpacing:3,color:"#6ab2d0",textTransform:"uppercase"}}>GlassCut Pro</div>
            <div style={{fontSize:9,color:"#2a5a7a",letterSpacing:1}}>Nářezový plán · AGC LDC Olomouc</div>
          </div>
        </div>
        {result && (
          <button onClick={printPDF} style={{padding:"8px 20px",background:"transparent",border:"1px solid #2a6a9a",color:"#6ab2d0",borderRadius:6,fontSize:11,cursor:"pointer",letterSpacing:1,fontFamily:"monospace"}}>
            ⬇ Export PDF
          </button>
        )}
      </div>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* LEFT PANEL */}
        <div style={{width:330,background:"#0d1a26",borderRight:"1px solid #172840",padding:"16px 14px",overflowY:"auto",flexShrink:0,display:"flex",flexDirection:"column",gap:18}}>

          {/* PIECES */}
          <div>
            <SectionTitle>🔲 Požadované kusy</SectionTitle>
            <div style={{display:"flex",gap:4,fontSize:8,color:"#1e5a7a",marginBottom:4,paddingLeft:2}}>
              <span style={{width:24}}></span>
              <span style={{flex:1,textAlign:"center"}}>DÉLKA</span>
              <span style={{flex:1,textAlign:"center"}}>ŠÍŘKA</span>
              <span style={{width:44,textAlign:"center"}}>KS</span>
              <span style={{width:26}}></span>
            </div>
            {pieces.map((p,i)=>(
              <div key={i} style={{display:"flex",gap:4,marginBottom:4,alignItems:"center"}}>
                <div style={{width:24,height:30,background:COLORS[p.id%COLORS.length],borderRadius:3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:900,color:"#fff",flexShrink:0}}>{p.label}</div>
                <input type="number" placeholder="800" value={p.w} onChange={e=>updPiece(i,"w",e.target.value)} style={inp}/>
                <input type="number" placeholder="600" value={p.h} onChange={e=>updPiece(i,"h",e.target.value)} style={inp}/>
                <input type="number" min="1" value={p.qty} onChange={e=>updPiece(i,"qty",e.target.value)} style={{...inp,width:44,flex:"none"}}/>
                <button onClick={()=>setPieces(pieces.filter((_,x)=>x!==i))} style={removeBtn}>✕</button>
              </div>
            ))}
            <button onClick={addPiece} style={addBtn}>+ Přidat kus</button>
          </div>

          {/* SHEETS */}
          <div>
            <SectionTitle>🪟 Výchozí tabule</SectionTitle>
            <div style={{display:"flex",gap:4,fontSize:8,color:"#1e5a7a",marginBottom:4,paddingLeft:2}}>
              <span style={{flex:1,textAlign:"center"}}>DÉLKA</span>
              <span style={{flex:1,textAlign:"center"}}>ŠÍŘKA</span>
              <span style={{width:54,textAlign:"center"}}>SKLAD</span>
              <span style={{width:26}}></span>
            </div>
            {sheets.map((s,i)=>(
              <div key={i} style={{display:"flex",gap:4,marginBottom:4,alignItems:"center"}}>
                <input type="number" value={s.w} onChange={e=>updSheet(i,"w",e.target.value)} style={inp} placeholder="3210"/>
                <input type="number" value={s.h} onChange={e=>updSheet(i,"h",e.target.value)} style={inp} placeholder="2250"/>
                <input type="number" min="1" value={s.qty} onChange={e=>updSheet(i,"qty",e.target.value)} style={{...inp,width:54,flex:"none"}} placeholder="10"/>
                <button onClick={()=>setSheets(sheets.filter((_,x)=>x!==i))} style={removeBtn}>✕</button>
              </div>
            ))}
            <button onClick={addSheet} style={addBtn}>+ Přidat formát</button>
          </div>

          {/* OPTIONS */}
          <div>
            <SectionTitle>⚙ Nastavení</SectionTitle>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:11,color:"#4a8aaa",minWidth:120}}>Šíře řezu (mm):</span>
              <input type="number" value={kerf} min={0} max={10} onChange={e=>setKerf(e.target.value)} style={{...inp,width:54,flex:"none"}}/>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:11,color:"#4a8aaa",minWidth:120}}>Povolit rotaci:</span>
              <div onClick={()=>setAllowRot(!allowRot)} style={{width:36,height:20,background:allowRot?"#1e5a8a":"#1a2a3a",borderRadius:10,position:"relative",cursor:"pointer",border:"1px solid #2a5a7a",transition:"background 0.2s"}}>
                <div style={{position:"absolute",top:2,left:allowRot?17:2,width:14,height:14,background:allowRot?"#6ab8e0":"#3a5a7a",borderRadius:"50%",transition:"left 0.2s"}}/>
              </div>
            </div>
          </div>

          <div style={{marginTop:"auto"}}>
            <button onClick={calc} style={{width:"100%",padding:"12px",background:"linear-gradient(135deg,#1a4466,#0c2236)",color:"#6ad4f2",border:"1px solid #2060a0",borderRadius:7,fontSize:13,fontWeight:900,letterSpacing:2,cursor:"pointer",textTransform:"uppercase",fontFamily:"monospace",boxShadow:"0 2px 12px rgba(0,100,200,0.2)"}}>
              ▶ Vypočítat nářez
            </button>
          </div>
        </div>

        {/* CENTER + RIGHT */}
        <div style={{flex:1,overflowY:"auto",padding:16,background:"#0a1620"}}>
          {!result ? (
            <div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#132030",textAlign:"center",gap:12}}>
              <div style={{fontSize:80}}>◫</div>
              <div style={{fontSize:12,letterSpacing:3,color:"#1a3a54"}}>ZADEJTE KUSY A STISKNĚTE VYPOČÍTAT</div>
            </div>
          ) : (
            <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
              {/* MAIN CONTENT */}
              <div style={{flex:1,minWidth:0}}>
                {/* Unplaced warning */}
                {result.unplaced.length > 0 && (
                  <div style={{background:"#2a1010",border:"1px solid #7a2020",borderRadius:7,padding:"10px 14px",marginBottom:14,fontSize:11,color:"#f08080"}}>
                    ⚠ {result.unplaced.length} kus(ů) přesahuje rozměry tabule a nelze umístit: {result.unplaced.map(p=>`${p.origW||p.w}×${p.origH||p.h}`).join(", ")}
                  </div>
                )}

                {/* Sheets */}
                <div ref={printRef}>
                  {Array.from({length:result.sheetCount}).map((_,si)=>{
                    const sp = result.placed.filter(p=>p.sheetIndex===si);
                    const u = result.util[si];
                    return (
                      <div key={si} className="sheet-wrap" style={{marginBottom:24}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                          <div style={{fontSize:10,color:"#3a7aaa",letterSpacing:2}}>▸ TABULE {si+1}</div>
                          <div style={{height:1,flex:1,background:"#0f2030"}}/>
                          <div style={{fontSize:10,color: parseFloat(u.pct)>70?"#5BB98B": parseFloat(u.pct)>40?"#C4A73A":"#C05F8A",fontWeight:700}}>{u.pct}%</div>
                          <div style={{fontSize:9,color:"#2a5a7a"}}>odpad: {(u.wasted/1e6).toFixed(4)} m²</div>
                        </div>
                        <div style={{background:"#0d1e2e",borderRadius:8,padding:"10px 10px 6px",border:"1px solid #142030",display:"inline-block",maxWidth:"100%",overflowX:"auto"}}>
                          <SheetCanvas sheetW={result.sw} sheetH={result.sh} placements={sp}/>
                        </div>
                        {/* Legend */}
                        <div style={{marginTop:7,display:"flex",gap:5,flexWrap:"wrap"}}>
                          {sp.map((p,i)=>(
                            <div key={i} style={{display:"flex",alignItems:"center",gap:4,background:"#0d1a24",border:"1px solid #122030",borderRadius:4,padding:"2px 8px",fontSize:9}}>
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
              </div>

              {/* RIGHT STATS PANEL */}
              <div style={{width:200,flexShrink:0,display:"flex",flexDirection:"column",gap:10}}>
                <StatPanel title="Globální statistiky">
                  <StatRow label="Použité tabule" value={`${result.sheetCount}×${result.sw}×${result.sh}`}/>
                  <StatRow label="Celkem kusů" value={result.totalPieces}/>
                  <StatRow label="Nevmístěné" value={result.unplaced.length} warn={result.unplaced.length>0}/>
                  <div style={{height:1,background:"#0f2030",margin:"6px 0"}}/>
                  <StatRow label="Využitá plocha" value={`${(result.totalUsed/1e6).toFixed(3)} m²`}/>
                  <StatRow label="Odpad celkem" value={`${(result.totalWasted/1e6).toFixed(3)} m²`} warn/>
                  <StatRow label="Využití" value={result.overall+"%" } highlight/>
                  <div style={{height:1,background:"#0f2030",margin:"6px 0"}}/>
                  <StatRow label="Počet řezů" value={result.totalCuts}/>
                  <StatRow label="Délka řezů" value={`${(result.totalCutLen/1000).toFixed(1)} m`}/>
                  <StatRow label="Šíře řezu" value={`${kerf} mm`}/>
                </StatPanel>

                <StatPanel title="Využití po tabulích">
                  {result.util.map((u,i)=>{
                    const v=parseFloat(u.pct);
                    const col=v>70?"#5BB98B":v>40?"#C4A73A":"#C05F8A";
                    return <div key={i} style={{marginBottom:6}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,marginBottom:2}}>
                        <span style={{color:"#3a6a8a"}}>Tabule {i+1}</span>
                        <span style={{color:col,fontWeight:700}}>{u.pct}%</span>
                      </div>
                      <div style={{height:5,background:"#0a1620",borderRadius:3,overflow:"hidden"}}>
                        <div style={{height:"100%",width:u.pct+"%",background:col,borderRadius:3,transition:"width 0.6s"}}/>
                      </div>
                    </div>;
                  })}
                </StatPanel>

                {/* Pieces summary */}
                <StatPanel title="Seznam kusů">
                  {[...new Map(result.placed.map(p=>[p.id,p])).values()].map((p,i)=>{
                    const cnt = result.placed.filter(x=>x.id===p.id).length;
                    return <div key={i} style={{display:"flex",alignItems:"center",gap:5,marginBottom:5,fontSize:9}}>
                      <div style={{width:8,height:8,background:COLORS[p.id%COLORS.length],borderRadius:2,flexShrink:0}}/>
                      <span style={{color:"#5a9ab8",fontWeight:700,minWidth:16}}>{p.label}</span>
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

function SectionTitle({children}) {
  return <div style={{fontSize:9,fontWeight:700,color:"#2a6a9a",letterSpacing:2,marginBottom:8,textTransform:"uppercase"}}>{children}</div>;
}

function StatPanel({title,children}) {
  return (
    <div style={{background:"#0d1e2e",border:"1px solid #142030",borderRadius:8,padding:"12px"}}>
      <div style={{fontSize:8,fontWeight:700,color:"#2a5a7a",letterSpacing:2,marginBottom:10,textTransform:"uppercase"}}>{title}</div>
      {children}
    </div>
  );
}

function StatRow({label,value,highlight,warn}) {
  const col = highlight?"#6ad4f2":warn?"#e08080":"#8ab8d0";
  return (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5,fontSize:10}}>
      <span style={{color:"#2a5a7a",fontSize:9}}>{label}</span>
      <span style={{color:col,fontWeight:highlight?900:700}}>{value}</span>
    </div>
  );
}
