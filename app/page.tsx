"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Moon, Sun, Lock, Search } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

const MENUS = [
  "Service Level",
  "Bonan PPIC",
  "Kapasitas",
  "Stock Ready",
  "FIFO Matrix",
  "Stok Jalur",
  "Alert Center",
];

export default function Home() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
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

  const correctPin = process.env.NEXT_PUBLIC_PIN || "0000";

  useEffect(() => {
    if (unlocked) loadAll();
  }, [unlocked]);

  async function loadAll() {
    const [s, sl, b, k, kg, h] = await Promise.all([
      supabase.from("stock_live").select("*").limit(5000),
      supabase.from("master_kedatangan").select("*").limit(1000),
      supabase.from("bonan_ppic").select("*").limit(1000),
      supabase.from("transaksi_keluar").select("*").limit(3000),
      supabase.from("kapasitas_gudang").select("*").limit(1000),
      supabase.from("transaksi_hold").select("*").limit(1000),
    ]);

    setStock(s.data || []);
    setService(sl.data || []);
    setBonan(b.data || []);
    setKeluar(k.data || []);
    setKapasitas(kg.data || []);
    setHold(h.data || []);
  }

  const stockFiltered = stock.filter((r) => {
    const okPlant = plant === "ALL" || String(r.plant) === plant;
    const okSearch = JSON.stringify(r).toLowerCase().includes(search.toLowerCase());
    return okPlant && okSearch;
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
        if (age > 4) a.push({ type: "AGING > 4 HARI", rm: r.nama_rm, sku: r.sku_rm, batch: r.no_batch, qty: r.tot_qty_kemasan, value: age });
      }

      if (r.tanggal_expired) {
        const left = Math.floor((new Date(r.tanggal_expired).getTime() - today.getTime()) / 86400000);
        if (left <= 20) a.push({ type: "EXPIRED MENDEKAT", rm: r.nama_rm, sku: r.sku_rm, batch: r.no_batch, qty: r.tot_qty_kemasan, value: left });
      }
    });

    hold.forEach((r) => {
      if (r.tanggal) {
        const age = Math.floor((today.getTime() - new Date(r.tanggal).getTime()) / 86400000);
        if (age > 5) a.push({ type: "HOLD > 5 HARI", rm: r.nama_rm, sku: r.sku_rm, batch: "-", qty: r.qty_kemasan, value: age });
      }
    });

    return a;
  }, [stockFiltered, hold]);

  if (!unlocked) {
    return (
      <main className="screen dark">
        <div className="login-card">
          <Lock size={42} />
          <h1>WMS GDRM</h1>
          <p>Masukkan PIN</p>
          <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="••••" />
          <button onClick={() => pin === correctPin ? setUnlocked(true) : alert("PIN salah")}>Masuk</button>
        </div>
      </main>
    );
  }

  return (
    <main className={`screen ${dark ? "dark" : "light"}`}>
      <div className="wrap">
        <header className="header">
          <div>
            <h1>WMS GDRM Dashboard</h1>
            <p>Warehouse Control Center</p>
          </div>
          <button className="icon-btn" onClick={() => setDark(!dark)}>{dark ? <Sun /> : <Moon />}</button>
        </header>

        <div className="plants">
          {["ALL", "1111", "1112", "1113"].map((p) => (
            <button key={p} className={plant === p ? "active" : ""} onClick={() => setPlant(p)}>{p}</button>
          ))}
        </div>

        <section className="toolbar">
  <input
    type="date"
    onChange={(e) => {
      const d = e.target.value;
      if (!d) return;
      alert("Filter tanggal dipilih: " + d);
    }}
  />

  <button onClick={() => window.print()}>
    Download PDF
  </button>

  <button
    onClick={() =>
      alert("Telegram nanti kita sambungkan setelah bot token siap")
    }
  >
    Send Telegram
  </button>
</section>

       <section className="cards">
  <Card title="Batch Ready" value={stockFiltered.length} />
  <Card
    title="Total Kemasan"
    value={stockFiltered
      .reduce((a, b) => a + Number(b.tot_qty_kemasan || 0), 0)
      .toLocaleString("id-ID")}
  />
  <Card
    title="Total KG"
    value={stockFiltered
      .reduce((a, b) => a + Number(b.tot_qty_kg || 0), 0)
      .toLocaleString("id-ID")}
  />
  <Card title="Alert" value={alerts.length} />
</section>

        <nav className="menu">
          {MENUS.map((m) => <button key={m} className={menu === m ? "active" : ""} onClick={() => setMenu(m)}>{m}</button>)}
        </nav>

        <section className="panel">
          <div className="search">
            <Search size={18} />
            <input placeholder="Search semua data..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          {menu === "Stock Ready" && <Stock rows={stockFiltered} />}
          {menu === "FIFO Matrix" && <FIFO rows={fifo} />}
          {menu === "Alert Center" && <Alert rows={alerts} />}
          {menu === "Kapasitas" && <Kapasitas rows={kapasitas} stock={stockFiltered} />}
          {menu === "Service Level" && <Service rows={service} />}
          {menu === "Bonan PPIC" && <Bonan rows={bonan} keluar={keluar} />}
          {menu === "Stok Jalur" && <StokJalur bonan={bonan} stock={stockFiltered} keluar={keluar} />}
        </section>
      </div>
    </main>
  );
}

function Card({ title, value }: any) {
  return <div className="card"><div className="card-title">{title}</div><div className="card-value">{value}</div></div>;
}

function Table({ children }: any) {
  return <div className="table-wrap"><table>{children}</table></div>;
}

function Stock({ rows }: any) {
  return <Table><thead><tr><th>Plant</th><th>SKU RM</th><th>Nama RM</th><th>Batch</th><th>Qty</th><th>KG</th><th>Lokasi</th></tr></thead><tbody>
    {rows.map((r: any) => <tr key={r.sku_qr}><td>{r.plant}</td><td>{r.sku_rm}</td><td>{r.nama_rm}</td><td>{r.no_batch}</td><td>{r.tot_qty_kemasan}</td><td>{r.tot_qty_kg}</td><td>{r.lokasi_rm}</td></tr>)}
  </tbody></Table>;
}

function FIFO({ rows }: any) {
  return <Table><thead><tr><th>SKU RM</th><th>Nama RM</th><th>FIFO 1</th><th>FIFO 2</th><th>FIFO 3</th></tr></thead><tbody>
    {rows.map((r: any) => <tr key={r.sku_rm}><td>{r.sku_rm}</td><td>{r.nama_rm}</td>{[0,1,2].map(i => <td key={i}>{r.fifo[i] ? `${r.fifo[i].no_batch || "-"} / ${r.fifo[i].tot_qty_kemasan || 0} zak` : "-"}</td>)}</tr>)}
  </tbody></Table>;
}

function Alert({ rows }: any) {
  return <div className="alert-list">{rows.map((r: any, i: number) => <div className="alert-card" key={i}><b>{r.type}</b><div>{r.sku} - {r.rm}</div><div>Batch: {r.batch} | Qty: {r.qty} | Hari: {r.value}</div></div>)}</div>;
}

function Kapasitas({ rows, stock }: any) {
  return <Table><thead><tr><th>Lokasi</th><th>Kapasitas</th><th>Isi</th><th>%</th><th>Isi RM</th></tr></thead><tbody>
    {rows.map((r: any, i: number) => {
      const isi = stock.filter((s: any) => String(s.lokasi_rm).includes(r.lokasi));
      return <tr key={i}><td>{r.lokasi}</td><td>{r.kapasitas}</td><td>{r.isi}</td><td>{r.persen}</td><td>{isi.length} batch</td></tr>;
    })}
  </tbody></Table>;
}

function Service({ rows }: any) {
  return <Table><thead><tr><th>Tanggal</th><th>Plant</th><th>RM</th><th>Timeline</th><th>Dokumen</th><th>Status</th></tr></thead><tbody>
    {rows.map((r: any, i: number) => <tr key={i}><td>{r.tanggal_kedatangan}</td><td>{r.plant}</td><td>{r.nama_rm}</td><td>Masuk {r.jam_masuk || "-"} | QC {r.jam_pengecekan_qc || "-"} | Bongkar {r.jam_start_bongkar || "-"}-{r.jam_selesai_bongkar || "-"}</td><td>{r.nomor_po} / {r.dokumen_gr}</td><td>{r.status_approved}</td></tr>)}
  </tbody></Table>;
}

function Bonan({ rows, keluar }: any) {
  return <Table><thead><tr><th>Tanggal</th><th>Plant</th><th>SKU</th><th>Nama RM</th><th>Bon Zak</th><th>Realisasi</th><th>Kurang</th></tr></thead><tbody>
    {rows.map((r: any, i: number) => {
      const real = keluar.filter((k: any) => String(k.sku_rm) === String(r.sku)).reduce((a: number, b: any) => a + Number(b.qty_kemasan || 0), 0);
      return <tr key={i}><td>{r.tanggal}</td><td>{r.plant}</td><td>{r.sku}</td><td>{r.nama_rm}</td><td>{r.qty_bon_zak}</td><td>{real}</td><td>{Number(r.qty_bon_zak || 0) - real}</td></tr>;
    })}
  </tbody></Table>;
}

function StokJalur({ bonan, stock, keluar }: any) {
  return <Table><thead><tr><th>SKU</th><th>Nama RM</th><th>Bonan</th><th>Stock Ready</th><th>Keluar</th><th>Status</th></tr></thead><tbody>
    {bonan.map((r: any, i: number) => {
      const st = stock.filter((s: any) => String(s.sku_rm) === String(r.sku)).reduce((a: number, b: any) => a + Number(b.tot_qty_kemasan || 0), 0);
      const out = keluar.filter((k: any) => String(k.sku_rm) === String(r.sku)).reduce((a: number, b: any) => a + Number(b.qty_kemasan || 0), 0);
      return <tr key={i}><td>{r.sku}</td><td>{r.nama_rm}</td><td>{r.qty_bon_zak}</td><td>{st}</td><td>{out}</td><td>{st >= Number(r.qty_bon_zak || 0) ? "AMAN" : "KURANG"}</td></tr>;
    })}
  </tbody></Table>;
}
