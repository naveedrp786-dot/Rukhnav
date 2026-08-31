#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo "RUKHNAV FINAL LAUNCH CLEANUP"
echo "======================================"

# Run from backend directory.
test -f scripts/production-readiness.js || {
  echo "❌ Run this script from the backend directory."
  exit 1
}

python3 <<'PY'
from pathlib import Path

def replace_in(path, old, new, count=None):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        print(f"⚠️ Already fixed or text not found: {path}")
        return False
    text = text.replace(old, new, count if count is not None else -1)
    p.write_text(text)
    print(f"✅ Updated {path}")
    return True

# 1. Preserve Railway-provided environment variables.
replace_in(
    "scripts/production-readiness.js",
    "override: true",
    "override: false",
    1
)

# 2. Remove fake tax-registration placeholders.
p = Path("controllers/invoiceController.js")
text = p.read_text()
text = text.replace(
    '    website: "www.rukhnav.com",\n\n'
    '    ntm: "NTN: XXXXXXXX",\n\n'
    '    strn: "STRN: XXXXXXXX"\n',
    '    website: "www.rukhnav.com"\n'
)
p.write_text(text)
print("✅ Removed placeholder NTN/STRN from invoice company data")

# 3. Domain-neutral popup messages.
replacements = {
    "public/admin/js/purchases.js":
        ("Print window was blocked. Please allow popups for localhost:3000.",
         "Print window was blocked. Please allow popups for this website."),
    "public/admin/js/stockAdjustments.js":
        ("Please allow popups for localhost:3000.",
         "Please allow popups for this website."),
    "public/admin/js/purchaseReturns.js":
        ("Please allow popups for localhost:3000.",
         "Please allow popups for this website."),
    "public/admin/js/supplierPayments.js":
        ("Please allow popups for localhost:3000.",
         "Please allow popups for this website."),
}
for path, (old, new) in replacements.items():
    replace_in(path, old, new)

# 4. Make manual wallet verification explicit in live checkout.
for path in ("public/store/js/checkout.js", "public/store/js/guest-checkout.js"):
    p = Path(path)
    text = p.read_text()
    text = text.replace(
        "Transfer to the Easypaisa account configured by RUKHNAV, then enter the payment phone and transaction reference.",
        "Manual verification: transfer to the Easypaisa account provided by RUKHNAV, then enter the payment phone and transaction reference. Your order remains pending until the payment is verified."
    )
    text = text.replace(
        "Transfer to the JazzCash account configured by RUKHNAV, then enter the payment phone and transaction reference.",
        "Manual verification: transfer to the JazzCash account provided by RUKHNAV, then enter the payment phone and transaction reference. Your order remains pending until the payment is verified."
    )
    p.write_text(text)
    print(f"✅ Clarified manual payment verification in {path}")

# 5. Protect local backup artifacts from accidental commits.
gitignore = Path("../.gitignore")
if not gitignore.exists():
    gitignore = Path(".gitignore")

text = gitignore.read_text()
block = """
# RUKHNAV local safety snapshots
*.backup-before-*
*.backup-*
*.stage2-backup
"""
if "*.backup-before-*" not in text:
    text = text.rstrip() + "\n" + block
    gitignore.write_text(text)
    print(f"✅ Strengthened {gitignore}")
else:
    print("✅ Backup ignore protection already present")
PY

echo
echo "======================================"
echo "VERIFY"
echo "======================================"

node --check scripts/production-readiness.js
node --check controllers/invoiceController.js
node --check public/admin/js/purchases.js
node --check public/admin/js/stockAdjustments.js
node --check public/admin/js/purchaseReturns.js
node --check public/admin/js/supplierPayments.js
node --check public/store/js/checkout.js
node --check public/store/js/guest-checkout.js

if rg -n 'localhost:3000' \
  public/admin/js/purchases.js \
  public/admin/js/stockAdjustments.js \
  public/admin/js/purchaseReturns.js \
  public/admin/js/supplierPayments.js; then
  echo "❌ localhost popup text still exists"
  exit 1
else
  echo "✅ Production popup wording clean"
fi

if rg -n 'NTN: XXXXXXXX|STRN: XXXXXXXX' controllers/invoiceController.js; then
  echo "❌ Invoice tax placeholders still exist"
  exit 1
else
  echo "✅ Invoice placeholders removed"
fi

git diff --check
echo "✅ Final cleanup diff is clean"

echo
echo "======================================"
echo "LIVE CHANGES"
echo "======================================"
git status --short | grep -E \
'production-readiness|invoiceController|purchases\.js|stockAdjustments|purchaseReturns|supplierPayments|checkout\.js|guest-checkout|\.gitignore' || true

echo
echo "======================================"
echo "NEXT"
echo "======================================"
echo "Review the output above. Do not stage backup files."
