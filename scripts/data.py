"""Deterministic, offline export. Refresh downloads into staging; never mutates the baseline."""

import argparse
import hashlib
import html
import json
import math
import re
import sqlite3
import tempfile
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
ALLOWED = {
    "svg",
    "g",
    "path",
    "rect",
    "circle",
    "ellipse",
    "line",
    "polyline",
    "polygon",
    "defs",
    "use",
    "clipPath",
    "mask",
    "linearGradient",
    "radialGradient",
    "stop",
    "style",
    "title",
    "desc",
}


def digest(value):
    return hashlib.sha256(value).hexdigest()


def validate_svg(svg):
    if len(svg.encode()) > 1_000_000 or re.search(r"<!DOCTYPE|<!ENTITY", svg, re.IGNORECASE):
        raise ValueError("Oversized SVG or XML entities")
    root = ET.fromstring(svg)
    if root.tag != "{http://www.w3.org/2000/svg}svg":
        raise ValueError("Expected SVG root")
    for element in root.iter():
        if element.tag.split("}")[-1] not in ALLOWED:
            raise ValueError("Disallowed SVG element")
        for key, value in element.attrib.items():
            name = key.split("}")[-1].lower()
            if name.startswith("on") or (name == "href" and not value.startswith("#")):
                raise ValueError("Active or external SVG content")
        content = " ".join(element.attrib.values()) + (element.text or "")
        if re.search(r"@import|javascript:|expression\s*\(|https?://|data:", content, re.IGNORECASE):
            raise ValueError("External or active SVG content")
        for ref in re.findall(r"url\s*\(([^)]*)\)", content, re.IGNORECASE):
            if not ref.strip(" \t'\"").startswith("#"):
                raise ValueError("External SVG URL")
    if root.get("viewBox"):
        dimensions = [float(x) for x in re.split(r"[\s,]+", root.get("viewBox").strip())]
        if len(dimensions) != 4 or not all(math.isfinite(x) for x in dimensions) or min(dimensions[2:]) <= 0:
            raise ValueError("Invalid viewBox")
    else:
        width, height = (float(root.get(k, "").removesuffix("px")) for k in ("width", "height"))
        if not all(math.isfinite(x) and x > 0 for x in (width, height)):
            raise ValueError("Missing dimensions")
        # Preserve the original drawing bytes; add only the missing viewport.
        svg = re.sub(r"<svg\b", f'<svg viewBox="0 0 {width:g} {height:g}"', svg, count=1)
    return svg


def rows_from_baseline():
    with sqlite3.connect(f"file:{ROOT / 'speedflags.db'}?mode=ro", uri=True) as db:
        db.row_factory = sqlite3.Row
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("Corrupt baseline database")
        rows = [dict(row) for row in db.execute("SELECT * FROM flags ORDER BY cca2")]
    for row in rows:
        if not re.fullmatch("[A-Z]{2}", row["cca2"]) or any(
            not str(v).strip() or str(v).lower() in {"null", "undefined", "none"} for v in row.values()
        ):
            raise ValueError("Invalid country row")
    return rows


def download(code):
    url = f"https://flagcdn.com/{code.lower()}.svg"
    for attempt in range(3):
        try:
            with urlopen(url, timeout=15) as response:
                if response.status != 200 or "svg" not in response.headers.get("Content-Type", ""):
                    raise ValueError("Expected SVG response")
                svg = response.read(1_000_001).decode()
            validate_svg(svg)
            return code, svg
        except (OSError, ValueError):
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def build(refresh=False, check=False):
    policy = json.loads((ROOT / "data/policy.json").read_text())
    rows = rows_from_baseline()
    overrides_path = ROOT / "data/asset-overrides.json"
    overrides = json.loads(overrides_path.read_text()) if overrides_path.exists() else {}
    if refresh:
        # Every result is consumed; any failure aborts before publishing.
        with ThreadPoolExecutor(max_workers=6) as pool:
            downloads = dict(pool.map(download, [row["cca2"] for row in rows]))
        overrides = {
            code: {
                "svg": svg,
                "source": f"https://flagcdn.com/{code.lower()}.svg",
                "retrieved": time.strftime("%Y-%m-%d", time.gmtime()),
            }
            for code, svg in downloads.items()
        }
    assets, countries, groups = {}, [], {}
    for row in rows:
        code = row["cca2"]
        source = overrides.get(code, {})
        svg = validate_svg(source.get("svg", row["svg_code"]))
        asset = digest(svg.encode())[:24]
        assets[asset] = svg
        groups.setdefault(asset, []).append(code)
        countries.append(
            {
                "id": code,
                "name": row["common"],
                "official": row["official"],
                "aliases": policy["aliases"].get(code, []),
                "asset": asset,
                "source": source.get("source", row["svg_url"]),
                "retrieved": source.get("retrieved", "unknown (legacy snapshot)"),
                "starter": code in policy["starter"],
            }
        )
    duplicates = sorted(sorted(codes) for codes in groups.values() if len(codes) > 1)
    expected = sorted(sorted(codes) for codes in policy["shared_groups"])
    if duplicates != expected:
        raise ValueError(f"Shared groups need review: {duplicates}")
    manifest = {
        "schema": 1,
        "baseline_sha256": digest((ROOT / "speedflags.db").read_bytes()),
        "policy": policy["notes"],
        "countries": countries,
        "shared_groups": duplicates,
    }
    version = digest(json.dumps(manifest, sort_keys=True).encode())[:16]
    manifest["version"] = version
    with tempfile.TemporaryDirectory(dir=ROOT / "data") as temp:
        stage = Path(temp)
        flags = stage / "flags"
        flags.mkdir()
        for asset, svg in assets.items():
            (flags / f"{asset}.svg").write_text(svg)
        (stage / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
        db = sqlite3.connect(stage / "countries.db")
        db.execute(
            "CREATE TABLE countries (id TEXT PRIMARY KEY, name TEXT NOT NULL, official TEXT NOT NULL, aliases TEXT NOT NULL, asset TEXT NOT NULL, starter INTEGER NOT NULL)"
        )
        db.executemany(
            "INSERT INTO countries VALUES (?,?,?,?,?,?)",
            [
                (c["id"], c["name"], c["official"], json.dumps(c["aliases"]), c["asset"], c["starter"])
                for c in countries
            ],
        )
        db.execute("CREATE TABLE metadata (version TEXT NOT NULL)")
        db.execute("INSERT INTO metadata VALUES (?)", (version,))
        db.commit()
        db.close()
        output = ROOT / "data/generated"
        asset_output = ROOT / "frontend/public/flags"
        if check:
            for filename in ("manifest.json", "countries.db"):
                if filename.endswith(".db") and (output / filename).exists():
                    with (
                        sqlite3.connect(stage / filename) as new,
                        sqlite3.connect(f"file:{output / filename}?mode=ro", uri=True) as old,
                    ):
                        equal = list(new.iterdump()) == list(old.iterdump())
                else:
                    equal = (output / filename).exists() and (stage / filename).read_bytes() == (
                        output / filename
                    ).read_bytes()
                if not equal:
                    raise ValueError(f"Stale generated {filename}; run python3 scripts/data.py")
            if not asset_output.exists() or {p.name: p.read_bytes() for p in flags.iterdir()} != {
                p.name: p.read_bytes() for p in asset_output.iterdir()
            }:
                raise ValueError("Stale generated flags")
        else:
            # Publish only validated content. Files are replaced atomically; builds run after export.
            output.mkdir(exist_ok=True)
            asset_output.mkdir(parents=True, exist_ok=True)
            for filename in ("manifest.json", "countries.db"):
                (stage / filename).replace(output / filename)
            for flag in flags.iterdir():
                flag.replace(asset_output / flag.name)
            for old in asset_output.iterdir():
                if old.stem not in assets:
                    old.unlink()
            if refresh:
                tmp = stage / "overrides.json"
                tmp.write_text(json.dumps(overrides, ensure_ascii=False, indent=2) + "\n")
                tmp.replace(overrides_path)
        cards = "".join(
            f'<figure><img src="../frontend/public/flags/{c["asset"]}.svg" alt=""><figcaption>{html.escape(c["id"] + " · " + c["name"])}</figcaption></figure>'
            for c in countries
        )
        if not check:
            (ROOT / "docs/flags.html").write_text(
                '<!doctype html><html lang="en"><meta charset="utf-8"><title>Flag audit</title><style>body{font:14px system-ui;display:grid;grid-template-columns:repeat(5,1fr);gap:12px}figure{margin:0;padding:12px;border:1px solid #ccc}img{width:100%;height:100px;object-fit:contain}figcaption{margin-top:8px}</style>'
                + cards
                + "</html>"
            )
    print(f"{len(countries)} entities, {len(assets)} flag questions, dataset {version}; valid")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--refresh", action="store_true")
    action.add_argument("--check", action="store_true")
    args = parser.parse_args()
    build(args.refresh, args.check)
