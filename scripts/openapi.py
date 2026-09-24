"""Export public API contracts; no secrets or running server required."""

import json
from pathlib import Path

from backend.app import app

path = Path(__file__).resolve().parents[1] / "data/openapi.json"
path.write_text(json.dumps(app.openapi(), indent=2) + "\n")
