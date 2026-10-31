import os
from pathlib import Path
import sys

# Ensure repository root and backend directory are on sys.path
backend_dir = Path(__file__).resolve().parent.parent
repo_root = backend_dir.parent

if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

# Set test environment defaults
os.environ.setdefault("TRACE_DIR", str(backend_dir / "test_traces"))
os.environ.setdefault("REPLAY_DIR", str(repo_root / "fixtures" / "replay"))
os.environ.setdefault("DEFAULT_REPLAY_PATH", str(repo_root / "fixtures" / "replay" / "default.json"))
