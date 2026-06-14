"use client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
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
function getBonanTerkirimAuto(row: any, keluarList: any[]) {
  const tglBon = row.tanggal ? String(row.tanggal).slice(0, 10) : "";
  const plantBon = String(row.plant || "").trim();
  const skuBon = String(row.sku || "").trim();

  const rowsKeluar = keluarList.filter((k: any) => {
    const tglKeluar = k.tanggal ? String(k.tanggal).slice(0, 10) : "";
    const plantKeluar = String(k.plant_tujuan || "").trim();
    const skuKeluar = String(k.sku_rm || "").trim();

    return (
      tglKeluar === tglBon &&
      plantKeluar === plantBon &&
      skuKeluar === skuBon
    );
  });

  const pcs = rowsKeluar.reduce(
    (a: number, b: any) => a + Number(b.qty_kemasan || 0),
    0
  );

  const kg = rowsKeluar.reduce(
    (a: number, b: any) => a + Number(b.qty_kg_netto || 0),
    0
  );

  return {
    pcs,
    kg,
    rows: rowsKeluar,
  };
}

export default function Home() {
const [unlocked, setUnlocked] = useState(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("wms_auth") === "OK";

});
  const [dark, setDark] = useState(true);
  const [menu, setMenu] = useState("Stock Ready");
  const [alertFilter, setAlertFilter] = useState("ALL");
const [bonanStatusFilter, setBonanStatusFilter] = useState("ALL");
const [plant, setPlant] = useState("ALL");
const [search, setSearch] = useState("");

  const [masuk, setMasuk] = useState<any[]>([]);
  const [jalurVariant, setJalurVariant] = useState("ALL");
  const [jalurSku, setJalurSku] = useState("ALL");
  const [jalurMerk, setJalurMerk] = useState("ALL");
const [jalurBatch, setJalurBatch] = useState("");
const [jalurMinusOnly, setJalurMinusOnly] = useState(false);
const [jalurDetail, setJalurDetail] = useState<any | null>(null);
  
  const [stock, setStock] = useState<any[]>([]);
  const [service, setService] = useState<any[]>([]);
  const [bonan, setBonan] = useState<any[]>([]);
  const [keluar, setKeluar] = useState<any[]>([]);
const [sto, setSto] = useState<any[]>([]);
const [kapasitas, setKapasitas] = useState<any[]>([]);
const [hold, setHold] = useState<any[]>([]);

  
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateFilter, setDateFilter] = useState(todayStr);
  const [dateMode, setDateMode] = useState("ALL");

 useEffect(() => {
  if (unlocked) {
    localStorage.setItem("wms_auth", "OK");
    loadAll();
  }
}, [unlocked]);
  
async function fetchAllRows(tableName: string, batchSize = 1000) {
  let allRows: any[] = [];
  let from = 0;

  while (true) {
    const to = from + batchSize - 1;

    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .range(from, to);

    if (error) {
      console.error(`ERROR FETCH ${tableName}`, error);
      break;
    }

    const rows = data || [];

    allRows = allRows.concat(rows);

    if (rows.length < batchSize) {
      break;
    }

    from += batchSize;

    // pengaman supaya browser tidak hang kalau table terlalu besar
    if (from > 50000) {
      console.warn(`STOP FETCH ${tableName}: lebih dari 50000 row`);
      break;
    }
  }

  return allRows;
}

async function loadAll() {
  const [
    s,
    sl,
    b,
    k,
    st,
    kg,
    h,
    m,
  ] = await Promise.all([
    fetchAllRows("stock_live"),
    fetchAllRows("master_kedatangan"),
    fetchAllRows("bonan_ppic"),
    fetchAllRows("transaksi_keluar"),
    fetchAllRows("transaksi_sto"),
    fetchAllRows("kapasitas_gudang"),
    fetchAllRows("transaksi_hold"),
    fetchAllRows("transaksi_masuk"),
  ]);

  setStock(s);
  setService(sl);
  setBonan(b);
  setKeluar(k);
  setSto(st);
  setKapasitas(kg);
  setHold(h);
  setMasuk(m);
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

  
  const stockAlertBase = stock.filter((r: any) => {
  const okPlant =
    plant === "ALL" || String(r.plant) === plant;

  return okPlant;
});
  
  const alerts = useMemo(() => {
  const today = new Date();
  const a: any[] = [];

  // 1. LIFETIME & EXPIRED dari DATA_STOK_GDRM / stock_live
  stockAlertBase.forEach((r) => {
    const tanggalDatang = r.tanggal_kedatangan
      ? String(r.tanggal_kedatangan).slice(0, 10)
      : "";

    const tanggalExpired = r.tanggal_expired
      ? String(r.tanggal_expired).slice(0, 10)
      : "";

    if (r.tanggal_kedatangan) {
      const age = Math.floor(
        (today.getTime() - new Date(r.tanggal_kedatangan).getTime()) /
          86400000
      );

      if (age > 4) {
        a.push({
          type: "LIFETIME > 4 HARI",
          category: "AGING",
          rm: r.nama_rm,
          sku: r.sku_rm,
          merk: r.merk || "-",
          batch: r.no_batch,
          qty: r.tot_qty_kemasan,
          kg: r.tot_qty_kg,
          plant: r.plant,
          lokasi: r.lokasi_rm,
          tanggal_datang: tanggalDatang,
          tanggal_expired: tanggalExpired,
          value: age,
          value_label: `${age} hari`,
          note: r.note || "",
          status: "",
        });
      }
    }

    if (r.tanggal_expired) {
      const left = Math.floor(
        (new Date(r.tanggal_expired).getTime() - today.getTime()) /
          86400000
      );

      let expCategory = "";
      let expType = "";

      // OPSI A: EKSKLUSIF
      // 0-30 hari = EXP_30
      // 31-60 hari = EXP_60
      // 61-90 hari = EXP_90
      if (left >= 0 && left <= 30) {
        expCategory = "EXP_30";
        expType = "MENDEKATI EXPIRED <30 HARI";
      } else if (left >= 31 && left <= 60) {
        expCategory = "EXP_60";
        expType = "MENDEKATI EXPIRED <60 HARI";
      } else if (left >= 61 && left <= 90) {
        expCategory = "EXP_90";
        expType = "MENDEKATI EXPIRED <90 HARI";
      }

      if (expCategory) {
        a.push({
          type: expType,
          category: expCategory,
          rm: r.nama_rm,
          sku: r.sku_rm,
          merk: r.merk || "-",
          batch: r.no_batch,
          qty: r.tot_qty_kemasan,
          kg: r.tot_qty_kg,
          plant: r.plant,
          lokasi: r.lokasi_rm,
          tanggal_datang: tanggalDatang,
          tanggal_expired: tanggalExpired,
          value: left,
          value_label: `${left} hari lagi`,
          note: r.note || "",
          status: "",
        });
      }
    }
  });

  // 2. HOLD dari DATA_RM_GANTUNGAN+HOLD / transaksi_hold
  hold.forEach((r) => {
    const okPlant =
      plant === "ALL" ||
      String(r.plant) === plant ||
      String(r.plant_pemilik) === plant;

    if (!okPlant) return;

    const age = r.tanggal
      ? Math.floor(
          (today.getTime() - new Date(r.tanggal).getTime()) / 86400000
        )
      : 0;

    a.push({
      type: "HOLD / GANTUNGAN",
      category: "HOLD",
      rm: r.nama_rm,
      sku: r.sku_rm,
      merk: "-",
      batch: "-",
      qty: r.qty_kemasan,
      kg: r.qty_kg,
      plant: r.plant,
      lokasi: "-",
      tanggal_datang: r.tanggal ? String(r.tanggal).slice(0, 10) : "",
      tanggal_expired: "",
      value: age,
      value_label: `${age} hari`,
      note: r.note,
      status: r.status,
    });
  });

  const unique = new Map();

  a.forEach((x) => {
    const key = [
      x.category,
      x.plant,
      x.sku,
      x.merk,
      x.batch,
      x.qty,
      x.kg,
      x.value,
      x.note || "",
      x.status || "",
    ].join("_");

    unique.set(key, x);
  });

  return Array.from(unique.values());
}, [stockAlertBase, hold, plant]);

  
  const stockView     = stockFiltered.filter(matchSearch);
  const fifoView      = fifo.filter(matchSearch);
  const alertView = alerts
  .filter(matchSearch)
  .filter((r: any) => alertFilter === "ALL" || r.category === alertFilter);
  const serviceView = service
  .filter((r) => {
    const okPlant =
      plant === "ALL" || String(r.plant) === plant;

    const rowDate = r.tanggal_kedatangan
      ? String(r.tanggal_kedatangan).slice(0, 10)
      : "";

    const okDate =
      dateMode === "ALL" || !dateFilter || rowDate === dateFilter;

    return okPlant && okDate;
  })
  .filter(matchSearch);
  const bonanView = bonan
  .filter((r: any) => {
    const okPlant =
      plant === "ALL" || String(r.plant) === plant;

    const rowDate = r.tanggal
      ? String(r.tanggal).slice(0, 10)
      : "";

    const okDate =
      dateMode === "ALL" || !dateFilter || rowDate === dateFilter;

    return okPlant && okDate;
  })
  .filter((r: any) => {
    if (bonanStatusFilter === "ALL") return true;

    const bonPcs = Number(r.qty_bon_zak || 0);
    const terkirim = getBonanTerkirimAuto(r, keluar);
    const kirimPcs = Number(terkirim.pcs || 0);

    const selesai = bonPcs > 0 && kirimPcs >= bonPcs;

    if (bonanStatusFilter === "SELESAI") return selesai;
    if (bonanStatusFilter === "BELUM") return !selesai;

    return true;
  })
  .filter(matchSearch);
  
  const kapasitasView = kapasitas.filter(matchSearch);

 function getSkuVariant(row: any) {
  const skuQr = String(row.sku_qr || "");
  const parts = skuQr.split("x");

  if (parts.length >= 4) {
    return parts.slice(3).join("x") || "TANPA VARIAN";
  }

  return "TANPA VARIAN";
}

function getJalurMerk(row: any) {
  const merkSheet = String(row.merk || "").trim();

  if (merkSheet && merkSheet !== "-") {
    return merkSheet;
  }

  const suffix = getSkuVariant(row);

  if (suffix && suffix !== "TANPA VARIAN") {
    return suffix;
  }

  return "-";
}

function dateKey_(v: any) {
  if (!v) return "TANPA TANGGAL";
  return String(v).slice(0, 10);
}

function cleanPlant(v: any) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, "");
}

function cleanSkuQr(v: any) {
  return String(v || "")
    .trim()
    .replace(/\s+/g, "");
}

function jalurKey(plantValue: any, skuQr: any) {
  return `${cleanPlant(plantValue)}|${cleanSkuQr(skuQr)}`;
}

function findMasukBySkuQr(skuQr: any) {
  const key = String(skuQr || "").trim();

  return masuk.find(
    (r: any) => String(r.sku_qr || "").trim() === key
  );
}

  
const jalurMasterRows = [
  ...masuk,
  ...sto.map((s: any) => {
    const asal: any = findMasukBySkuQr(s.sku_qr) || {};

    return {
      ...asal,
      plant: s.plant_tujuan,
      sku_qr: String(s.sku_qr || "").trim(),
      tanggal_kedatangan: s.tanggal,
      qty_kemasan: Number(s.qty_zakkemasan || 0),
      qty_kg: Number(s.qty_kg || 0),
      sumber_jalur: "STO_IN",
    };
  }),
];

const jalurSkuMap = new Map<string, any>();

jalurMasterRows
  .filter((r: any) => plant === "ALL" || String(r.plant) === plant)
  .forEach((r: any) => {
    const sku = String(r.sku_rm || "");

    if (!sku) return;

    if (!jalurSkuMap.has(sku)) {
      jalurSkuMap.set(sku, {
        sku_rm: sku,
        nama_rm: String(r.nama_rm || ""),
      });
    }
  });

const jalurSkuOptions = Array.from(jalurSkuMap.values()).sort((a: any, b: any) =>
  String(a.nama_rm || "").localeCompare(String(b.nama_rm || ""))
);

const jalurMerkOptions = Array.from(
  new Set(
    jalurMasterRows
  .filter((r: any) => {
        const okPlant = plant === "ALL" || String(r.plant) === plant;
        const okSku = jalurSku === "ALL" || String(r.sku_rm || "") === jalurSku;

        return okPlant && okSku;
      })
      .map((r: any) => getJalurMerk(r))
      .filter((m: string) => m && m !== "-")
  )
).sort();

const jalurVariants = jalurMerkOptions;

const stokJalurView = useMemo(() => {
  const movementByKey: any = {};

  function pushMovement(key: string, d: any) {
    if (!key) return;

    if (!movementByKey[key]) {
      movementByKey[key] = [];
    }

    movementByKey[key].push(d);
  }

  function passFilter(r: any) {
    const okPlant =
      plant === "ALL" || String(r.plant) === plant;

    const rowDate = r.tanggal_kedatangan
      ? String(r.tanggal_kedatangan).slice(0, 10)
      : "";

    const okDate =
      dateMode === "ALL" || !dateFilter || rowDate === dateFilter;

    const okSku =
      jalurSku === "ALL" || String(r.sku_rm || "") === jalurSku;

    const merk = getJalurMerk(r);

    const okMerk =
      jalurMerk === "ALL" || merk === jalurMerk;

    const okBatch =
      !jalurBatch ||
      String(r.no_batch || "")
        .toLowerCase()
        .includes(jalurBatch.toLowerCase());

    return okPlant && okDate && okSku && okMerk && okBatch;
  }

 // DATA_RM_KELUAR = mengurangi plant pemilik / plant_tujuan + sku_qr
keluar.forEach((r: any) => {
  const skuQr = cleanSkuQr(r.sku_qr);
  const plantOwner = cleanPlant(r.plant_tujuan);

  if (!skuQr || !plantOwner) return;

  const key = jalurKey(plantOwner, skuQr);

  pushMovement(key, {
    jenis: "KELUAR",
    key_debug: key,
    sku_qr: skuQr,
    tanggal: r.tanggal,
    jam: r.jam || "00:00:00",
    plant_tujuan: plantOwner,
    no_palet: r.no_palet,
    qty_kemasan: Number(r.qty_kemasan || 0),
    qty_kg: Number(r.qty_kg || 0),
  });
});

 // DATA_STO = mengurangi plant asal + sku_qr
sto.forEach((r: any) => {
  const skuQr = cleanSkuQr(r.sku_qr);
  const plantAsal = cleanPlant(r.plant_asal);
  const plantTujuan = cleanPlant(r.plant_tujuan);

  if (!skuQr || !plantAsal) return;

  const key = jalurKey(plantAsal, skuQr);

  pushMovement(key, {
    jenis: "STO OUT",
    key_debug: key,
    sku_qr: skuQr,
    tanggal: r.tanggal,
    jam: "00:00:00",
    plant_tujuan: plantTujuan,
    no_palet: "STO",
    qty_kemasan: Number(r.qty_zakkemasan || 0),
    qty_kg: Number(r.qty_kg || 0),
  });
});

  const group: any = {};

  function ensureGroup(key: string, r: any) {
    if (!group[key]) {
      group[key] = {
        key,
        sku_qr: String(r.sku_qr || "").trim(),
        plant: r.plant,
        sku_rm: r.sku_rm,
        nama_rm: r.nama_rm,
        merk: getJalurMerk(r),
        no_batch: r.no_batch || "-",
        tanggal_kedatangan: r.tanggal_kedatangan,
        tanggal_expired: r.tanggal_expired,
        lokasi_rm: r.lokasi_rm || "-",
        masuk_pcs: 0,
        masuk_kg: 0,
        keluar_pcs: 0,
        keluar_kg: 0,
        sisa_pcs: 0,
        sisa_kg: 0,
        daily: {},
      };
    }
  }

  // DATA_RM_MASUK = satu-satunya stock awal
  masuk.forEach((r: any) => {
  const skuQr = cleanSkuQr(r.sku_qr);

  if (!skuQr) return;

  const row = {
    ...r,
    plant: cleanPlant(r.plant),
    sku_qr: skuQr,
  };

  if (!passFilter(row)) return;

  const key = jalurKey(row.plant, skuQr);

    ensureGroup(key, row);

    group[key].masuk_pcs += Number(row.qty_kemasan || 0);
    group[key].masuk_kg += Number(row.qty_kg || 0);
  });

  // Hitung running stock per plant + sku_qr
  Object.values(group).forEach((item: any) => {
    const details = [...(movementByKey[item.key] || [])].sort(
      (a: any, b: any) => {
        const da = new Date(`${a.tanggal || ""} ${a.jam || ""}`).getTime();
        const db = new Date(`${b.tanggal || ""} ${b.jam || ""}`).getTime();

        return da - db;
      }
    );

    let runningPcs = Number(item.masuk_pcs || 0);
    let runningKg = Number(item.masuk_kg || 0);

    details.forEach((d: any) => {
      runningPcs -= Number(d.qty_kemasan || 0);
      runningKg -= Number(d.qty_kg || 0);

      const day = dateKey_(d.tanggal);

      if (!item.daily[day]) {
        item.daily[day] = {
          date: day,
          keluar_pcs: 0,
          keluar_kg: 0,
          sisa_pcs: runningPcs,
          sisa_kg: runningKg,
          details: [],
        };
      }

      item.daily[day].keluar_pcs += Number(d.qty_kemasan || 0);
      item.daily[day].keluar_kg += Number(d.qty_kg || 0);
      item.daily[day].sisa_pcs = runningPcs;
      item.daily[day].sisa_kg = runningKg;

      item.daily[day].details.push({
        ...d,
        sisa_after_pcs: runningPcs,
        sisa_after_kg: runningKg,
      });
    });

    item.keluar_pcs = Number(item.masuk_pcs || 0) - runningPcs;
    item.keluar_kg = Number(item.masuk_kg || 0) - runningKg;
    item.sisa_pcs = runningPcs;
    item.sisa_kg = runningKg;
  });

  return Object.values(group)
  .filter((r: any) => !jalurMinusOnly || Number(r.sisa_pcs || 0) < 0)
  .filter(matchSearch);
}, [
  masuk,
  keluar,
  sto,
  plant,
  dateMode,
  dateFilter,
  jalurSku,
  jalurMerk,
  jalurBatch,
jalurMinusOnly,
search,
]);

const jalurDates = useMemo(() => {
  return Array.from(
    new Set(
      stokJalurView.flatMap((r: any) =>
        Object.keys(r.daily || {})
      )
    )
  ).sort();
}, [stokJalurView]);
  
  function getCurrentData() {
    if (menu === "Stock Ready")   return stockView;
    if (menu === "FIFO Matrix")   return fifoView;
    if (menu === "Alert Center")  return alertView;
    if (menu === "Service Level") return serviceView;
    if (menu === "Bonan PPIC")    return bonanView;
    if (menu === "Kapasitas")     return kapasitasView;
    if (menu === "Stok Jalur")    return stokJalurView;
    return [];
  }

  function safeSheetName(name: any, used: Set<string>) {
  let base = String(name || "SHEET")
    .replace(/[\\/?*[\]:]/g, "")
    .slice(0, 28);

  if (!base) base = "SHEET";

  let finalName = base;
  let i = 2;

  while (used.has(finalName)) {
    finalName = `${base.slice(0, 25)}_${i}`;
    i++;
  }

  used.add(finalName);
  return finalName;
}

function makeDateKey(v: any) {
  if (!v) return "TANPA TANGGAL";
  return String(v).slice(0, 10);
}

function getMerkJalur(row: any) {
  const merk = String(row.merk || "").trim();

  if (merk && merk !== "-") return merk;

  const skuQr = String(row.sku_qr || "");
  const parts = skuQr.split("x");

  if (parts.length >= 4) {
    return parts.slice(3).join("x") || "-";
  }

  return "-";
}

function buildJalurBySku(skuRm: any) {
  const sku = String(skuRm || "");

  const masukRows = masuk.filter(
    (r: any) => String(r.sku_rm || "") === sku
  );

  const keluarBySkuQr: any = {};

  keluar.forEach((r: any) => {
  const key = String(r.sku_qr || "").trim();

  if (!key) return;

  const okPlantKeluar =
    plant === "ALL" || String(r.plant_tujuan || "") === plant;

  if (!okPlantKeluar) return;

  if (!keluarBySkuQr[key]) {
    keluarBySkuQr[key] = [];
  }

  keluarBySkuQr[key].push({
    tanggal: r.tanggal,
    jam: r.jam,
    plant_tujuan: r.plant_tujuan,
    no_palet: r.no_palet,
    qty_kemasan: Number(r.qty_kemasan || 0),
    qty_kg: Number(r.qty_kg || 0),
  });
});

  const group: any = {};

  masukRows.forEach((r: any) => {
    const key = String(r.sku_qr || "").trim();

    if (!key) return;

    if (!group[key]) {
      group[key] = {
        plant: r.plant,
        sku_rm: r.sku_rm,
        nama_rm: r.nama_rm,
        merk: getMerkJalur(r),
        no_batch: r.no_batch || "-",
        sku_qr: key,
        lokasi_rm: r.lokasi_rm || "-",
        masuk_pcs: 0,
        masuk_kg: 0,
        keluar_pcs: 0,
        keluar_kg: 0,
        sisa_pcs: 0,
        sisa_kg: 0,
        daily: {},
      };
    }

    group[key].masuk_pcs += Number(r.qty_kemasan || 0);
    group[key].masuk_kg += Number(r.qty_kg || 0);
  });

  Object.values(group).forEach((item: any) => {
    const details = [...(keluarBySkuQr[item.sku_qr] || [])].sort(
      (a: any, b: any) => {
        const da = new Date(`${a.tanggal || ""} ${a.jam || ""}`).getTime();
        const db = new Date(`${b.tanggal || ""} ${b.jam || ""}`).getTime();

        return da - db;
      }
    );

    let runningPcs = Number(item.masuk_pcs || 0);
    let runningKg = Number(item.masuk_kg || 0);

    details.forEach((d: any) => {
      runningPcs -= Number(d.qty_kemasan || 0);
      runningKg -= Number(d.qty_kg || 0);

      const day = makeDateKey(d.tanggal);

      if (!item.daily[day]) {
        item.daily[day] = {
          date: day,
          keluar_pcs: 0,
          keluar_kg: 0,
          sisa_pcs: runningPcs,
          sisa_kg: runningKg,
          details: [],
        };
      }

      item.daily[day].keluar_pcs += Number(d.qty_kemasan || 0);
      item.daily[day].keluar_kg += Number(d.qty_kg || 0);
      item.daily[day].sisa_pcs = runningPcs;
      item.daily[day].sisa_kg = runningKg;

      item.daily[day].details.push({
        ...d,
        sisa_after_pcs: runningPcs,
        sisa_after_kg: runningKg,
      });
    });

    item.keluar_pcs = Number(item.masuk_pcs || 0) - runningPcs;
    item.keluar_kg = Number(item.masuk_kg || 0) - runningKg;
    item.sisa_pcs = runningPcs;
    item.sisa_kg = runningKg;
  });

  return Object.values(group);
}

function downloadBonanExcelPerPlant() {
  const sourceBonan =
    plant === "ALL"
      ? bonanView
      : bonanView.filter((r: any) => String(r.plant) === plant);

  if (!sourceBonan.length) {
    alert("Data Bonan PPIC kosong untuk plant/filter ini.");
    return;
  }

  const plants =
    plant === "ALL"
      ? Array.from(new Set(sourceBonan.map((r: any) => String(r.plant || "NO_PLANT"))))
      : [plant];

  plants.forEach((plantCode: any) => {
    const rowsPlant = sourceBonan.filter(
      (r: any) => String(r.plant || "NO_PLANT") === String(plantCode)
    );

    if (!rowsPlant.length) return;

    const wb = XLSX.utils.book_new();
    const usedSheetNames = new Set<string>();

    const skuMap = new Map<string, any>();

    rowsPlant.forEach((r: any) => {
      const sku = String(r.sku || "").trim();

      if (!sku) return;

      if (!skuMap.has(sku)) {
        skuMap.set(sku, {
          sku,
          nama_rm: r.nama_rm || "",
          plant: r.plant || "",
          bon_pcs: 0,
          bon_kg: 0,
          terkirim_pcs: 0,
          terkirim_kg: 0,
          note: "",
        });
      }

      const item = skuMap.get(sku);

      item.bon_pcs += Number(r.qty_bon_zak || 0);
      item.bon_kg += Number(r.qty_bon_kg || 0);
      const terkirim = getBonanTerkirimAuto(r, keluar);
item.terkirim_pcs += Number(terkirim.pcs || 0);
item.terkirim_kg += Number(terkirim.kg || 0);

      if (r.note) item.note = r.note;
    });

    const summary: any[][] = [
      [
        "Plant",
        "SKU RM",
        "Nama RM",
        "Bon PCS",
        "Bon KG",
        "Terkirim PCS",
        "Terkirim KG",
        "Stock Akhir PCS",
        "Stock Akhir KG",
        "Kurang PCS",
        "Kurang KG",
        "Status",
        "Note",
      ],
    ];

    skuMap.forEach((item: any) => {
      const jalurRows = buildJalurBySku(item.sku);

      const stockAkhirPcs: number = Number(
  jalurRows.reduce(
    (a: number, b: any) => a + Number(b.sisa_pcs || 0),
    0
  )
);

const stockAkhirKg: number = Number(
  jalurRows.reduce(
    (a: number, b: any) => a + Number(b.sisa_kg || 0),
    0
  )
);

const kurangPcs: number =
  Number(item.bon_pcs || 0) - Number(stockAkhirPcs || 0);

const kurangKg: number =
  Number(item.bon_kg || 0) - Number(stockAkhirKg || 0);

      const status =
        !jalurRows.length
          ? "TIDAK ADA STOK JALUR"
          : kurangPcs > 0 || kurangKg > 0
          ? "KURANG"
          : "AMAN";

      summary.push([
        plantCode,
        item.sku,
        item.nama_rm,
        item.bon_pcs,
        item.bon_kg,
        item.terkirim_pcs,
        item.terkirim_kg,
        stockAkhirPcs,
        stockAkhirKg,
        kurangPcs,
        kurangKg,
        status,
        item.note || "",
      ]);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summary);
    wsSummary["!cols"] = [
      { wch: 10 },
      { wch: 16 },
      { wch: 34 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
      { wch: 20 },
      { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(
      wb,
      wsSummary,
      safeSheetName("SUMMARY", usedSheetNames)
    );

    skuMap.forEach((item: any) => {
      const aoa: any[][] = [];

      aoa.push(["PLANT", plantCode]);
      aoa.push(["SKU RM", item.sku]);
      aoa.push(["NAMA RM", item.nama_rm]);
      aoa.push(["BON PCS", item.bon_pcs]);
      aoa.push(["BON KG", item.bon_kg]);
      aoa.push(["TERKIRIM PCS", item.terkirim_pcs]);
      aoa.push(["TERKIRIM KG", item.terkirim_kg]);
      aoa.push([]);

      const jalurRows = buildJalurBySku(item.sku);

      if (!jalurRows.length) {
        aoa.push(["TIDAK ADA STOK JALUR UNTUK SKU INI"]);
      }

      jalurRows.forEach((j: any, idx: number) => {
        aoa.push([`JALUR ${idx + 1}`]);
        aoa.push(["Plant", j.plant]);
        aoa.push(["Merk / Varian", j.merk]);
        aoa.push(["Batch", j.no_batch]);
        aoa.push(["SKU QR", j.sku_qr]);
        aoa.push(["Lokasi", j.lokasi_rm]);
        aoa.push(["Stock Awal PCS", j.masuk_pcs]);
        aoa.push(["Stock Awal KG", j.masuk_kg]);
        aoa.push(["Stock Akhir PCS", j.sisa_pcs]);
        aoa.push(["Stock Akhir KG", j.sisa_kg]);
        aoa.push([]);

        aoa.push([
          "Tanggal",
          "Keluar PCS",
          "Keluar KG",
          "Sisa PCS",
          "Sisa KG",
        ]);

        const days = Object.values(j.daily || {}).sort((a: any, b: any) =>
          String(a.date).localeCompare(String(b.date))
        );

        if (!days.length) {
          aoa.push(["Belum ada pengeluaran", 0, 0, j.sisa_pcs, j.sisa_kg]);
        } else {
          days.forEach((d: any) => {
            aoa.push([
              d.date,
              d.keluar_pcs,
              d.keluar_kg,
              d.sisa_pcs,
              d.sisa_kg,
            ]);
          });
        }

        aoa.push([]);
        aoa.push(["DETAIL TIMELINE"]);
        aoa.push([
          "Tanggal",
          "Jam",
          "Tujuan",
          "No Palet",
          "Qty PCS",
          "Qty KG",
          "Sisa Setelah PCS",
          "Sisa Setelah KG",
        ]);

        days.forEach((d: any) => {
          d.details.forEach((x: any) => {
            aoa.push([
              x.tanggal || "",
              x.jam || "",
              x.plant_tujuan || "",
              x.no_palet || "",
              x.qty_kemasan || 0,
              x.qty_kg || 0,
              x.sisa_after_pcs || 0,
              x.sisa_after_kg || 0,
            ]);
          });
        });

        aoa.push([]);
        aoa.push([]);
      });

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      ws["!cols"] = [
        { wch: 18 },
        { wch: 26 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
      ];

      XLSX.utils.book_append_sheet(
        wb,
        ws,
        safeSheetName(item.sku, usedSheetNames)
      );
    });

    const dateName = new Date().toISOString().slice(0, 10);

    XLSX.writeFile(
      wb,
      `BONAN_PPIC_${plantCode}_${dateName}.xlsx`
    );
  });
}

function downloadStokJalurExcel() {
  if (!stokJalurView.length) {
    alert("Data Stok Jalur kosong.");
    return;
  }

  const wb = XLSX.utils.book_new();

  const rows: any[][] = [
    [
      "Plant",
      "SKU RM",
      "Nama RM",
      "Merk",
      "Batch",
      "SKU QR",
      "Lokasi",
      "Stock Awal PCS",
      "Stock Awal KG",
      "Stock Akhir PCS",
      "Stock Akhir KG",
      "Detail Jalur"
    ],
  ];

  stokJalurView.forEach((r: any) => {
    const days = Object.values(r.daily || {}).sort((a: any, b: any) =>
      String(a.date).localeCompare(String(b.date))
    );

    const detail = days.length
      ? days
          .map((day: any) =>
            [
              `${day.date}`,
              `Keluar: ${fmt0(day.keluar_pcs)} pcs | ${fmt2(day.keluar_kg)} kg`,
              `Sisa: ${fmt0(day.sisa_pcs)} pcs | ${fmt2(day.sisa_kg)} kg`
            ].join("\n")
          )
          .join("\n\n")
      : "Belum ada keluar";

    rows.push([
      r.plant,
      r.sku_rm,
      r.nama_rm,
      r.merk,
      r.no_batch,
      r.sku_qr,
      r.lokasi_rm,
      Number(r.masuk_pcs || 0),
      Number(r.masuk_kg || 0),
      Number(r.sisa_pcs || 0),
      Number(r.sisa_kg || 0),
      detail
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws["!cols"] = [
    { wch: 10 },
    { wch: 16 },
    { wch: 34 },
    { wch: 24 },
    { wch: 16 },
    { wch: 45 },
    { wch: 12 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 45 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "STOK_JALUR");

  const plantName = plant === "ALL" ? "ALL_PLANT" : plant;
  const dateName = new Date().toISOString().slice(0, 10);

  XLSX.writeFile(wb, `STOK_JALUR_${plantName}_${dateName}.xlsx`);
}
  
function downloadCurrentDataPDF() {
  let title = menu;
  let head: string[] = [];
  let body: any[][] = [];

  if (menu === "FIFO Matrix") {
    head = ["SKU RM", "Nama RM", "FIFO 1", "FIFO 2", "FIFO 3"];

    body = fifoView.map((r: any) => {
      const fifoText = (idx: number) => {
        const f = r.fifo?.[idx];

        if (!f) return "-";

        return [
          `Batch: ${f.no_batch || "-"}`,
          `Qty: ${fmt0(f.tot_qty_kemasan)} zak`,
          `KG: ${fmt2(f.tot_qty_kg)}`,
          `Datang: ${f.tanggal_kedatangan || "-"}`
        ].join("\n");
      };

      return [
        r.sku_rm || "-",
        r.nama_rm || "-",
        fifoText(0),
        fifoText(1),
        fifoText(2)
      ];
    });
  } else if (menu === "Stock Ready") {
    head = ["Plant", "SKU QR", "SKU RM", "Nama RM", "Batch", "Qty", "KG", "Lokasi"];

    body = stockView.map((r: any) => [
      r.plant,
      r.sku_qr,
      r.sku_rm,
      r.nama_rm,
      r.no_batch,
      fmt0(r.tot_qty_kemasan),
      fmt2(r.tot_qty_kg),
      r.lokasi_rm
    ]);
  } else if (menu === "Alert Center") {
  head = [
    "Kategori",
    "Plant",
    "SKU",
    "Nama RM",
    "Merk",
    "Batch",
    "Datang",
    "Expired",
    "Hari",
    "Qty PCS",
    "Qty KG",
    "Lokasi",
    "Note / Status"
  ];

  body = alertView.map((r: any) => [
    r.type,
    r.plant,
    r.sku,
    r.rm,
    r.merk || "-",
    r.batch,
    r.tanggal_datang || "-",
    r.tanggal_expired || "-",
    r.value_label || `${r.value} hari`,
    fmt0(r.qty),
    fmt2(r.kg),
    r.lokasi || "-",
    r.note || r.status || ""
  ]);
    } else if (menu === "Stok Jalur") {
  head = [
    "Plant",
    "SKU RM",
    "Nama RM",
    "Merk",
    "Batch",
    "SKU QR",
    "Stock Awal",
    "Stock Akhir",
    "Detail Jalur"
  ];

  body = stokJalurView.map((r: any) => {
    const days = Object.values(r.daily || {}).sort((a: any, b: any) =>
      String(a.date).localeCompare(String(b.date))
    );

    const detail = days.length
      ? days
          .map((day: any) =>
            [
              `${day.date}`,
              `Keluar: ${fmt0(day.keluar_pcs)} pcs | ${fmt2(day.keluar_kg)} kg`,
              `Sisa: ${fmt0(day.sisa_pcs)} pcs | ${fmt2(day.sisa_kg)} kg`
            ].join("\n")
          )
          .join("\n\n")
      : "Belum ada keluar";

    return [
      r.plant,
      r.sku_rm,
      r.nama_rm,
      r.merk,
      r.no_batch,
      r.sku_qr,
      `${fmt0(r.masuk_pcs)} pcs\n${fmt2(r.masuk_kg)} kg`,
      `${fmt0(r.sisa_pcs)} pcs\n${fmt2(r.sisa_kg)} kg`,
      detail
    ];
  });
    
  } else if (menu === "Bonan PPIC") {
    head = [
      "Tanggal",
      "Plant",
      "SKU",
      "Nama RM",
      "Bon PCS",
      "Bon KG",
      "Terkirim PCS",
      "Terkirim KG",
      "% PCS",
      "% KG",
      "Kurang PCS",
      "Kurang KG",
      "Note"
    ];

    body = bonanView.map((r: any) => {
      const bonPcs = Number(r.qty_bon_zak || 0);
      const bonKg = Number(r.qty_bon_kg || 0);
      const terkirim = getBonanTerkirimAuto(r, keluar);

const kirimPcs = Number(terkirim.pcs || 0);
const kirimKg = Number(terkirim.kg || 0);

      const persenPcs = bonPcs ? (kirimPcs / bonPcs) * 100 : 0;
      const persenKg = bonKg ? (kirimKg / bonKg) * 100 : 0;

      return [
        r.tanggal,
        r.plant,
        r.sku,
        r.nama_rm,
        fmt0(bonPcs),
        fmt2(bonKg),
        fmt0(kirimPcs),
        fmt2(kirimKg),
        `${fmt2(persenPcs)}%`,
        `${fmt2(persenKg)}%`,
        fmt0(bonPcs - kirimPcs),
        fmt2(bonKg - kirimKg),
        r.note || ""
      ];
    });
  } else {
    const data = getCurrentData();

    if (!data.length) {
      alert("Tidak ada data untuk PDF");
      return;
    }

    head = Object.keys(data[0]);
    body = data.map((row: any) => head.map((k) => row[k] ?? ""));
  }

  if (!body.length) {
    alert("Tidak ada data untuk PDF");
    return;
  }

  const pdf = new jsPDF("landscape", "mm", "a4");

  pdf.setFontSize(14);
  pdf.text(`WMS GDRM - ${title}`, 14, 12);

  pdf.setFontSize(9);
  pdf.text(`Plant: ${plant} | Mode: ${dateMode} | Tanggal: ${dateFilter}`, 14, 18);

  autoTable(pdf, {
    head: [head],
    body,
    startY: 24,
    styles: {
  fontSize: menu === "Stok Jalur" ? 6 : 7,
  cellPadding: menu === "Stok Jalur" ? 1.5 : 1.8,
  overflow: "linebreak",
  valign: "top",
},
    headStyles: {
      fillColor: [17, 24, 39],
      textColor: [255, 255, 255]
    },
    margin: {
      top: 24,
      left: 8,
      right: 8
    }
  });

  pdf.save(`WMS_GDRM_${menu}.pdf`);
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
  <span className="topbar-logo">⬡ GDRM LEVEL UP</span>
  <div className="topbar-sep" />

  <div className="plant-group">
    {["ALL", "1111", "1112", "1113"].map((p) => (
      <button
        key={p}
        className={`plant-btn${plant === p ? " active" : ""}`}
        onClick={() => setPlant(p)}
      >
        {p}
      </button>
    ))}
  </div>

  <div className="topbar-right">
    <span className="top-date">{nowLabel}</span>

    <div className="search-box">
      <Search size={14} />
      <input
        placeholder="Cari semua data..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </div>

    <button className="icon-round" onClick={loadAll} title="Refresh">
      <RefreshCcw size={16} />
    </button>

    <button
      className="icon-round"
      onClick={() => setDark(!dark)}
      title="Toggle Tema"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>

    <button className="icon-round" onClick={logout} title="Logout">
      <LogOut size={16} />
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
  <MetricCard
    label={menu === "Stok Jalur" ? "Jalur Aktif" : "Batch Ready"}
    value={fmt0(menu === "Stok Jalur" ? stokJalurView.length : stockView.length)}
    color="gold"
  />

  <MetricCard
    label={menu === "Stok Jalur" ? "Stock Awal PCS" : "Total Kemasan"}
    value={fmt0(
      menu === "Stok Jalur"
        ? stokJalurView.reduce((a: number, b: any) => a + Number(b.masuk_pcs || 0), 0)
        : stockView.reduce((a: number, b: any) => a + Number(b.tot_qty_kemasan || 0), 0)
    )}
    color="blue"
  />

  <MetricCard
    label={menu === "Stok Jalur" ? "Stock Awal KG" : "Total KG"}
    value={fmt2(
      menu === "Stok Jalur"
        ? stokJalurView.reduce((a: number, b: any) => a + Number(b.masuk_kg || 0), 0)
        : stockView.reduce((a: number, b: any) => a + Number(b.tot_qty_kg || 0), 0)
    )}
    color="green"
  />

  <MetricCard
    label={menu === "Stok Jalur" ? "Stock Akhir PCS" : "Alert Aktif"}
    value={fmt0(
      menu === "Stok Jalur"
        ? stokJalurView.reduce((a: number, b: any) => a + Number(b.sisa_pcs || 0), 0)
        : alertView.length
    )}
    color="red"
  />
</div>
        {/* Panel */}
        <div className="panel">
          {/* Panel header */}
          <div className="panel-header">
            <span className="panel-title">{menu}</span>
           <span className="panel-count">
  {getCurrentData().length} baris
  {menu === "Stok Jalur" && (
    <>
      {" "} | masuk: {masuk.length}
{" "} | keluar: {keluar.length}
{" "} | sto: {sto.length}
{" "} | jalur: {stokJalurView.length}
    </>
  )}
</span>

            <div className="date-filter">
              <button className={`date-btn${dateMode === "TODAY" ? " active" : ""}`} onClick={() => { setDateMode("TODAY"); setDateFilter(todayStr); }}>Today</button>
              <button className={`date-btn${dateMode === "ALL" ? " active" : ""}`}   onClick={() => setDateMode("ALL")}>All</button>
              <input type="date" className="date-inp" value={dateFilter} onChange={(e) => { setDateMode("TODAY"); setDateFilter(e.target.value); }} />
            </div>

            <div style={{ flex: 1 }} />

            <div className="panel-actions">
  {menu === "Stok Jalur" && (
    <button
      className="action-btn primary"
      onClick={downloadStokJalurExcel}
    >
      <FileDown size={14} />
      Excel
    </button>
  )}

  {menu === "Bonan PPIC" && (
    <button
      className="action-btn primary"
      onClick={downloadBonanExcelPerPlant}
    >
      <FileDown size={14} />
      Excel Plant
    </button>
  )}

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
           {menu === "Alert Center" && (
  <AlertView
    rows={alertView}
    allRows={alerts.filter(matchSearch)}
    alertFilter={alertFilter}
    setAlertFilter={setAlertFilter}
  />
)}
            {menu === "Kapasitas"     && <KapasitasTable rows={kapasitasView} stock={stockView} />}
            {menu === "Service Level" && <ServiceTable rows={serviceView} />}
            {menu === "Bonan PPIC" && (
  <BonanTable
    rows={bonanView}
    keluar={keluar}
    bonanStatusFilter={bonanStatusFilter}
    setBonanStatusFilter={setBonanStatusFilter}
  />
)}
            {menu === "Stok Jalur" && (
  <StokJalurTable
  rows={stokJalurView}
  dates={jalurDates}
  jalurSku={jalurSku}
  setJalurSku={setJalurSku}
  jalurMerk={jalurMerk}
  setJalurMerk={setJalurMerk}
  jalurBatch={jalurBatch}
  setJalurBatch={setJalurBatch}
  jalurMinusOnly={jalurMinusOnly}
  setJalurMinusOnly={setJalurMinusOnly}
  skuOptions={jalurSkuOptions}
  merkOptions={jalurMerkOptions}
  jalurDetail={jalurDetail}
  setJalurDetail={setJalurDetail}
/>
)}
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
    <Tbl heads={["Plant","SKU RM","Nama RM","Batch","Qty Kemasan","Total KG","Lokasi"]}>
      {rows.map((r: any, i: number) => (
        <tr key={i}>
          <td><Badge text={r.plant} variant="blue" /></td>
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

function AlertView({ rows, allRows, alertFilter, setAlertFilter }: any) {
  const hold = allRows.filter((r: any) => r.category === "HOLD");
  const aging = allRows.filter((r: any) => r.category === "AGING");
  const exp30 = allRows.filter((r: any) => r.category === "EXP_30");
  const exp60 = allRows.filter((r: any) => r.category === "EXP_60");
  const exp90 = allRows.filter((r: any) => r.category === "EXP_90");

  function toggle(cat: string) {
    setAlertFilter(alertFilter === cat ? "ALL" : cat);
  }

  function catLabel(cat: string) {
    if (cat === "HOLD") return "HOLD";
    if (cat === "AGING") return "LIFETIME >4";
    if (cat === "EXP_30") return "EXP <30";
    if (cat === "EXP_60") return "EXP <60";
    if (cat === "EXP_90") return "EXP <90";
    return cat;
  }

  return (
    <div className="alert-table-wrap">
      <div className="alert-summary alert-summary-5">
        <button
          className={`alert-stat hold-stat ${alertFilter === "HOLD" ? "active" : ""}`}
          onClick={() => toggle("HOLD")}
        >
          <span>{hold.length}</span>HOLD
        </button>

        <button
          className={`alert-stat aging-stat ${alertFilter === "AGING" ? "active" : ""}`}
          onClick={() => toggle("AGING")}
        >
          <span>{aging.length}</span>Lifetime &gt;4 Hari
        </button>

        <button
          className={`alert-stat exp30-stat ${alertFilter === "EXP_30" ? "active" : ""}`}
          onClick={() => toggle("EXP_30")}
        >
          <span>{exp30.length}</span>Expired &lt;30 Hari
        </button>

        <button
          className={`alert-stat exp60-stat ${alertFilter === "EXP_60" ? "active" : ""}`}
          onClick={() => toggle("EXP_60")}
        >
          <span>{exp60.length}</span>Expired &lt;60 Hari
        </button>

        <button
          className={`alert-stat exp90-stat ${alertFilter === "EXP_90" ? "active" : ""}`}
          onClick={() => toggle("EXP_90")}
        >
          <span>{exp90.length}</span>Expired &lt;90 Hari
        </button>
      </div>

      <div className="alert-table-scroll">
        <table className="data-table alert-clean-table">
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Plant</th>
              <th>SKU RM</th>
              <th>Nama RM</th>
              <th>Merk</th>
              <th>Batch</th>
              <th>Datang</th>
              <th>Expired</th>
              <th>Hari</th>
              <th>Qty PCS</th>
              <th>Qty KG</th>
              <th>Lokasi</th>
              <th>Note / Status</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r: any, i: number) => (
              <tr key={i}>
                <td>
                  <span className={`alert-pill alert-pill-${String(r.category).toLowerCase()}`}>
                    {catLabel(r.category)}
                  </span>
                </td>

                <td>
                  <Badge text={String(r.plant || "-")} variant="blue" />
                </td>

                <td className="bold">{r.sku || "-"}</td>
                <td className="bold alert-rm-name">{r.rm || "-"}</td>
                <td className="muted">{r.merk || "-"}</td>
                <td className="muted">{r.batch || "-"}</td>
                <td className="muted">{r.tanggal_datang || "-"}</td>
                <td className="muted">{r.tanggal_expired || "-"}</td>

                <td className="bold">
                  {r.value_label || `${r.value} hari`}
                </td>

                <td className="num blue">{fmt0(r.qty)}</td>
                <td className="num green">{fmt2(r.kg)}</td>
                <td className="muted">{r.lokasi || "-"}</td>

                <td className="muted sm">
                  {r.note || r.status || "-"}
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td colSpan={13} className="muted" style={{ textAlign: "center", padding: 28 }}>
                  Tidak ada data alert untuk filter ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KapasitasTable({ rows, stock }: any) {
  const [selected, setSelected] = useState<any | null>(null);

  function norm(v: any) {
    return String(v || "")
      .trim()
      .toUpperCase();
  }

  function blokLabel(v: any) {
    const s = String(v || "").trim();

    if (!s) return "Blok -";

    if (s.toLowerCase().startsWith("blok")) return s;
    if (s.toLowerCase().includes("bubuk")) return "Penyimpanan Bubuk";

    return `Blok ${s}`;
  }

  function getPctLevel(pct: number) {
    if (pct > 100) {
      return {
        level: "over",
        status: "OVER KAPASITAS",
      };
    }

    if (pct > 90) {
      return {
        level: "danger",
        status: "KRITIS",
      };
    }

    if (pct > 60) {
      return {
        level: "warning",
        status: "WASPADA",
      };
    }

    return {
      level: "safe",
      status: "AMAN",
    };
  }

  function normalizePercent(v: any, isi: number, kapasitas: number) {
    const raw = Number(String(v || "").replace("%", ""));

    let pct =
      raw || (kapasitas ? (isi / kapasitas) * 100 : 0);

    if (pct > 0 && pct <= 1) {
      pct = pct * 100;
    }

    return pct;
  }

  function stockInLokasi(lokasi: any) {
    const lok = norm(lokasi);

    return stock.filter((s: any) => {
      const rmLok = norm(s.lokasi_rm);

      return (
        rmLok === lok ||
        rmLok.startsWith(lok + "-") ||
        rmLok.startsWith(lok + " ") ||
        rmLok.includes(lok)
      );
    });
  }

  const blockMeta = [
    {
      key: "H",
      title: "Blok H",
      category: "Non Allergen Tapioka",
      area: "AREA KIRI",
      col: "left",
    },
    {
      key: "G",
      title: "Blok G",
      category: "Non Allergen Gula",
      area: "AREA KIRI",
      col: "left",
    },
    {
      key: "BUBUK",
      title: "Penyimpanan Bubuk",
      category: "Area Bubuk",
      area: "AREA KIRI",
      col: "left",
    },

    {
      key: "F",
      title: "Blok F",
      category: "Non Allergen",
      area: "AREA TENGAH",
      col: "middle",
    },
    {
      key: "E",
      title: "Blok E",
      category: "Allergen Treenut, Susu, Sulfit",
      area: "AREA TENGAH",
      col: "middle",
    },
    {
      key: "D",
      title: "Blok D",
      category: "Raw Material KITE",
      area: "AREA TENGAH",
      col: "middle",
    },

    {
      key: "C",
      title: "Blok C",
      category: "Non Allergen",
      area: "AREA KANAN",
      col: "right",
    },
    {
      key: "B",
      title: "Blok B",
      category: "Allergen Non Spesifik",
      area: "AREA KANAN",
      col: "right",
    },
    {
      key: "A",
      title: "Blok A",
      category: "Allergen Soya",
      area: "AREA KANAN",
      col: "right",
    },
  ];

  const rowsMap = new Map<string, any>();

  rows.forEach((r: any) => {
    const lokasi = norm(r.lokasi);

    if (!lokasi) return;

    if (lokasi.includes("BUBUK")) {
      rowsMap.set("BUBUK", r);
    } else {
      rowsMap.set(lokasi, r);
    }
  });

  function buildBlock(meta: any) {
    const r = rowsMap.get(meta.key) || {};
    const lokasi = meta.key === "BUBUK" ? "PENYIMPANAN BUBUK" : meta.key;

    const isiStock = stockInLokasi(lokasi);

    const totalBatch = isiStock.length;

    const totalKemasan = isiStock.reduce(
      (a: number, b: any) => a + Number(b.tot_qty_kemasan || 0),
      0
    );

    const totalKg = isiStock.reduce(
      (a: number, b: any) => a + Number(b.tot_qty_kg || 0),
      0
    );

    const kapasitas = Number(r.kapasitas || 0);
    const isi = Number(r.isi || totalKemasan || 0);
    const pct = normalizePercent(r.persen, isi, kapasitas);
    const pctInfo = getPctLevel(pct);

    return {
      ...meta,
      lokasi,
      kapasitas,
      isi,
      persen: pct,
      level: pctInfo.level,
      status: pctInfo.status,
      totalBatch,
      totalKemasan,
      totalKg,
      items: isiStock,
    };
  }

  const blocks = blockMeta.map(buildBlock);

  const columns = [
    {
      key: "left",
      title: "Area Kiri",
      subtitle: "Tapioka, Gula, Bubuk",
    },
    {
      key: "middle",
      title: "Area Tengah",
      subtitle: "F, E, D",
    },
    {
      key: "right",
      title: "Area Kanan",
      subtitle: "C, B, A",
    },
  ];

  return (
    <div className="kapasitas-denah-wrap">
      <div className="kapasitas-legend">
        <span className="legend-item safe">0-60% Aman</span>
        <span className="legend-item warning">&gt;60-90% Waspada</span>
        <span className="legend-item danger">&gt;90-100% Kritis</span>
        <span className="legend-item over">&gt;100% Over</span>
      </div>

      <div className="kapasitas-denah">
        {columns.map((col) => (
          <div className="kapasitas-zone" key={col.key}>
            <div className="zone-head">
              <b>{col.title}</b>
              <span>{col.subtitle}</span>
            </div>

            <div className="zone-stack">
              {blocks
                .filter((b: any) => b.col === col.key)
                .map((b: any) => (
                  <button
                    key={b.key}
                    className={`kapasitas-rack kapasitas-map-card rack-${b.level}`}
                    onClick={() => setSelected(b)}
                  >
                    <div className="rack-top">
                      <span>{b.area}</span>
                      <b>{b.title}</b>
                    </div>

                    <div className="rack-category">
                      {b.category}
                    </div>

                    <div className="rack-body">
                      <div className="rack-percent">
                        {fmt2(b.persen)}%
                      </div>

                      <div className="rack-status">
                        {b.status}
                      </div>
                    </div>

                    <div className="rack-bar">
                      <div
                        className="rack-fill"
                        style={{
                          width: `${Math.min(b.persen, 100)}%`,
                        }}
                      />
                    </div>

                    <div className="rack-foot">
                      <span>{fmt0(b.totalBatch)} batch</span>
                      <span>{fmt0(b.totalKemasan)} pcs</span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div
          className="kapasitas-modal-backdrop"
          onClick={() => setSelected(null)}
        >
          <div
            className="kapasitas-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kapasitas-modal-head">
              <div>
                <h3>{selected.title}</h3>
                <p>
                  {selected.category} · {selected.status} · Utilisasi{" "}
                  {fmt2(selected.persen)}%
                </p>
              </div>

              <button
                className="icon-round"
                onClick={() => setSelected(null)}
              >
                ×
              </button>
            </div>

            <div className="kapasitas-summary">
              <div>
                <span>Kapasitas</span>
                <b>{fmt0(selected.kapasitas)}</b>
              </div>

              <div>
                <span>Total Batch</span>
                <b>{fmt0(selected.totalBatch)}</b>
              </div>

              <div>
                <span>Total Kemasan</span>
                <b>{fmt0(selected.totalKemasan)} pcs</b>
              </div>

              <div>
                <span>Total KG</span>
                <b>{fmt2(selected.totalKg)} kg</b>
              </div>
            </div>

            <div className="kapasitas-detail-list">
              {selected.items.length ? (
                selected.items.map((s: any, i: number) => (
                  <div className="kapasitas-item" key={i}>
                    <div className="kap-item-main">
                      <b>{s.nama_rm}</b>
                      <span>{s.sku_rm}</span>
                    </div>

                    <div className="kap-item-meta">
                      <span>Batch: {s.no_batch || "-"}</span>
                      <span>Merk: {s.merk || "-"}</span>
                      <span>SKU QR: {s.sku_qr || "-"}</span>
                    </div>

                    <div className="kap-item-qty">
                      <span>{fmt0(s.tot_qty_kemasan)} pcs</span>
                      <span>{fmt2(s.tot_qty_kg)} kg</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="kapasitas-empty">
                  Tidak ada RM stock ready di area ini.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
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

function BonanTable({
  rows,
  keluar,
  bonanStatusFilter,
  setBonanStatusFilter,
}: any) {
  return (
    <div className="bonan-wrap">
      <div className="bonan-filterbar">
        <button
          className={`bonan-filter-btn${bonanStatusFilter === "ALL" ? " active" : ""}`}
          onClick={() => setBonanStatusFilter("ALL")}
        >
          Semua
        </button>

        <button
          className={`bonan-filter-btn selesai${bonanStatusFilter === "SELESAI" ? " active" : ""}`}
          onClick={() => setBonanStatusFilter("SELESAI")}
        >
          Selesai Kirim
        </button>

        <button
          className={`bonan-filter-btn belum${bonanStatusFilter === "BELUM" ? " active" : ""}`}
          onClick={() => setBonanStatusFilter("BELUM")}
        >
          Belum Selesai
        </button>
      </div>

      <Tbl
        heads={[
          "Tanggal",
          "Plant",
          "SKU",
          "Nama RM",
          "Bon PCS",
          "Bon KG",
          "Terkirim PCS",
          "Terkirim KG",
          "% PCS",
          "% KG",
          "Kurang PCS",
          "Kurang KG",
          "Note",
        ]}
      >
        {rows.map((r: any, i: number) => {
          const bonPcs = Number(r.qty_bon_zak || 0);
          const bonKg = Number(r.qty_bon_kg || 0);

          const terkirim = getBonanTerkirimAuto(r, keluar);

          const kirimPcs = terkirim.pcs;
          const kirimKg = terkirim.kg;

          const persenPcs = bonPcs ? (kirimPcs / bonPcs) * 100 : 0;
          const persenKg = bonKg ? (kirimKg / bonKg) * 100 : 0;

          const kurangPcs = bonPcs - kirimPcs;
          const kurangKg = bonKg - kirimKg;

          return (
            <tr key={i}>
              <td className="muted">{r.tanggal}</td>

              <td>
                <Badge text={r.plant} variant="blue" />
              </td>

              <td className="bold">{r.sku}</td>
              <td>{r.nama_rm}</td>

              <td className="num blue">{fmt0(bonPcs)}</td>
              <td className="num blue">{fmt2(bonKg)}</td>

              <td className="num green">{fmt0(kirimPcs)}</td>
              <td className="num green">{fmt2(kirimKg)}</td>

              <td className="num">{fmt2(persenPcs)}%</td>
              <td className="num">{fmt2(persenKg)}%</td>

              <td>
                <Badge
                  text={fmt0(kurangPcs)}
                  variant={kurangPcs > 0 ? "kurang" : "aman"}
                />
              </td>

              <td>
                <Badge
                  text={fmt2(kurangKg)}
                  variant={kurangKg > 0 ? "kurang" : "aman"}
                />
              </td>

              <td className="muted">{r.note || "-"}</td>
            </tr>
          );
        })}
      </Tbl>
    </div>
  );
}

function StokJalurTable({
  rows,
  jalurSku,
  setJalurSku,
  jalurMerk,
  setJalurMerk,
  jalurBatch,
  setJalurBatch,
  jalurMinusOnly,
  setJalurMinusOnly,
  skuOptions,
  merkOptions,
  jalurDetail,
  setJalurDetail,
}: any) {
  return (
    <div className="jalur-wrap">
      <div className="jalur-filterbar">
        <div className="jalur-filter">
          <span className="muted sm">Nama RM</span>
          <select
            className="jalur-input"
            value={jalurSku}
            onChange={(e) => {
              setJalurSku(e.target.value);
              setJalurMerk("ALL");
            }}
          >
            <option value="ALL">ALL</option>
            {skuOptions.map((s: any) => (
              <option key={s.sku_rm} value={s.sku_rm}>
                {s.nama_rm} — {s.sku_rm}
              </option>
            ))}
          </select>
        </div>

        <div className="jalur-filter">
          <span className="muted sm">Merk</span>
          <select
            className="jalur-input"
            value={jalurMerk}
            onChange={(e) => setJalurMerk(e.target.value)}
          >
            <option value="ALL">ALL</option>
            {merkOptions.map((m: string) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <div className="jalur-filter">
          <span className="muted sm">Batch</span>
          <input
            className="jalur-input"
            placeholder="filter batch..."
            value={jalurBatch}
            onChange={(e) => setJalurBatch(e.target.value)}
          />
        </div>
        <div className="jalur-filter jalur-minus-filter">
  <span className="muted sm">Status</span>
  <button
    type="button"
    className={`jalur-minus-btn${jalurMinusOnly ? " active" : ""}`}
    onClick={() => setJalurMinusOnly(!jalurMinusOnly)}
  >
    {jalurMinusOnly ? "Minus Aktif" : "Tampilkan Minus"}
  </button>
</div>
      </div>

      <div className="jalur-scroll">
        <table className="data-table jalur-compact-table">
          <thead>
            <tr>
  <th className="jalur-sticky jalur-date-in-col">Tgl Datang</th>
  <th className="jalur-sticky jalur-info-col">Barang</th>
  <th className="jalur-sticky jalur-awal-col">Stock Awal</th>
  <th className="jalur-sticky jalur-akhir-col">Stock Akhir</th>
  <th className="jalur-detail-col">Detail Jalur</th>
</tr>
          </thead>

          <tbody>
            {rows.map((r: any, i: number) => {
              const days = Object.values(r.daily || {}).sort((a: any, b: any) =>
                String(a.date).localeCompare(String(b.date))
              );

              return (
                <tr key={`${r.sku_qr}_${i}`}>
  <td className="jalur-sticky jalur-date-in-col">
    <div className="jalur-date-in">
      {r.tanggal_kedatangan
        ? String(r.tanggal_kedatangan).slice(0, 10)
        : "-"}
    </div>
  </td>

  <td className="jalur-sticky jalur-info-col">
    <div className="jalur-name">{r.nama_rm}</div>
                    <div className="muted sm">SKU RM: {r.sku_rm}</div>
                    <div className="muted sm">Merk: {r.merk || "-"}</div>
                    <div className="muted sm">Batch: {r.no_batch || "-"}</div>
                    <div className="muted sm">Plant: {r.plant}</div>
                    <div className="muted sm">Lokasi: {r.lokasi_rm || "-"}</div>
                    <div className="muted sm jalur-skuqr">{r.sku_qr}</div>
                  </td>

                  <td className="jalur-sticky jalur-awal-col">
                    <div className="jalur-stock blue">
                      {fmt0(r.masuk_pcs)} pcs
                    </div>
                    <div className="jalur-stock green">
                      {fmt2(r.masuk_kg)} kg
                    </div>
                  </td>

                  <td className="jalur-sticky jalur-akhir-col">
                    <div className={`jalur-stock ${r.sisa_pcs > 0 ? "green" : "red"}`}>
                      {fmt0(r.sisa_pcs)} pcs
                    </div>
                    <div className={`jalur-stock ${r.sisa_kg > 0 ? "green" : "red"}`}>
                      {fmt2(r.sisa_kg)} kg
                    </div>
                  </td>

                  <td className="jalur-detail-col">
                    <div className="jalur-card-row">
                      {days.length ? (
                        days.map((day: any) => (
                          <button
                            key={day.date}
                            className="jalur-day-card compact"
                            onClick={() =>
                              setJalurDetail({
                                row: r,
                                day,
                              })
                            }
                          >
                            <div className="jalur-day-date">
                              {day.date}
                            </div>

                            <div className="jalur-day-title">
                              Total Keluar
                            </div>

                            <div>
                              {fmt0(day.keluar_pcs)} pcs
                            </div>

                            <div>
                              {fmt2(day.keluar_kg)} kg
                            </div>

                            <div className="jalur-day-sisa">
                              Sisa {fmt0(day.sisa_pcs)} pcs
                            </div>

                            <div className="jalur-day-sisa small">
                              {fmt2(day.sisa_kg)} kg
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="jalur-day-empty compact">
                          Belum ada keluar
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {jalurDetail && (
        <div
          className="jalur-modal-backdrop"
          onClick={() => setJalurDetail(null)}
        >
          <div
            className="jalur-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="jalur-modal-head">
              <div>
                <h3>{jalurDetail.row.nama_rm}</h3>
                <p>
                  {jalurDetail.row.sku_rm} · {jalurDetail.row.merk || "-"} · Batch {jalurDetail.row.no_batch}
                </p>
                <p className="muted sm">{jalurDetail.row.sku_qr}</p>
              </div>

              <button
                className="icon-round"
                onClick={() => setJalurDetail(null)}
              >
                ×
              </button>
            </div>

            <div className="jalur-modal-summary">
              <div>
                <span>Tanggal</span>
                <b>{jalurDetail.day.date}</b>
              </div>
              <div>
                <span>Total Keluar</span>
                <b>
                  {fmt0(jalurDetail.day.keluar_pcs)} pcs | {fmt2(jalurDetail.day.keluar_kg)} kg
                </b>
              </div>
              <div>
                <span>Sisa Akhir Hari</span>
                <b>
                  {fmt0(jalurDetail.day.sisa_pcs)} pcs | {fmt2(jalurDetail.day.sisa_kg)} kg
                </b>
              </div>
            </div>

            <div className="jalur-timeline-list">
              {jalurDetail.day.details.map((d: any, i: number) => (
                <div className="jalur-timeline-item" key={i}>
                  <div className="timeline-time">
                    {d.tanggal || "-"} {d.jam || ""}
                  </div>

                  <div>
                    Qty: <b>{fmt0(d.qty_kemasan)} pcs</b> | <b>{fmt2(d.qty_kg)} kg</b>
                  </div>
<div className="muted sm">
  Key: {d.plant_tujuan || "-"} | {d.sku_qr || ""}
</div>
                  <div>
  Jenis: <b>{d.jenis || "KELUAR"}</b>
</div>

<div>
  Tujuan: {d.plant_tujuan || "-"} · Palet: {d.no_palet || "-"}
</div>

                  <div className="timeline-sisa">
                    Sisa setelah keluar: {fmt0(d.sisa_after_pcs)} pcs | {fmt2(d.sisa_after_kg)} kg
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
