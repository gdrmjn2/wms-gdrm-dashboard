"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Moon, Sun, Search, Lock } from "lucide-react";

export default function Home() {
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [dark, setDark] = useState(true);
  const [menu, setMenu] = useState("stock");
  const [plant, setPlant] = useState("ALL");
  const [search, setSearch] = useState("");
  const [stock, setStock] = useState<any[]>([]);
  const [fifo, setFifo] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);

  const correctPin = process.env.NEXT_PUBLIC_PIN || "0000";

  useEffect(() => {
    if (unlocked) loadData();
  }, [unlocked, plant]);

  async function loadData() {
    let q = supabase.from("stock_live").select("*").order("sku_rm");
    if (plant !== "ALL") q = q.eq("plant", plant);
    const { data } = await q;
    const rows = data || [];
    setStock(rows);
    buildFifo(rows);
    buildAlerts(rows);
  }

  function buildFifo(rows: any[]) {
    const group: any = {};

    rows
      .filter((r) => Number(r.tot_qty_kemasan || 0) > 0)
      .sort(
        (a, b) =>
          new Date(a.tanggal_kedatangan).getTime() -
          new Date(b.tanggal_kedatangan).getTime()
      )
      .forEach((r) => {
        if (!group[r.sku_rm]) {
          group[r.sku_rm] = {
            sku_rm: r.sku_rm,
            nama_rm: r.nama_rm,
            fifo: [],
          };
        }
        group[r.sku_rm].fifo.push(r);
      });

    setFifo(Object.values(group));
  }

  function buildAlerts(rows: any[]) {
    const today = new Date();

    const result = rows.flatMap((r) => {
      const arr: any[] = [];

      if (r.tanggal_kedatangan) {
        const age = Math.floor(
          (today.getTime() - new Date(r.tanggal_kedatangan).getTime()) /
            86400000
        );

        if (age > 4) {
          arr.push({
            type: "AGING > 4 HARI",
            sku_rm: r.sku_rm,
            nama_rm: r.nama_rm,
            batch: r.no_batch,
            qty: r.tot_qty_kemasan,
            value: age,
          });
        }
      }

      if (r.tanggal_expired) {
        const left = Math.floor(
          (new Date(r.tanggal_expired).getTime() - today.getTime()) / 86400000
        );

        if (left <= 20) {
          arr.push({
            type: "EXPIRED MENDEKAT",
            sku_rm: r.sku_rm,
            nama_rm: r.nama_rm,
            batch: r.no_batch,
            qty: r.tot_qty_kemasan,
            value: left,
          });
        }
      }

      return arr;
    });

    setAlerts(result);
  }

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-3xl bg-slate-900 p-8 shadow-2xl text-center">
          <Lock className="mx-auto mb-4" size={42} />
          <h1 className="text-2xl font-bold mb-2">WMS GDRM</h1>
          <p className="text-slate-400 mb-6">Masukkan PIN</p>

          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full text-center text-3xl tracking-widest rounded-2xl bg-slate-800 p-4 outline-none"
            placeholder="••••"
          />

          <button
            onClick={() => {
              if (pin === correctPin) setUnlocked(true);
              else alert("PIN salah");
            }}
            className="mt-6 w-full rounded-2xl bg-blue-600 py-4 font-bold"
          >
            Masuk
          </button>
        </div>
      </main>
    );
  }

  const theme = dark
    ? "bg-slate-950 text-white"
    : "bg-slate-100 text-slate-900";

  const card = dark ? "bg-slate-900" : "bg-white";

  const filteredStock = stock.filter((r) =>
    JSON.stringify(r).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className={`min-h-screen ${theme} p-4 md:p-6`}>
      <div className="max-w-7xl mx-auto space-y-5">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">WMS GDRM Dashboard</h1>
            <p className="opacity-60">Stock, FIFO, Alert, Bonan, Kapasitas</p>
          </div>

          <button
            onClick={() => setDark(!dark)}
            className={`rounded-2xl p-3 ${card}`}
          >
            {dark ? <Sun /> : <Moon />}
          </button>
        </header>

        <section className="flex gap-2 overflow-x-auto">
          {["ALL", "1111", "1112", "1113"].map((p) => (
            <button
              key={p}
              onClick={() => setPlant(p)}
              className={`px-5 py-3 rounded-2xl ${
                plant === p ? "bg-blue-600 text-white" : card
              }`}
            >
              {p}
            </button>
          ))}
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card title="Batch Ready" value={stock.length} card={card} />
          <Card
            title="Total Zak"
            value={stock.reduce((a, b) => a + Number(b.tot_qty_kemasan || 0), 0)}
            card={card}
          />
          <Card title="FIFO RM" value={fifo.length} card={card} />
          <Card title="Alert" value={alerts.length} card={card} />
        </section>

        <nav className="flex gap-2 overflow-x-auto">
          {[
            ["stock", "Stock Ready"],
            ["fifo", "FIFO Matrix"],
            ["alert", "Alert Center"],
            ["kapasitas", "Kapasitas"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMenu(id)}
              className={`px-4 py-3 rounded-2xl whitespace-nowrap ${
                menu === id ? "bg-blue-600 text-white" : card
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className={`rounded-3xl ${card} p-4`}>
          <div className="flex items-center gap-2 mb-4">
            <Search size={18} />
            <input
              className="w-full bg-transparent outline-none"
              placeholder="Search SKU, nama RM, batch, lokasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {menu === "stock" && <StockTable rows={filteredStock} />}
          {menu === "fifo" && <FifoTable rows={fifo} />}
          {menu === "alert" && <AlertTable rows={alerts} />}
          {menu === "kapasitas" && <Kapasitas />}
        </div>
      </div>
    </main>
  );
}

function Card({ title, value, card }: any) {
  return (
    <div className={`rounded-3xl ${card} p-5 shadow`}>
      <div className="opacity-60 text-sm">{title}</div>
      <div className="text-2xl font-black mt-2">{value}</div>
    </div>
  );
}

function StockTable({ rows }: any) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="opacity-60 text-left">
            <th>Plant</th>
            <th>SKU RM</th>
            <th>Nama RM</th>
            <th>Batch</th>
            <th>Qty</th>
            <th>KG</th>
            <th>Lokasi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.sku_qr} className="border-t border-slate-700/30">
              <td>{r.plant}</td>
              <td>{r.sku_rm}</td>
              <td>{r.nama_rm}</td>
              <td>{r.no_batch}</td>
              <td>{r.tot_qty_kemasan}</td>
              <td>{r.tot_qty_kg}</td>
              <td>{r.lokasi_rm}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FifoTable({ rows }: any) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="opacity-60 text-left">
            <th>SKU RM</th>
            <th>Nama RM</th>
            <th>FIFO 1</th>
            <th>FIFO 2</th>
            <th>FIFO 3</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.sku_rm} className="border-t border-slate-700/30">
              <td>{r.sku_rm}</td>
              <td>{r.nama_rm}</td>
              {[0, 1, 2].map((i) => (
                <td key={i}>
                  {r.fifo[i]
                    ? `${r.fifo[i].no_batch || "-"} / ${r.fifo[i].tot_qty_kemasan || 0} zak`
                    : "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertTable({ rows }: any) {
  return (
    <div className="space-y-3">
      {rows.map((r: any, i: number) => (
        <div key={i} className="rounded-2xl bg-red-500/10 p-4">
          <b>{r.type}</b>
          <div>{r.sku_rm} - {r.nama_rm}</div>
          <div>Batch: {r.batch} | Qty: {r.qty} | Nilai: {r.value}</div>
        </div>
      ))}
    </div>
  );
}

function Kapasitas() {
  return <div>Menu kapasitas detail kita aktifkan setelah fetch tabel kapasitas.</div>;
}
