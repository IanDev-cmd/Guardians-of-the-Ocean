"""Dump map city/school arrays from goo-map.js into assets/maps JSON."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src = (ROOT / "js" / "goo-map.js").read_text(encoding="utf-8")


def grab_cities():
    m = re.search(r"var CITIES = (\[[\s\S]*?\n  \]);", src)
    text = m.group(1)
    text = re.sub(r"([\{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:", r'\1"\2":', text)
    text = re.sub(r"'([^']*)'", r'"\1"', text)
    return json.loads(text)


def grab_schools():
    block = re.search(r"var SCHOOLS = \[([\s\S]*?)\n  \];", src).group(1)
    rows = []
    for raw in re.finditer(
        r"\{city:'(\w+)', type:'(\w+)', name:['\"](.+?)['\"], ll:\[([^]]+)\]\}",
        block,
    ):
        lat, lng = [float(x.strip()) for x in raw.group(4).split(",")]
        rows.append({
            "city": raw.group(1),
            "type": raw.group(2),
            "name": raw.group(3),
            "ll": [lat, lng],
        })
    if not rows:
        raise SystemExit("no schools parsed")
    return rows


cities = grab_cities()
schools = grab_schools()
out = ROOT / "assets" / "maps"
out.mkdir(parents=True, exist_ok=True)


def fc(rows):
    feats = []
    for r in rows:
        ll = r["ll"]
        feats.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [ll[1], ll[0]]},
            "properties": {k: r[k] for k in r if k != "ll"},
        })
    return {"type": "FeatureCollection", "features": feats}


(out / "cities.geojson").write_text(json.dumps(fc(cities), ensure_ascii=False), encoding="utf-8")
(out / "schools.geojson").write_text(json.dumps(fc(schools), ensure_ascii=False), encoding="utf-8")
(out / "cities.json").write_text(json.dumps(cities, ensure_ascii=False), encoding="utf-8")
(out / "schools.json").write_text(json.dumps(schools, ensure_ascii=False), encoding="utf-8")
print("cities", len(cities), "schools", len(schools))
