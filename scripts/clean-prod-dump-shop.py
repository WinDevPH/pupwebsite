from pathlib import Path
import re
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\HomePC\Downloads\u785185569_pup_db (1).sql")
text = path.read_text(encoding="utf-8")
pattern = re.compile(r"(, '[A-E]-\d{2}'), 'out',")
next_text, count = pattern.subn(r"\1, NULL,", text)
path.write_text(next_text, encoding="utf-8")
print(f"cleared locker out flags: {count}")
print(f"wrote {path}")
