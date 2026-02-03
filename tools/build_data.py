#!/usr/bin/env python3
"""
Build docs/data/data.json from the Magma list file Combine_List_Website.m.

Usage:
  python tools/build_data.py data/raw/Combine_List_Website.m docs/data/data.json
"""
import json, re, sys

def split_top_level_commas(s: str):
    s = s.strip()
    if not s:
        return []
    parts, buf, depth = [], [], 0
    for ch in s:
        if ch == '(':
            depth += 1
            buf.append(ch)
        elif ch == ')':
            depth = max(0, depth - 1)
            buf.append(ch)
        elif ch == ',' and depth == 0:
            part = ''.join(buf).strip()
            if part:
                parts.append(re.sub(r"\s+", " ", part))
            buf = []
        else:
            buf.append(ch)
    part = ''.join(buf).strip()
    if part:
        parts.append(re.sub(r"\s+", " ", part))
    return parts

def parse_block(text: str, block_name: str):
    m = re.search(rf"{re.escape(block_name)}\s*:=\s*\[", text)
    if not m:
        raise ValueError(f"Block not found: {block_name}")
    start = m.end()
    end = text.find("\n]\n", start)
    if end == -1:
        raise ValueError(f"List end not found for: {block_name}")
    block = text[start:end]
    entry_re = re.compile(r"<\s*\[\s*(.*?)\s*\]\s*,\s*\[\s*(.*?)\s*\]\s*,\s*\"(.*?)\"\s*>", re.DOTALL)
    out = []
    for mm in entry_re.finditer(block):
        nums = [int(x.strip()) for x in mm.group(1).split(",") if x.strip()]
        basket_raw = split_top_level_commas(mm.group(2).replace("\n", " ").strip())
        typ = mm.group(3).strip()
        out.append((nums, basket_raw, typ))
    return out

def compute_records(entries, codim):
    recs = []
    for nums, basket_raw, typ in entries:
        if codim == 2:
            weights, degrees = nums[:-2], nums[-2:]
        else:
            weights, degrees = nums[:-3], nums[-3:]
        W = sum(weights)

        basket = []
        basket_count = 0
        for t in basket_raw:
            t2 = re.sub(r"\s+", " ", t.strip())
            m = re.match(r"(\d+)\s*x\s*(.+)", t2)
            if m:
                mult = int(m.group(1))
                sing = m.group(2).strip()
            else:
                mult = 1
                sing = t2
            basket.append({"mult": mult, "sing": sing})
            basket_count += mult

        norm_type = typ.replace(" ", "").replace("-", "").replace("K_", "K")
        basket_str = "∅"
        if basket_raw:
            pretty = []
            for b in basket:
                pretty.append(f'{b["mult"]}× {b["sing"]}' if b["mult"] != 1 else b["sing"])
            basket_str = "; ".join(pretty)

        recs.append({
            "weights": weights,
            "degrees": degrees,
            "codim": codim,
            "W": W,
            "basket_raw": basket_raw,
            "basket": basket,
            "basket_count": basket_count,
            "basket_str": basket_str,
            "type": norm_type,
            "signature": f'[{",".join(map(str,weights))} | {",".join(map(str,degrees))}]',
        })
    return recs

def main():
    if len(sys.argv) != 3:
        print(__doc__.strip())
        sys.exit(2)
    inp, outp = sys.argv[1], sys.argv[2]
    text = open(inp, "r", encoding="utf-8", errors="ignore").read()

    ci2 = parse_block(text, "QS_CI2_Fano4_Ki")
    ci3 = parse_block(text, "QS_CI3_Fano4_Ki")

    recs = compute_records(ci2, 2) + compute_records(ci3, 3)
    for i, r in enumerate(recs, start=1):
        r["id"] = i

    with open(outp, "w", encoding="utf-8") as f:
        json.dump(recs, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(recs)} records to {outp}")

if __name__ == "__main__":
    main()
