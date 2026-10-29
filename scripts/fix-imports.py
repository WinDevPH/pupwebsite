from pathlib import Path

line = "import { unreachableServerMessage } from '@/lib/unreachable-server'\n"
root = Path(__file__).resolve().parents[1] / "src"
for path in root.rglob("*.ts"):
    text = path.read_text(encoding="utf-8")
    if line not in text:
        continue
    text = text.replace(line, "")
    path.write_text(line + text, encoding="utf-8")
    print(path.name)
