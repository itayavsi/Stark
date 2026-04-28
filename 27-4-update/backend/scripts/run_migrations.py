from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from services.migrations import run_migrations


def main() -> None:
    run_migrations()
    print("Alembic migrations applied successfully.")


if __name__ == "__main__":
    main()
