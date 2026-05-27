"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Sun, Moon, Search, FileDown, Send, Package, ArrowUpDown, Warehouse, TrendingUp, ClipboardList, Route, Bell, RefreshCcw, LogOut } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const MENUS = [
  { id: "Stock Ready",   icon: Package },
  { id: "FIFO Matrix",  icon: ArrowUpDown },
  { id: "Kapasitas",    icon: Warehouse },
  { id: "Service Level",icon: TrendingUp },
  { id: "Bonan PPIC",   icon: ClipboardList },
  { id: "Stok Jalur",   icon: Route },
  { id: "Alert Center", icon: Bell },
];

const fmt0 = (n: any) =>
  Math.round(Number(n || 0)).toLocaleString("id-ID");

const fmt2 = (n: any) =>
  Number(n || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });

/* ─────────────────────────────────────────────
   PIN SCREEN
───────────────────────────────────────────── */
const PAD_KEYS = [
  { n: "1", sub: "" },   { n: "2", sub: "ABC" },  { n: "3", sub: "DEF" },
  { n: "4", sub: "GHI" },{ n: "5", sub: "JKL" },  { n: "6", sub: "MNO" },
  { n: "7", sub: "PQRS"},{ n: "8", sub: "TUV" },  { n: "9", sub: "WXYZ" },
  { n: "",  sub: "" },   { n: "0", sub: "" },      { n: "⌫", sub: "" },
];

function PinScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [exiting, setExiting] = useState(false);
  const CORRECT = process.env.NEXT_PUBLIC_PIN || "1234";

  function press(key: string) {
    if (key === "⌫") { setPin((p) => p.slice(0, -1)); return; }
    if (key === "") return;
    if (pin.length >= 4) return;
    const next = pin + key;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => {
        if (next === CORRECT) {
          setExiting(true);
          setTimeout(onUnlock, 600);
        } else {
          setError(true);
          setTimeout(() => { setError(false); setPin(""); }, 900);
        }
      }, 150);
    }
  }

  return (
    <div className={`pin-overlay${exiting ? " pin-out" : ""}`}>
      <canvas id="bg-canvas" />

      <div className="pin-card">
        <p className="pin-logo">WMS GDRM</p>
        <h1 className="pin-title">Warehouse Control</h1>
        <p className="pin-sub">Masukkan PIN 4 digit</p>

        {/* Dots */}
        <div className="pin-dots">
          {[0,1,2,3].map((i) => (
            <div
              key={i}
              className={`pin-dot${pin.length > i ? (error ? " dot-error" : " dot-filled") : ""}`}
            />
          ))}
        </div>

        {/* Keypad */}
        <div className="pin-pad">
          {PAD_KEYS.map(({ n, sub }, idx) => (
            <button
              key={idx}
              className={`pin-btn${n === "" ? " pin-btn-empty" : ""}`}
              onClick={() => press(n)}
              disabled={n === ""}
              aria-label={n === "⌫" ? "hapus" : n}
            >
              <span className="pin-num">{n}</span>
              {sub && <span className="pin-sub-letters">{sub}</span>}
            </button>
          ))}
        </div>

        <p className={`pin-error${error ? " visible" : ""}`}>PIN salah, coba lagi</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────────── */
export default function Home() {
const [unlocked, setUnlocked] = useState(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("wms_auth") === "OK";
});
  const [dark, setDark] = useState(true);
  const [menu, setMenu] = useState("Stock Ready");
  const [plant, setPlant] = useState("ALL");
  const [search, setSearch] = useState("");

  const [stock, setStock] = useState<any[]>([]);
  const [service, setService] = useState<any[]>([]);
  const [bonan, setBonan] = useState<any[]>([]);
  const [keluar, setKeluar] = useState<any[]>([]);
  const [kapasitas, setKapasitas] = useState<any[]>([]);
  const [hold, setHold] = useState<any[]>([]);

  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateFilter, setDateFilter] = useState(todayStr);
  const [dateMode, setDateMode] = useState("ALL");

  useEffect(() => { if (unlocked) loadAll(); }, [unlocked]);

  async function loadAll() {
    const [s, sl, b, k, kg, h] = await Promise.all([
      supabase.from("stock_live").select("*").limit(10000),
      supabase.from("master_kedatangan").select("*").limit(3000),
      supabase.from("bonan_ppic").select("*").limit(3000),
      supabase.from("transaksi_keluar").select("*").limit(5000),
      supabase.from("kapasitas_gudang").select("*").limit(1000),
      supabase.from("transaksi_hold").select("*").limit(3000),
    ]);
    setStock(s.data || []);
    setService(sl.data || []);
    setBonan(b.data || []);
    setKeluar(k.data || []);
    setKapasitas(kg.data || []);
    setHold(h.data || []);
  }

  function matchSearch(row: any) {
    return !search || JSON.stringify(row).toLowerCase().includes(search.toLowerCase());
  }

  const stockFiltered = stock.filter((r) => {
    const okPlant = plant === "ALL" || String(r.plant) === plant;
    const rowDate = r.tanggal_kedatangan ? String(r.tanggal_kedatangan).slice(0, 10) : "";
    const okDate = dateMode === "ALL" || !dateFilter || rowDate === dateFilter;
    return okPlant && okDate;
  });

  const fifo = useMemo(() => {
    const group: any = {};
    stockFiltered
      .filter((r) => Number(r.tot_qty_kemasan || 0) > 0)
      .sort((a, b) => new Date(a.tanggal_kedatangan).getTime() - new Date(b.tanggal_kedatangan).getTime())
      .forEach((r) => {
        if (!group[r.sku_rm]) group[r.sku_rm] = { sku_rm: r.sku_rm, nama_rm: r.nama_rm, fifo: [] };
        group[r.sku_rm].fifo.push(r);
      });
    return Object.values(group);
  }, [stockFiltered]);

  const alerts = useMemo(() => {
    const today = new Date();
    const a: any[] = [];
    stockFiltered.forEach((r) => {
      if (r.tanggal_kedatangan) {
        const age = Math.floor((today.getTime() - new Date(r.tanggal_kedatangan).getTime()) / 86400000);
        if (age > 4) a.push({ type: "LIFETIME > 4 HARI", category: "AGING", rm: r.nama_rm, sku: r.sku_rm, batch: r.no_batch, qty: r.tot_qty_kemasan, kg: r.tot_qty_kg, plant: r.plant, lokasi: r.lokasi_rm, value: age });
      }
      if (r.tanggal_expired) {
        const left = Math.floor((new Date(r.tanggal_expired).getTime() - today.getTime()) / 86400000);
        if (left <= 20) a.push({ type: "MENDEKATI EXPIRED", category: "EXPIRED", rm: r.nama_rm, sku: r.sku_rm, batch: r.no_batch, qty: r.tot_qty_kemasan, kg: r.tot_qty_kg, plant: r.plant, lokasi: r.lokasi_rm, value: left });
      }
    });
    hold.forEach((r) => {
      const okPlant = plant === "ALL" || String(r.plant) === plant || String(r.plant_pemilik) === plant;
      if (!okPlant) return;
      const age = r.tanggal ? Math.floor((today.getTime() - new Date(r.tanggal).getTime()) / 86400000) : 0;
      a.push({ type: "HOLD / GANTUNGAN", category: "HOLD", rm: r.nama_rm, sku: r.sku_rm, batch: "-", qty: r.qty_kemasan, kg: r.qty_kg, plant: r.plant, lokasi: "-", value: age, note: r.note, status: r.status });
    });
    return a;
  }, [stockFiltered, hold, plant]);

  const stockView     = stockFiltered.filter(matchSearch);
  const fifoView      = fifo.filter(matchSearch);
  const alertView     = alerts.filter(matchSearch);
  const serviceView   = service.filter(matchSearch);
  const bonanView     = bonan.filter(matchSearch);
  const kapasitasView = kapasitas.filter(matchSearch);

  function getCurrentData() {
    if (menu === "Stock Ready")   return stockView;
    if (menu === "FIFO Matrix")   return fifoView;
    if (menu === "Alert Center")  return alertView;
    if (menu === "Service Level") return serviceView;
    if (menu === "Bonan PPIC")    return bonanView;
    if (menu === "Kapasitas")     return kapasitasView;
    if (menu === "Stok Jalur")    return bonanView;
    return [];
  }

  function downloadCurrentDataPDF() {
    const data = getCurrentData();
    if (!data.length) { alert("Tidak ada data untuk PDF"); return; }
    const keys = Object.keys(data[0]);
    const html = `<html><head><title>${menu}</title><style>
      body{font-family:Arial;padding:22px;color:#111}
      h2{margin:0 0 4px}p{margin:0 0 18px;color:#555}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{border:1px solid #ccc;padding:6px;text-align:left;vertical-align:top}
      th{background:#111;color:white}
    </style></head><body>
      <h2>WMS GDRM - ${menu}</h2>
      <p>Plant: ${plant} | Mode: ${dateMode} | Tanggal: ${dateFilter}</p>
      <table><thead><tr>${keys.map((k) => `<th>${k}</th>`).join("")}</tr></thead>
      <tbody>${data.map((row) => `<tr>${keys.map((k) => `<td>${row[k] ?? ""}</td>`).join("")}</tr>`).join("")}</tbody>
      </table></body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.print();
  }
  
function logout() {

  localStorage.removeItem("wms_auth");

  setUnlocked(false);
}
  
  if (!unlocked) return <PinScreen onUnlock={() => setUnlocked(true)} />;

  const nowLabel = new Date().toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  return (
    <div className={`app-shell ${dark ? "dark" : "light"}`}>

      {/* ── TOPBAR ── */}
      <header className="topbar">
        <span className="topbar-logo">⬡ WMS GDRM</span>
        <div className="topbar-sep" />

        {/* Plant filter */}
        <div className="plant-group">
          {["ALL", "1111", "1112", "1113"].map((p) => (
            <button key={p} className={`plant-btn${plant === p ? " active" : ""}`} onClick={() => setPlant(p)}>{p}</button>
          ))}
        </div>

       <div className="topbar-right">

  <span className="top-date">
    {nowLabel}
  </span>

  <div className="search-box">
    <Search size={14} />
    <input
      placeholder="Cari semua data..."
      value={search}
      onChange={(e) => setSearch(e.target.value)}
    />
  </div>

  {/* Refresh */}
  <button
    className="icon-round"
    onClick={loadAll}
    title="Refresh"
  >
    <RefreshCcw size={16} />
  </button>

  {/* Dark Mode */}
  <button
    className="icon-round"
    onClick={() => setDark(!dark)}
    title="Toggle Tema"
  >
    {dark ? <Sun size={16} /> : <Moon size={16} />}
  </button>

  {/* Logout */}
  <button
    className="icon-round"
    onClick={logout}
    title="Logout"
  >
    <LogOut size={16} />
  </button>

</div>

          <button className="icon-round" onClick={() => setDark(!dark)} aria-label="Toggle tema">
            {dark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <p className="sidebar-label">MENU</p>
        {MENUS.map(({ id, icon: Icon }) => (
          <button key={id} className={`nav-btn${menu === id ? " active" : ""}`} onClick={() => setMenu(id)}>
            <Icon size={16} aria-hidden />
            {id}
          </button>
        ))}
      </aside>

      {/* ── MAIN ── */}
      <main className="main">

        {/* Metric cards */}
        <div className="metrics">
          <MetricCard label="Batch Ready"    value={fmt0(stockView.length)}         color="gold" />
          <MetricCard label="Total Kemasan"  value={fmt0(stockView.reduce((a, b) => a + Number(b.tot_qty_kemasan || 0), 0))} color="blue" />
          <MetricCard label="Total KG"       value={fmt2(stockView.reduce((a, b) => a + Number(b.tot_qty_kg || 0), 0))}       color="green" />
          <MetricCard label="Alert Aktif"    value={fmt0(alertView.length)}          color="red" />
        </div>

        {/* Panel */}
        <div className="panel">
          {/* Panel header */}
          <div className="panel-header">
            <span className="panel-title">{menu}</span>
            <span className="panel-count">{getCurrentData().length} baris</span>

            <div className="date-filter">
              <button className={`date-btn${dateMode === "TODAY" ? " active" : ""}`} onClick={() => { setDateMode("TODAY"); setDateFilter(todayStr); }}>Today</button>
              <button className={`date-btn${dateMode === "ALL" ? " active" : ""}`}   onClick={() => setDateMode("ALL")}>All</button>
              <input type="date" className="date-inp" value={dateFilter} onChange={(e) => { setDateMode("TODAY"); setDateFilter(e.target.value); }} />
            </div>

            <div style={{ flex: 1 }} />

            <div className="panel-actions">
  <button
    className="action-btn primary"
    onClick={downloadCurrentDataPDF}
  >
    <FileDown size={14} />
    PDF
  </button>

  <button
    className="action-btn"
    onClick={() => alert("Telegram segera disambungkan")}
  >
    <Send size={14} />
    Telegram
  </button>

</div>
          </div>

          {/* Panel body */}
          <div className="table-scroll">
            {menu === "Stock Ready"   && <StockTable   rows={stockView} />}
            {menu === "FIFO Matrix"   && <FIFOTable    rows={fifoView} />}
            {menu === "Alert Center"  && <AlertView    rows={alertView} />}
            {menu === "Kapasitas"     && <KapasitasTable rows={kapasitasView} stock={stockView} />}
            {menu === "Service Level" && <ServiceTable rows={serviceView} />}
            {menu === "Bonan PPIC"    && <BonanTable   rows={bonanView} keluar={keluar} />}
            {menu === "Stok Jalur"    && <StokJalurTable bonan={bonanView} stock={stockView} keluar={keluar} />}
          </div>
        </div>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────
   HELPER COMPONENTS
───────────────────────────────────────────── */
function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`metric-card metric-${color}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}

function Tbl({ heads, children }: { heads: string[]; children: React.ReactNode }) {
  return (
    <table className="data-table">
      <thead><tr>{heads.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Badge({ text, variant }: { text: string; variant: "aman" | "kurang" | "hold" | "pending" | "blue" }) {
  return <span className={`badge badge-${variant}`}>{text}</span>;
}

function StockTable({ rows }: any) {
  return (
    <Tbl heads={["Plant","SKU QR","SKU RM","Nama RM","Batch","Qty Kemasan","Total KG","Lokasi"]}>
      {rows.map((r: any, i: number) => (
        <tr key={i}>
          <td><Badge text={r.plant} variant="blue" /></td>
          <td className="muted sm">{r.sku_qr}</td>
          <td className="bold">{r.sku_rm}</td>
          <td>{r.nama_rm}</td>
          <td className="muted">{r.no_batch}</td>
          <td className="num blue">{fmt0(r.tot_qty_kemasan)}</td>
          <td className="num green">{fmt2(r.tot_qty_kg)}</td>
          <td className="muted">{r.lokasi_rm}</td>
        </tr>
      ))}
    </Tbl>
  );
}

function FIFOTable({ rows }: any) {
  return (
    <Tbl heads={["SKU RM","Nama RM","FIFO 1 (Terlama)","FIFO 2","FIFO 3"]}>
      {rows.map((r: any) => (
        <tr key={r.sku_rm}>
          <td className="bold">{r.sku_rm}</td>
          <td>{r.nama_rm}</td>
          {[0,1,2].map((i) => (
            <td key={i}>
              {r.fifo[i]
                ? <><span className="bold">{r.fifo[i].no_batch || "-"}</span><br /><span className="muted sm">{fmt0(r.fifo[i].tot_qty_kemasan)} zak · {r.fifo[i].tanggal_kedatangan}</span></>
                : <span className="muted">—</span>}
            </td>
          ))}
        </tr>
      ))}
    </Tbl>
  );
}

function AlertView({ rows }: any) {
  const hold    = rows.filter((r: any) => r.category === "HOLD");
  const aging   = rows.filter((r: any) => r.category === "AGING");
  const expired = rows.filter((r: any) => r.category === "EXPIRED");

  return (
    <div>
      <div className="alert-summary">
        <div className="alert-stat hold-stat"><span>{hold.length}</span>HOLD</div>
        <div className="alert-stat aging-stat"><span>{aging.length}</span>Lifetime &gt;4 Hari</div>
        <div className="alert-stat expired-stat"><span>{expired.length}</span>Mendekati Expired</div>
      </div>
      <div className="alert-grid">
        {rows.map((r: any, i: number) => (
          <div className={`alert-card cat-${r.category.toLowerCase()}`} key={i}>
            <div className="alert-type">{r.type}</div>
            <div className="alert-name">{r.rm}</div>
            <div className="alert-detail">{r.sku} · Plant {r.plant} · Batch {r.batch}</div>
            <div className="alert-detail">Qty: {fmt0(r.qty)} zak · {fmt2(r.kg)} kg</div>
            {r.note   && <div className="alert-note">📋 {r.note}</div>}
            {r.status && <div className="alert-detail">Status: {r.status}</div>}
            <div className="alert-value">{r.value} hari</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function KapasitasTable({ rows, stock }: any) {
  return (
    <Tbl heads={["Lokasi","Kapasitas","Isi","Penggunaan","Batch RM","Status"]}>
      {rows.map((r: any, i: number) => {
        const isi   = stock.filter((s: any) => String(s.lokasi_rm).includes(r.lokasi));
        const pct   = parseInt(r.persen) || 0;
        const color = pct > 80 ? "red" : pct > 60 ? "gold" : "green";
        return (
          <tr key={i}>
            <td className="bold">{r.lokasi}</td>
            <td>{fmt0(r.kapasitas)}</td>
            <td>{fmt0(r.isi)}</td>
            <td>
              <div className="prog-wrap">
                <div className="prog-bar">
                  <div className={`prog-fill prog-${color}`} style={{ width: `${pct}%` }} />
                </div>
                <span className="prog-label">{r.persen}</span>
              </div>
            </td>
            <td className="num blue">{isi.length} batch</td>
            <td><Badge text={pct > 80 ? "PENUH" : pct > 60 ? "SEDANG" : "AMAN"} variant={pct > 80 ? "kurang" : pct > 60 ? "hold" : "aman"} /></td>
          </tr>
        );
      })}
    </Tbl>
  );
}

function ServiceTable({ rows }: any) {
  return (
    <Tbl heads={["Tanggal","Plant","Nama RM","Timeline","PO / GR","Status"]}>
      {rows.map((r: any, i: number) => (
        <tr key={i}>
          <td className="muted">{r.tanggal_kedatangan}</td>
          <td><Badge text={r.plant} variant="blue" /></td>
          <td className="bold">{r.nama_rm}</td>
          <td className="muted sm">Masuk {r.jam_masuk||"-"} · QC {r.jam_pengecekan_qc||"-"} · Bongkar {r.jam_start_bongkar||"-"}–{r.jam_selesai_bongkar||"-"}</td>
          <td className="sm">{r.nomor_po} / {r.dokumen_gr}</td>
          <td><Badge text={r.status_approved} variant={r.status_approved === "Approved" ? "aman" : "pending"} /></td>
        </tr>
      ))}
    </Tbl>
  );
}

function BonanTable({ rows, keluar }: any) {
  return (
    <Tbl heads={["Tanggal","Plant","SKU","Nama RM","Bon Zak","Realisasi","Kurang"]}>
      {rows.map((r: any, i: number) => {
        const real   = keluar.filter((k: any) => String(k.sku_rm) === String(r.sku)).reduce((a: number, b: any) => a + Number(b.qty_kemasan || 0), 0);
        const kurang = Number(r.qty_bon_zak || 0) - real;
        return (
          <tr key={i}>
            <td className="muted">{r.tanggal}</td>
            <td><Badge text={r.plant} variant="blue" /></td>
            <td className="bold">{r.sku}</td>
            <td>{r.nama_rm}</td>
            <td className="num blue">{fmt0(r.qty_bon_zak)}</td>
            <td className="num green">{fmt0(real)}</td>
            <td><Badge text={fmt0(kurang)} variant={kurang > 0 ? "kurang" : "aman"} /></td>
          </tr>
        );
      })}
    </Tbl>
  );
}

function StokJalurTable({ bonan, stock, keluar }: any) {
  return (
    <Tbl heads={["SKU","Nama RM","Bonan","Stock Ready","Keluar","Status"]}>
      {bonan.map((r: any, i: number) => {
        const st  = stock.filter((s: any) => String(s.sku_rm) === String(r.sku)).reduce((a: number, b: any) => a + Number(b.tot_qty_kemasan || 0), 0);
        const out = keluar.filter((k: any) => String(k.sku_rm) === String(r.sku)).reduce((a: number, b: any) => a + Number(b.qty_kemasan || 0), 0);
        return (
          <tr key={i}>
            <td className="bold">{r.sku}</td>
            <td>{r.nama_rm}</td>
            <td className="num blue">{fmt0(r.qty_bon_zak)}</td>
            <td className="num green">{fmt0(st)}</td>
            <td className="muted">{fmt0(out)}</td>
            <td><Badge text={st >= Number(r.qty_bon_zak || 0) ? "AMAN" : "KURANG"} variant={st >= Number(r.qty_bon_zak || 0) ? "aman" : "kurang"} /></td>
          </tr>
        );
      })}
    </Tbl>
  );
}
