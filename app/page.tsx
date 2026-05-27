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

  const [stock, setStock] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const correctPin =
    process.env.NEXT_PUBLIC_PIN || "0000";

  useEffect(() => {

    if(unlocked){

      loadStock();
    }

  }, [unlocked]);

 async function loadStock(){

  const { data, error } = await supabase
    .from("stock_live")
    .select("*")
    .limit(10);

  if(error){
    alert("SUPABASE ERROR: " + error.message);
    console.log(error);
    return;
  }

  alert("DATA MASUK: " + (data?.length || 0));
  setStock(data || []);
}

  if(!unlocked){

    return (

      <main className={`screen ${dark ? "dark" : "light"}`}>

        <div className="login-card">

          <Lock size={40} />

          <h1>WMS GDRM</h1>

          <p>Masukkan PIN</p>

          <input
            type="password"
            value={pin}
            onChange={(e)=>setPin(e.target.value)}
            placeholder="••••"
          />

          <button
            onClick={()=>{

              if(pin === correctPin){

                setUnlocked(true);

              }else{

                alert("PIN salah");
              }
            }}
          >
            Masuk
          </button>

        </div>

      </main>
    );
  }

  const filtered = stock.filter((r)=>

    JSON.stringify(r)
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (

    <main className={`screen ${dark ? "dark" : "light"}`}>

      <div className="wrap">

        <header className="header">

          <div>

            <h1>WMS GDRM Dashboard</h1>

            <p>
              Stock Ready & FIFO
            </p>

          </div>

          <button
            className="icon-btn"
            onClick={()=>setDark(!dark)}
          >
            {dark ? <Sun /> : <Moon />}
          </button>

        </header>

        <section className="cards">

          <div className="card">

            <div className="card-title">
              Total Batch
            </div>

            <div className="card-value">
              {stock.length}
            </div>

          </div>

        </section>

        <section className="panel">

          <div className="search">

            <Search size={18} />

            <input
              placeholder="Search SKU RM, batch, lokasi..."
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
            />

          </div>

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

                {filtered.map((r:any)=>(

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

        </section>

      </div>

    </main>
  );
}
