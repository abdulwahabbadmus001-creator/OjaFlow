from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent

for path_str in (str(REPO_ROOT), str(BACKEND_DIR)):
    if path_str not in sys.path:
        sys.path.insert(0, path_str)
