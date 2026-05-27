"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Moon, Sun, Search, Lock } from "lucide-react";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

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
      <main className="screen dark">
        <div className="login-card">
          <Lock size={42} />
          <h1>WMS GDRM</h1>
          <p>Masukkan PIN</p>
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
          />
          <button
            onClick={() => {
              if (pin === correctPin) setUnlocked(true);
              else alert("PIN salah");
            }}
          >
            Masuk
          </button>
        </div>
      </main>
    );
  }

  const mode = dark ? "dark" : "light";

  const filteredStock = stock.filter((r) =>
    JSON.stringify(r).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className={`screen ${mode}`}>
      <div className="wrap">
        <header className="header">
          <div>
            <h1>WMS GDRM Dashboard</h1>
            <p>Stock, FIFO, Alert, Bonan, Kapasitas</p>
          </div>

          <button className="icon-btn" onClick={() => setDark(!dark)}>
            {dark ? <Sun /> : <Moon />}
          </button>
        </header>

        <section className="plants">
          {["ALL", "1111", "1112", "1113"].map((p) => (
            <button
              key={p}
              onClick={() => setPlant(p)}
              className={plant === p ? "active" : ""}
            >
              {p}
            </button>
          ))}
        </section>

        <section className="cards">
          <Card title="Batch Ready" value={stock.length} />
          <Card
            title="Total Zak"
            value={stock.reduce(
              (a, b) => a + Number(b.tot_qty_kemasan || 0),
              0
            )}
          />
          <Card title="FIFO RM" value={fifo.length} />
          <Card title="Alert" value={alerts.length} />
        </section>

        <nav className="menu">
          {[
            ["stock", "Stock Ready"],
            ["fifo", "FIFO Matrix"],
            ["alert", "Alert Center"],
            ["kapasitas", "Kapasitas"],
          ].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setMenu(id)}
              className={menu === id ? "active" : ""}
            >
              {label}
            </button>
          ))}
        </nav>

        <section className="panel">
          <div className="search">
            <Search size={18} />
            <input
              placeholder="Search SKU, nama RM, batch, lokasi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {menu === "stock" && <StockTable rows={filteredStock} />}
          {menu === "fifo" && <FifoTable rows={fifo} />}
          {menu === "alert" && <AlertTable rows={alerts} />}
          {menu === "kapasitas" && <Kapasitas />}
        </section>
      </div>
    </main>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="card">
      <div className="card-title">{title}</div>
      <div className="card-value">{value}</div>
    </div>
  );
}

function StockTable({ rows }: any) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
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
            <tr key={r.sku_qr}>
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
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>SKU RM</th>
            <th>Nama RM</th>
            <th>FIFO 1</th>
            <th>FIFO 2</th>
            <th>FIFO 3</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any) => (
            <tr key={r.sku_rm}>
              <td>{r.sku_rm}</td>
              <td>{r.nama_rm}</td>
              {[0, 1, 2].map((i) => (
                <td key={i}>
                  {r.fifo[i]
                    ? `${r.fifo[i].no_batch || "-"} / ${
                        r.fifo[i].tot_qty_kemasan || 0
                      } zak`
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
    <div className="alert-list">
      {rows.map((r: any, i: number) => (
        <div key={i} className="alert-card">
          <b>{r.type}</b>
          <div>
            {r.sku_rm} - {r.nama_rm}
          </div>
          <div>
            Batch: {r.batch} | Qty: {r.qty} | Nilai: {r.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function Kapasitas() {
  return <div>Menu kapasitas detail aktif setelah fetch tabel kapasitas.</div>;
}
