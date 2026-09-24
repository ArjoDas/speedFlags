import json
import sqlite3
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def normalize(value: str) -> str:
    value = unicodedata.normalize("NFKD", value.casefold())
    return "".join(c for c in value if c.isalnum() and not unicodedata.combining(c))


class Countries:
    def __init__(self, path: Path = ROOT / "data/generated/countries.db"):
        with sqlite3.connect(f"file:{path}?mode=ro", uri=True) as db:
            db.row_factory = sqlite3.Row
            self.version = db.execute("SELECT version FROM metadata").fetchone()[0]
            self.rows = [dict(row) for row in db.execute("SELECT * FROM countries ORDER BY name")]
        self.groups: dict[str, list[dict]] = {}
        self.by_id = {}
        self.alias_assets: dict[str, set[str]] = {}
        for row in self.rows:
            row["aliases"] = json.loads(row["aliases"])
            self.by_id[row["id"]] = row
            self.groups.setdefault(row["asset"], []).append(row)
            for alias in [row["name"], row["official"], *row["aliases"]]:
                self.alias_assets.setdefault(normalize(alias), set()).add(row["asset"])

    def deck(self, scope: str, ids: list[str]) -> list[str]:
        return sorted(
            {r["asset"] for r in self.rows if (scope == "all" or r["starter"]) and (not ids or r["id"] in ids)}
        )

    def correct(self, asset: str, answer: str) -> bool:
        # An alias identifying two distinct flags is ambiguous and never auto-accepted.
        return self.alias_assets.get(normalize(answer)) == {asset}

    def names(self, asset: str) -> list[str]:
        return [row["name"] for row in self.groups[asset]]

    def ids(self, asset: str) -> list[str]:
        return [row["id"] for row in self.groups[asset]]
