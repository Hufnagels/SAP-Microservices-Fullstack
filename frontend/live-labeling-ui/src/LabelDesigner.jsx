import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "react-toastify";

const API = (import.meta.env.VITE_API_URL || '') + '/labeling';

// ─── Constants ────────────────────────────────────────────────────────────────
const SCALE = 3.2;        // px per mm on-screen
const DPM   = 11.811;     // dots per mm at 300 dpi

const SIZES = {
  small: { w: 80,  h: 105, label: "80 × 105 mm" },
  large: { w: 105, h: 145, label: "105 × 145 mm" },
};

let _uid = 0;
const uid    = () => `el-${++_uid}`;
const d      = (mm) => Math.round(mm * DPM);
const px     = (mm) => mm * SCALE;

// ─── Image → ZPL GRF ──────────────────────────────────────────────────────────
async function imageToGRF(src, wMM, hMM) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const W = d(wMM), H = d(hMM);
      const cv = document.createElement("canvas");
      cv.width = W; cv.height = H;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H);
      const px = ctx.getImageData(0, 0, W, H).data;
      const bpr = Math.ceil(W / 8);
      let hex = "";
      for (let y = 0; y < H; y++) {
        for (let bx = 0; bx < bpr; bx++) {
          let byte = 0;
          for (let b = 0; b < 8; b++) {
            const x = bx * 8 + b;
            const i = (y * W + x) * 4;
            const g = x < W ? 0.299 * px[i] + 0.587 * px[i+1] + 0.114 * px[i+2] : 255;
            if (g < 128) byte |= 1 << (7 - b);
          }
          hex += byte.toString(16).padStart(2, "0").toUpperCase();
        }
      }
      const total = bpr * H;
      resolve(`^GFA,${total},${total},${bpr},${hex}`);
    };
    img.onerror = () => resolve("");
    img.src = src;
  });
}

// ─── ZPL Generator ────────────────────────────────────────────────────────────
async function buildZPL(elements, sizeKey) {
  const { w, h } = SIZES[sizeKey];
  let zpl = `^XA\n^PW${d(w)}\n^LL${d(h)}\n\n`;
  for (const el of elements) {
    const X = d(el.x), Y = d(el.y);
    if (el.type === "text") {
      const fs = Math.round(el.fontSize * DPM / 2.835);
      const fw = Math.round(fs * 0.7);
      zpl += `; Text: "${el.text}"\n`;
      zpl += `^FO${X},${Y}\n`;
      if (el.bold) zpl += `^CF0,${fs},${fw}\n`;
      else         zpl += `^A0N,${fs},${fw}\n`;
      zpl += `^FD${el.text}^FS\n\n`;
    } else if (el.type === "barcode") {
      const H = d(el.height);
      zpl += `; Barcode: ${el.barcodeType} "${el.barcodeData}"\n`;
      zpl += `^FO${X},${Y}\n`;
      if (el.barcodeType === "QR") {
        const mag = Math.max(1, Math.min(10, Math.round(d(Math.min(el.width, el.height)) / 22)));
        zpl += `^BQN,2,${mag}\n^FDQA,${el.barcodeData}^FS\n\n`;
      } else {
        const bw = Math.max(1, Math.round(d(el.width) / (el.barcodeData.length * 11)));
        zpl += `^BY${bw},3,${H}\n^BCN,${H},Y,N,N\n^FD${el.barcodeData}^FS\n\n`;
      }
    } else if (el.type === "image") {
      zpl += `; Image\n^FO${X},${Y}\n`;
      const grf = await imageToGRF(el.src, el.width, el.height);
      if (grf) zpl += `${grf}^FS\n\n`;
    }
  }
  zpl += "^XZ";
  return zpl;
}

// ─── Load external script ─────────────────────────────────────────────────────
const loadScript = (src) =>
  new Promise((res) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src; s.onload = res;
    document.head.appendChild(s);
  });

// ─── Styles ───────────────────────────────────────────────────────────────────
const C = {
  bg:       "#080b12",
  surface:  "#0f1420",
  panel:    "#111827",
  border:   "#1f2937",
  accent:   "#f97316",
  accentDim:"#7c3100",
  text:     "#f1f5f9",
  muted:    "#64748b",
  dim:      "#374151",
  green:    "#86efac",
  blue:     "#93c5fd",
  red:      "#fca5a5",
};

const inp = {
  width: "100%", boxSizing: "border-box",
  background: "#0a0d14", border: `1px solid ${C.border}`,
  color: C.text, borderRadius: 4, padding: "5px 8px",
  fontSize: 12, outline: "none", fontFamily: "inherit",
};

const btn = (active, variant = "default") => ({
  border: "none", borderRadius: 4, cursor: "pointer",
  padding: "6px 12px", fontSize: 12, fontWeight: 600,
  fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5,
  background: variant === "accent" ? C.accent
            : variant === "danger" ? "#7f1d1d"
            : variant === "blue"   ? "#1e3a5f"
            : active               ? C.dim
            : "#1a2035",
  color: variant === "accent" ? "#000"
       : variant === "danger" ? C.red
       : variant === "blue"   ? C.blue
       : active               ? C.text
       : C.muted,
  border: `1px solid ${
    variant === "accent" ? C.accent
  : variant === "danger" ? "#991b1b"
  : variant === "blue"   ? "#1d4ed8"
  : active               ? C.dim
  : C.border}`,
});

const sectionLabel = {
  fontSize: 10, fontWeight: 700, color: C.muted,
  textTransform: "uppercase", letterSpacing: "0.08em",
  marginBottom: 8, marginTop: 14,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function LabelDesigner() {
  const [sizeKey,   setSize]     = useState("small");
  const [elements,  setElements] = useState([]);
  const [selected,  setSelected] = useState(null);
  const [tab,       setTab]      = useState("design");
  const [zpl,       setZpl]      = useState("");
  const [libsReady, setLibsReady]= useState(false);
  const [dragging,  setDragging] = useState(null);

  const fileRef = useRef(null);
  const { w, h } = SIZES[sizeKey];

  const selectedEl = elements.find(e => e.id === selected);
  const updateEl = (id, patch) =>
    setElements(els => els.map(e => e.id === id ? { ...e, ...patch } : e));

  useEffect(() => {
    Promise.all([
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js"),
      loadScript("https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"),
    ]).then(() => setLibsReady(true));
  }, []);

  useEffect(() => {
    if (!libsReady) return;
    elements.filter(e => e.type === "barcode").forEach(el => {
      if (el.barcodeType === "QR") {
        const div = document.getElementById(`qr-${el.id}`);
        if (!div || !window.QRCode) return;
        div.innerHTML = "";
        try {
          new window.QRCode(div, {
            text: el.barcodeData || " ",
            width:  px(el.width),
            height: px(el.height),
            correctLevel: window.QRCode.CorrectLevel.M,
          });
        } catch (_) {}
      } else {
        const svg = document.getElementById(`bc-${el.id}`);
        if (!svg || !window.JsBarcode) return;
        try {
          window.JsBarcode(svg, el.barcodeData || "0", {
            format: el.barcodeType,
            width: 1.2,
            height: px(el.height) - 18,
            displayValue: true,
            fontSize: 9,
            margin: 2,
            background: "#ffffff",
            lineColor: "#000000",
          });
        } catch (_) {
          svg.innerHTML = `<text x="4" y="14" fill="red" font-size="10">Invalid data</text>`;
        }
      }
    });
  }, [elements, libsReady]);

  const addText = () => {
    const el = { id: uid(), type:"text", x:5, y:5, width:50, height:10,
      text:"Label Text", fontSize:12, bold:false, align:"left" };
    setElements(e => [...e, el]);
    setSelected(el.id);
  };

  const addBarcode = () => {
    const el = { id: uid(), type:"barcode", x:5, y:20, width:55, height:18,
      barcodeType:"CODE128", barcodeData:"1234567890" };
    setElements(e => [...e, el]);
    setSelected(el.id);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const el = { id: uid(), type:"image", x:5, y:5, width:30, height:20,
        src: ev.target.result, imageType: file.type };
      setElements(prev => [...prev, el]);
      setSelected(el.id);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const deleteEl = () => {
    setElements(els => els.filter(e => e.id !== selected));
    setSelected(null);
  };

  const duplicateEl = () => {
    if (!selectedEl) return;
    const copy = { ...selectedEl, id: uid(), x: selectedEl.x + 4, y: selectedEl.y + 4 };
    setElements(els => [...els, copy]);
    setSelected(copy.id);
  };

  const onMouseDown = useCallback((e, id) => {
    e.stopPropagation();
    setSelected(id);
    const el = elements.find(el => el.id === id);
    if (el) setDragging({ id, sx: e.clientX, sy: e.clientY, ex: el.x, ey: el.y });
  }, [elements]);

  const onMouseMove = useCallback((e) => {
    if (!dragging) return;
    const dx = (e.clientX - dragging.sx) / SCALE;
    const dy = (e.clientY - dragging.sy) / SCALE;
    const el = elements.find(el => el.id === dragging.id);
    if (!el) return;
    const { w, h } = SIZES[sizeKey];
    updateEl(dragging.id, {
      x: Math.max(0, Math.min(w - el.width,  dragging.ex + dx)),
      y: Math.max(0, Math.min(h - el.height, dragging.ey + dy)),
    });
  }, [dragging, elements, sizeKey]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", () => setDragging(null));
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", () => setDragging(null));
    };
  }, [onMouseMove]);

  const handleGenerate = async () => {
    const code = await buildZPL(elements, sizeKey);
    setZpl(code);
    setTab("zpl");
  };

  const handlePrint = async () => {
    const code = await buildZPL(elements, sizeKey);
    const toastId = toast.loading("Sending to printer…");
    try {
      const res = await fetch(`${API}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zpl: code }),
      });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try { const d = await res.json(); detail = d.detail || detail; } catch (_) {}
        throw new Error(detail);
      }
      const data = await res.json();
      if (data.success) {
        toast.update(toastId, { render: "Printed!", type: "success", isLoading: false, autoClose: 3000 });
      } else {
        toast.update(toastId, { render: data.detail || "Unknown error", type: "error", isLoading: false, autoClose: 4000 });
      }
    } catch (err) {
      toast.update(toastId, { render: err.message, type: "error", isLoading: false, autoClose: 4000 });
    }
  };

  const renderEl = (el) => {
    const isSelected = el.id === selected;
    const style = {
      position: "absolute",
      left:   px(el.x), top:    px(el.y),
      width:  px(el.width), height: px(el.height),
      cursor: "move", boxSizing: "border-box",
      outline: isSelected ? `2px solid ${C.accent}` : "1px dashed #d1d5db44",
      userSelect: "none", overflow: "hidden",
    };

    if (el.type === "text") return (
      <div key={el.id} style={style} onMouseDown={e => onMouseDown(e, el.id)}>
        <div style={{
          fontSize: el.fontSize, fontWeight: el.bold ? 700 : 400,
          textAlign: el.align || "left", lineHeight: 1.2,
          color: "#000", padding: 2, height: "100%", overflow: "hidden",
          fontFamily: "Arial, sans-serif",
        }}>
          {el.text}
        </div>
        {isSelected && <ResizeHandle el={el} updateEl={updateEl} />}
      </div>
    );

    if (el.type === "image") return (
      <div key={el.id} style={style} onMouseDown={e => onMouseDown(e, el.id)}>
        <img src={el.src} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
          alt="" draggable={false} />
        {isSelected && <ResizeHandle el={el} updateEl={updateEl} />}
      </div>
    );

    if (el.type === "barcode") return (
      <div key={el.id} style={{ ...style, background: "#fff" }} onMouseDown={e => onMouseDown(e, el.id)}>
        {el.barcodeType === "QR"
          ? <div id={`qr-${el.id}`} style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }} />
          : <svg id={`bc-${el.id}`} style={{ width: "100%", height: "100%" }} />
        }
        {isSelected && <ResizeHandle el={el} updateEl={updateEl} />}
      </div>
    );
  };

  const Props = () => {
    if (!selectedEl) return (
      <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.6, padding: "8px 0" }}>
        Click an element on the canvas to edit its properties.
      </div>
    );
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={sectionLabel}>Position & Size</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {["x","y","width","height"].map(k => (
            <div key={k}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>
                {k === "x" ? "X (mm)" : k === "y" ? "Y (mm)" : k === "width" ? "W (mm)" : "H (mm)"}
              </div>
              <input type="number" style={inp} step="0.5"
                value={Math.round(selectedEl[k] * 10) / 10}
                onChange={e => updateEl(selected, { [k]: parseFloat(e.target.value) || 0 })} />
            </div>
          ))}
        </div>

        {selectedEl.type === "text" && <>
          <div style={sectionLabel}>Text</div>
          <textarea style={{ ...inp, height: 56, resize: "vertical", lineHeight: 1.5 }}
            value={selectedEl.text}
            onChange={e => updateEl(selected, { text: e.target.value })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Font Size (pt)</div>
              <input type="number" style={inp} value={selectedEl.fontSize} min={6} max={96}
                onChange={e => updateEl(selected, { fontSize: parseInt(e.target.value) || 12 })} />
            </div>
            <div>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Align</div>
              <select style={inp} value={selectedEl.align || "left"}
                onChange={e => updateEl(selected, { align: e.target.value })}>
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </div>
          </div>
          <label style={{ display:"flex", alignItems:"center", gap:7, cursor:"pointer", fontSize:12, color:C.text, marginTop:2 }}>
            <input type="checkbox" checked={!!selectedEl.bold}
              onChange={e => updateEl(selected, { bold: e.target.checked })} />
            Bold
          </label>
        </>}

        {selectedEl.type === "barcode" && <>
          <div style={sectionLabel}>Barcode</div>
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 3 }}>Type</div>
          <select style={inp} value={selectedEl.barcodeType}
            onChange={e => updateEl(selected, { barcodeType: e.target.value })}>
            <option value="CODE128">CODE128</option>
            <option value="CODE39">CODE39</option>
            <option value="EAN13">EAN-13</option>
            <option value="QR">QR Code</option>
          </select>
          <div style={{ fontSize: 10, color: C.muted, marginBottom: 3, marginTop: 4 }}>Data</div>
          <input type="text" style={inp} value={selectedEl.barcodeData}
            onChange={e => updateEl(selected, { barcodeData: e.target.value })} />
          {selectedEl.barcodeType === "EAN13" && (
            <div style={{ fontSize: 10, color: "#fbbf24", marginTop: 2 }}>EAN-13 requires exactly 12 digits</div>
          )}
        </>}

        {selectedEl.type === "image" && <>
          <div style={sectionLabel}>Image</div>
          <div style={{ fontSize: 12, color: C.muted }}>Type: {selectedEl.imageType}</div>
          <div style={{ fontSize: 11, color: "#fbbf24", lineHeight: 1.5 }}>
            Image will be dithered to 1-bit monochrome for ZPL printing
          </div>
          <button style={{ ...btn(false), marginTop: 4 }} onClick={() => fileRef.current?.click()}>
            Replace Image
          </button>
        </>}

        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button style={{ ...btn(false), flex:1 }} onClick={duplicateEl}>Dupe</button>
          <button style={{ ...btn(false, "danger"), flex:1 }} onClick={deleteEl}>Delete</button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const handler = (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") &&
          !["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) {
        deleteEl();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected]);

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh",
      background: C.bg, color: C.text, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize:13 }}>

      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 16px",
        background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink:0 }}>
        <div style={{ fontWeight:800, fontSize:14, color:C.accent, letterSpacing:"0.12em" }}>
          CAB SQUIX
        </div>
        <div style={{ width:1, height:20, background:C.border }} />
        <div style={{ fontSize:11, color:C.muted }}>Label Designer</div>

        <div style={{ display:"flex", gap:5, marginLeft:"auto" }}>
          {Object.entries(SIZES).map(([k,v]) => (
            <button key={k} style={{
              ...btn(sizeKey===k), ...(sizeKey===k ? { background:C.accentDim, color:C.accent, borderColor:C.accent } : {})
            }} onClick={() => setSize(k)}>
              {v.label}
            </button>
          ))}
        </div>

        <div style={{ width:1, height:20, background:C.border }} />
        <button style={btn(false,"blue")} onClick={handleGenerate}>ZPL</button>
        <button style={btn(false,"accent")} onClick={handlePrint}>Print</button>
      </div>

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
        <div style={{ width:160, background:C.panel, borderRight:`1px solid ${C.border}`,
          padding:"12px 10px", display:"flex", flexDirection:"column", gap:4, flexShrink:0, overflowY:"auto" }}>
          <div style={sectionLabel}>Add</div>
          {[
            { label:"Text",    action: addText },
            { label:"Barcode", action: addBarcode },
            { label:"Image",   action: () => fileRef.current?.click() },
          ].map(({ label, action }) => (
            <button key={label} style={{ ...btn(false), width:"100%", justifyContent:"flex-start", marginBottom:2, padding:"7px 10px" }}
              onClick={action}>
              {label}
            </button>
          ))}
          <input type="file" ref={fileRef} style={{ display:"none" }}
            accept="image/jpeg,image/jpg,image/png,image/svg+xml"
            onChange={handleFile} />

          <div style={{ ...sectionLabel, marginTop:16 }}>Layers</div>
          {elements.length === 0 && (
            <div style={{ fontSize:11, color:C.muted, lineHeight:1.6 }}>No elements yet</div>
          )}
          {[...elements].reverse().map(el => (
            <div key={el.id} onClick={() => setSelected(el.id)} style={{
              padding:"5px 8px", borderRadius:4, cursor:"pointer", fontSize:11,
              background: selected===el.id ? "#1a2542" : "transparent",
              border: `1px solid ${selected===el.id ? C.accent : "transparent"}`,
              color: selected===el.id ? C.accent : C.muted,
              display:"flex", alignItems:"center", gap:5,
            }}>
              <span>{el.type==="text" ? "T" : el.type==="image" ? "I" : "B"}</span>
              <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {el.type==="text" ? el.text.slice(0,14)
                  : el.type==="image" ? "Image"
                  : el.barcodeData.slice(0,12)}
              </span>
            </div>
          ))}
        </div>

        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, background:C.surface, flexShrink:0 }}>
            {[["design","Designer"],["zpl","ZPL Code"]].map(([t,label]) => (
              <button key={t} onClick={() => setTab(t)} style={{
                ...btn(false), borderRadius:0, background:"none",
                color: tab===t ? C.accent : C.muted, padding:"10px 18px",
                border:"none", borderBottom:`2px solid ${tab===t ? C.accent : "transparent"}`,
              }}>{label}</button>
            ))}
          </div>

          {tab === "design" ? (
            <div style={{ flex:1, overflow:"auto", display:"flex", alignItems:"flex-start",
              justifyContent:"center", padding:32, background: C.bg }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
                <div style={{ fontSize:11, color:C.muted }}>{SIZES[sizeKey].label} — 300 dpi</div>
                <div
                  style={{ position:"relative", width:px(w), height:px(h),
                    background:"#fff", flexShrink:0, cursor:"default",
                    boxShadow:`0 0 0 1px ${C.border}, 0 8px 48px rgba(0,0,0,0.6)` }}
                  onClick={() => setSelected(null)}
                >
                  <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}>
                    <defs>
                      <pattern id="g5" width={SCALE*5} height={SCALE*5} patternUnits="userSpaceOnUse">
                        <path d={`M ${SCALE*5} 0 L 0 0 0 ${SCALE*5}`} fill="none" stroke="#e5e7eb" strokeWidth={0.4} />
                      </pattern>
                      <pattern id="g10" width={SCALE*10} height={SCALE*10} patternUnits="userSpaceOnUse">
                        <rect width={SCALE*10} height={SCALE*10} fill="url(#g5)" />
                        <path d={`M ${SCALE*10} 0 L 0 0 0 ${SCALE*10}`} fill="none" stroke="#d1d5db" strokeWidth={0.7} />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#g10)" />
                  </svg>
                  {elements.map(renderEl)}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex:1, overflow:"auto", padding:24 }}>
              {zpl ? (
                <>
                  <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                    <button style={btn(false)} onClick={() => navigator.clipboard.writeText(zpl)}>
                      Copy ZPL
                    </button>
                    <span style={{ fontSize:11, color:C.muted, alignSelf:"center" }}>
                      {zpl.split("\n").length} lines
                    </span>
                  </div>
                  <pre style={{
                    background:"#0a0d14", border:`1px solid ${C.border}`, borderRadius:6,
                    padding:20, fontSize:12, color:C.green, lineHeight:1.9,
                    overflow:"auto", margin:0,
                  }}>{zpl}</pre>
                </>
              ) : (
                <div style={{ color:C.muted, fontSize:13 }}>
                  Click <strong style={{ color:C.blue }}>ZPL</strong> in the header to generate code from your label design.
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ width:220, background:C.panel, borderLeft:`1px solid ${C.border}`,
          padding:"12px 12px", overflowY:"auto", flexShrink:0 }}>
          <div style={{ ...sectionLabel, marginTop:0 }}>Properties</div>
          <Props />
        </div>
      </div>
    </div>
  );
}

function ResizeHandle({ el, updateEl }) {
  const onMouseDown = (e) => {
    e.stopPropagation();
    const startX = e.clientX, startY = e.clientY;
    const startW = el.width, startH = el.height;
    const onMove = (ev) => {
      const dw = (ev.clientX - startX) / SCALE;
      const dh = (ev.clientY - startY) / SCALE;
      updateEl(el.id, {
        width:  Math.max(5, startW + dw),
        height: Math.max(3, startH + dh),
      });
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };
  return (
    <div onMouseDown={onMouseDown} style={{
      position:"absolute", right:-4, bottom:-4,
      width:10, height:10, background:"#f97316",
      cursor:"se-resize", borderRadius:2, zIndex:10,
    }} />
  );
}
