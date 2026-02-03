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

function readNumber(id){
  const v = $(id).value.trim();
  if(v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

  const q = $('q').value.trim().toLowerCase();
  if(q){
    const hay = [
      r.signature,
      fmtList(r.weights),
      fmtList(r.degrees),
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
  if(s === 'Wasc') out.sort((a,b)=>a.W-b.W || a.id-b.id);
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

    const tdSum = document.createElement('td');
    tdSum.textContent = String(r.W);
    tr.appendChild(tdSum);

    const tdBn = document.createElement('td');
    tdBn.textContent = String(r.basket_count);
    tr.appendChild(tdBn);

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
  $('q').value = '';
  $('sort').value = 'Wasc';
  render();
}

function toCSV(rows){
  const header = ["id","codim","weights","degrees","W","basket_count","basket_terms","type"];
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
    DATA = raw.map(r => ({
      ...r,
      type: normalizeType(r.type),
    }));
    $('status').textContent = `Loaded ${DATA.length} entries.`;
    setTimeout(()=>{ $('status').textContent = ''; }, 1200);

    // Wire listeners
    const rerender = () => render();
    ['codim2','codim3','Wmin','Wmax','Bmin','Bmax','q','sort'].forEach(id => $(id).addEventListener('input', rerender));
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
