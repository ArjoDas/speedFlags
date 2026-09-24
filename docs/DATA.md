# Country and flag data

The original `speedflags.db` remains unchanged as a reproducible baseline. The production database is `data/generated/countries.db`: it stores names, aliases and asset IDs without embedding SVG markup. Its connection is read-only.

The 250 original entities are countries **and territories**, not a sovereignty list. The introductory deck has 50 curated entries; the full deck has 245 distinct playable assets. Shared flag questions accept all associated names: Australia / Heard Island and McDonald Islands; France / Saint Martin; Norway / Bouvet Island / Svalbard and Jan Mayen; United States / US Minor Outlying Islands. Official names and explicit aliases are also accepted. Similar but different designs are not automatically merged.

`python3 scripts/data.py --check` validates committed outputs without network access. `python3 scripts/data.py` rebuilds them deterministically. `python3 scripts/data.py --refresh` downloads all SVGs from FlagCDN with bounded concurrency/timeouts/retries, validates all results, and refuses to publish if shared groups change. The baseline is never overwritten. Review the generated manifest, asset overrides and `docs/flags.html` contact sheet before committing a refresh. Generated files form one release unit; never serve a partially rebuilt checkout.

The refreshed files and retrieval dates are recorded in `data/asset-overrides.json`. Their source URLs and checksums are reflected in the generated manifest/assets. No live third-party API is required by builds or games. Missing viewBoxes are normalized without rewriting drawing paths. More aggressive optimization is deliberately avoided until visual equivalence can be established.

Flag images are provided by [FlagCDN](https://flagcdn.com/), a Flagpedia service; Flagpedia identifies its flag images as [public domain](https://flagpedia.net/about). This does not license Flagpedia's site text/design or override local restrictions on flag use. Names originate in the project's REST Countries import. This repository does not invent a new license for the author's original application code.

Dataset scope follows the original project; flag depiction follows the retrieved provider snapshot, including politically sensitive entries. This is not a statement about recognition. Inspect and document disputed or historical variants before adding alternative modes. The snapshot and its version are pinned to every game.

Visual review also identified Australia / Heard Island and McDonald Islands as equivalent despite different SVG encodings. The [provider confirms the shared flag](https://flagpedia.net/heard-island-and-mcdonald-islands). The explicit policy maps both to the Australian asset, preserves the original source hash and reduces the playable deck from 246 to 245 flags. All 250 entries were inspected in rendered contact sheets; this is a rendering and mapping review, not certification of geopolitical status.
