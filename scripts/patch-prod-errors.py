from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]

php_pat = re.compile(
    r"\} catch \(Throwable \$error\) \{\s*"
    r"api_json\(\[\s*"
    r"'ok' => false,\s*"
    r"'error' => '[^']+',\s*"
    r"'detail' => \$error->getMessage\(\),\s*"
    r"\], 503\);\s*\}"
)

for path in (root / "api").rglob("*.php"):
    text = path.read_text(encoding="utf-8")
    new = php_pat.sub("} catch (Throwable $error) {\n    api_json_db_error($error);\n}", text)
    if new != text:
        path.write_text(new, encoding="utf-8")
        print("php", path.relative_to(root))

old = "error: 'Cannot reach the server. Start Apache and MySQL in XAMPP.',"
imp = "import { unreachableServerMessage } from '@/lib/unreachable-server'\n"

for path in (root / "src").rglob("*.ts"):
    text = path.read_text(encoding="utf-8")
    if old not in text:
        continue
    new = text.replace(old, "error: unreachableServerMessage(),")
    if imp.strip() not in new:
        lines = new.splitlines(keepends=True)
        last_imp = 0
        for i, line in enumerate(lines):
            if line.startswith("import "):
                last_imp = i
        lines.insert(last_imp + 1, imp)
        new = "".join(lines)
    path.write_text(new, encoding="utf-8")
    print("ts", path.relative_to(root))
