"""Create a local secret once without printing or overwriting existing configuration."""

from pathlib import Path

from cryptography.fernet import Fernet

path = Path(__file__).resolve().parents[1] / ".env"
try:
    with path.open("x") as file:
        file.write("SPEEDFLAGS_KEYS=" + Fernet.generate_key().decode() + "\n")
    path.chmod(0o600)
    print("Created local .env. Keep it untracked; use a separate production key.")
except FileExistsError:
    print(".env already exists; no changes made.")
