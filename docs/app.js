let DATA = [];
let FILTERED = [];

const $ = (id) => document.getElementById(id);

function typeOrder(t){
  // Desired ordering: CY3 → K0 → K1 → K2
  const m = {CY3:0, K0:1, K1:2, K2:3};
  return (t in m) ? m[t] : 99;
}

function normalizeType(t){
  // Data uses CY3 / K0 / K1 / K2 already, but be defensive.
  t = (t||"").replace(/\s+/g,"").replace(/K_/g,"K").replace(/-/g,"");
  if(t === "K_0") t = "K0";
  if(t === "K_1") t = "K1";
  if(t === "K_2") t = "K2";
  return t;
}

function fmtList(arr){
  return "[" + arr.join(", ") + "]";
}

// ---------- exact arithmetic for (-K_X)^4 = (\prod degrees)/(\prod weights) ----------
function gcdBigInt(a, b){
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n){
    const t = a % b;
    a = b;
    b = t;
  }
  return a;
}

function prodBigInt(arr){
  let p = 1n;
  for (const x of arr){
    p *= BigInt(x);
  }
  return p;
}

function reduceFrac(num, den){
  if (den === 0n) return { num, den, str: 'undefined', dec: 'undefined' };
  const g = gcdBigInt(num, den);
  num /= g;
  den /= g;
  if (den < 0n){ num = -num; den = -den; }
  const str = (den === 1n) ? String(num) : `${num}/${den}`;
  const dec = fracToDecimal(num, den, 8);
  return { num, den, str, dec };
}

function fracToDecimal(num, den, dp){
  // Exact decimal expansion up to dp digits (no rounding), safe for very large BigInt.
  if (den === 0n) return 'undefined';
  const sign = (num < 0n) ? '-' : '';
  num = num < 0n ? -num : num;
  const intPart = num / den;
  let rem = num % den;
  if (dp <= 0) return sign + String(intPart);
  let frac = '';
  for (let i = 0; i < dp; i++){
    rem *= 10n;
    const digit = rem / den;
    rem = rem % den;
    frac += String(digit);
  }
  return sign + String(intPart) + '.' + frac;
}

function readNumber(id){
  const v = $(id).value.trim();
  if(v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Parse a rational number from user input.
// Accepts: integer ("3"), fraction ("3/7"), decimal ("0.125").
function readRational(id){
  const s = $(id).value.trim();
  if(s === "") return null;
  try{
    return parseRational(s);
  }catch(e){
    return null; // treat invalid input as no bound
  }
}

function parseRational(s){
  s = s.trim();
  if(s === '') throw new Error('empty');
  // Fraction a/b
  if(s.includes('/')){
    const parts = s.split('/').map(x => x.trim());
    if(parts.length !== 2) throw new Error('bad fraction');
    const num = BigInt(parts[0]);
    const den = BigInt(parts[1]);
    return reduceFrac(num, den);
  }
  // Decimal
  if(s.includes('.')){
    let sign = 1n;
    if(s.startsWith('-')){ sign = -1n; s = s.slice(1); }
    if(s.startsWith('+')){ s = s.slice(1); }
    const [a,b] = s.split('.');
    const intPart = a === '' ? '0' : a;
    const fracPart = b ?? '';
    if(!/^[0-9]+$/.test(intPart) || (fracPart !== '' && !/^[0-9]+$/.test(fracPart))) throw new Error('bad decimal');
    const k = BigInt(10) ** BigInt(fracPart.length);
    const num = BigInt(intPart + fracPart) * sign;
    const den = k;
    return reduceFrac(num, den);
  }
  // Integer
  return reduceFrac(BigInt(s), 1n);
}

function cmpFrac(a, b){
  // Compare a.num/a.den vs b.num/b.den using cross multiplication (BigInt exact).
  const left = a.num * b.den;
  const right = b.num * a.den;
  if(left < right) return -1;
  if(left > right) return 1;
  return 0;
}

function activeTypes(){
  return Array.from(document.querySelectorAll('.typeCheck'))
    .filter(cb => cb.checked)
    .map(cb => cb.value);
}

function passesFilters(r){
  const codimOk = ( ($('codim2').checked && r.codim === 2) || ($('codim3').checked && r.codim === 3) );
  if(!codimOk) return false;

  const types = activeTypes();
  if(types.length > 0){
    if(!types.includes(r.type)) return false;
  } else {
    // If user unchecks everything, treat as no matches.
    return false;
  }

  const Wmin = readNumber('Wmin');
  const Wmax = readNumber('Wmax');
  if(Wmin !== null && r.W < Wmin) return false;
  if(Wmax !== null && r.W > Wmax) return false;

  const Bmin = readNumber('Bmin');
  const Bmax = readNumber('Bmax');
  if(Bmin !== null && r.basket_count < Bmin) return false;
  if(Bmax !== null && r.basket_count > Bmax) return false;

  const Vmin = readRational('Vmin');
  const Vmax = readRational('Vmax');
  if(Vmin !== null && cmpFrac(r.antiK4, Vmin) < 0) return false;
  if(Vmax !== null && cmpFrac(r.antiK4, Vmax) > 0) return false;

  const q = $('q').value.trim().toLowerCase();
  if(q){
    const hay = [
      r.signature,
      fmtList(r.weights),
      fmtList(r.degrees),
      r.antiK4?.str ?? '',
      r.antiK4?.dec ?? '',
      String(r.W),
      String(r.basket_count),
      r.basket_str,
      r.type
    ].join(" ").toLowerCase();
    if(!hay.includes(q)) return false;
  }
  return true;
}

function sortRecords(arr){
  const s = $('sort').value;
  const out = [...arr];
  if(s === 'Vasc') out.sort((a,b)=>cmpFrac(a.antiK4,b.antiK4) || a.id-b.id);
  else if(s === 'Vdesc') out.sort((a,b)=>cmpFrac(b.antiK4,a.antiK4) || a.id-b.id);
  else if(s === 'Wasc') out.sort((a,b)=>a.W-b.W || a.id-b.id);
  else if(s === 'Wdesc') out.sort((a,b)=>b.W-a.W || a.id-b.id);
  else if(s === 'Basc') out.sort((a,b)=>a.basket_count-b.basket_count || a.id-b.id);
  else if(s === 'Bdesc') out.sort((a,b)=>b.basket_count-a.basket_count || a.id-b.id);
  else if(s === 'codim') out.sort((a,b)=>a.codim-b.codim || a.W-b.W || a.id-b.id);
  else if(s === 'type') out.sort((a,b)=>typeOrder(a.type)-typeOrder(b.type) || a.W-b.W || a.id-b.id);
  else out.sort((a,b)=>a.id-b.id);
  return out;
}

function render(){
  FILTERED = sortRecords(DATA.filter(passesFilters));
  $('count').textContent = String(FILTERED.length);

  const tbody = $('tbody');
  tbody.innerHTML = '';

  const frag = document.createDocumentFragment();
  for(const r of FILTERED){
    const tr = document.createElement('tr');

    const tdId = document.createElement('td');
    tdId.textContent = r.id;
    tr.appendChild(tdId);

    const tdC = document.createElement('td');
    tdC.textContent = String(r.codim);
    tr.appendChild(tdC);

    const tdW = document.createElement('td');
    tdW.textContent = fmtList(r.weights);
    tr.appendChild(tdW);

    const tdD = document.createElement('td');
    tdD.textContent = fmtList(r.degrees);
    tr.appendChild(tdD);

    const tdVol = document.createElement('td');
    tdVol.className = 'mono';
    tdVol.textContent = r.antiK4.str;
    tdVol.title = `≈ ${r.antiK4.dec}`;
    tr.appendChild(tdVol);

    const tdB = document.createElement('td');
    tdB.className = 'copyable';
    tdB.textContent = r.basket_str;
    tdB.title = 'Click to copy';
    tdB.addEventListener('click', async () => {
      try{
        await navigator.clipboard.writeText(r.basket_str);
        $('status').textContent = `Copied basket for ID ${r.id}`;
        setTimeout(()=>{ $('status').textContent = ''; }, 1200);
      }catch(e){
        $('status').textContent = 'Copy failed (browser permissions).';
      }
    });
    tr.appendChild(tdB);

    const tdT = document.createElement('td');
    const span = document.createElement('span');
    span.className = 'badge ' + r.type;
    span.textContent = r.type;
    tdT.appendChild(span);
    tr.appendChild(tdT);

    frag.appendChild(tr);
  }
  tbody.appendChild(frag);
}

function resetFilters(){
  $('codim2').checked = true;
  $('codim3').checked = true;
  document.querySelectorAll('.typeCheck').forEach(cb => cb.checked = true);
  $('Wmin').value = '';
  $('Wmax').value = '';
  $('Bmin').value = '';
  $('Bmax').value = '';
  $('Vmin').value = '';
  $('Vmax').value = '';
  $('q').value = '';
  $('sort').value = 'Vasc';
  render();
}

function toCSV(rows){
  const header = ["id","codim","weights","degrees","antiK4","antiK4_decimal","W","basket_count","basket_terms","type"];
  const esc = (x) => {
    const s = String(x ?? "");
    if(/[",\n]/.test(s)) return '"' + s.replace(/"/g,'""') + '"';
    return s;
  };
  const lines = [header.join(",")];
  for(const r of rows){
    lines.push([
      r.id,
      r.codim,
      fmtList(r.weights),
      fmtList(r.degrees),
      r.antiK4.str,
      r.antiK4.dec,
      r.W,
      r.basket_count,
      r.basket_str,
      r.type
    ].map(esc).join(","));
  }
  return lines.join("\n");
}

function downloadCSV(){
  const csv = toCSV(FILTERED);
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'terminal_fano4_filtered.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function init(){
  $('status').textContent = 'Loading data…';
  try{
    const res = await fetch('data/data.json');
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    DATA = raw.map(r => {
      const weights = r.weights || [];
      const degrees = r.degrees || [];
      const antiK4 = reduceFrac(prodBigInt(degrees), prodBigInt(weights));
      return {
        ...r,
        type: normalizeType(r.type),
        antiK4,
      };
    });
    $('status').textContent = `Loaded ${DATA.length} entries.`;
    setTimeout(()=>{ $('status').textContent = ''; }, 1200);

    // Wire listeners
    const rerender = () => render();
    ['codim2','codim3','Wmin','Wmax','Bmin','Bmax','Vmin','Vmax','q','sort'].forEach(id => $(id).addEventListener('input', rerender));
    document.querySelectorAll('.typeCheck').forEach(cb => cb.addEventListener('input', rerender));
    $('reset').addEventListener('click', resetFilters);
    $('downloadCsv').addEventListener('click', downloadCSV);

    render();
  }catch(e){
    console.error(e);
    $('status').textContent = 'Failed to load data. If you are opening this file locally, use GitHub Pages or a local web server.';
  }
}

init();
