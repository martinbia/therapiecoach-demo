#!/usr/bin/env bash
# Conservative integration on top of the actual GitHub 'main' checkout.
# Usage from the existing repository root:
#   bash /tmp/anna-package/therapiecoach-demo/integration/install_into_repo.sh /tmp/anna-package/therapiecoach-demo
set -euo pipefail
SOURCE="${1:-}"
if [[ -z "$SOURCE" || ! -f "$SOURCE/integration/web-fixes.patch" ]]; then
  echo "FEHLER: Als Argument den entpackten Paketordner 'therapiecoach-demo' angeben." >&2; exit 2
fi
if [[ ! -d .git || ! -f web/package.json ]]; then
  echo "FEHLER: Bitte im vorhandenen GitHub-Repository-Root ausfuehren (mit web/)." >&2; exit 2
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "FEHLER: Bitte zuerst eigene Aenderungen committen oder sichern. Nichts geaendert." >&2; exit 3
fi
PATCH="$SOURCE/integration/web-fixes.patch"
if git apply --reverse --check "$PATCH" 2>/dev/null; then
  echo "Frontend-Sicherheitspatch bereits vorhanden (kein erneutes Patchen)."
  APPLY_PATCH=0
elif git apply --check "$PATCH"; then
  echo "Sicherheitspatch passt auf aktuellen GitHub-Stand."
  APPLY_PATCH=1
else
  echo "FEHLER: Der aktuelle web/ Stand weicht vom rekonstruierten Quellstand ab." >&2
  echo "Kein automatisches Ueberschreiben! Bitte neuen main-Stand zur Pruefung liefern." >&2
  exit 4
fi
# Check every target file before applying anything. Existing unlike sources never get replaced.
COPY=(agent worker docs tests integration/README.md integration/install_into_repo.sh integration/web-fixes.patch
  README_INTEGRATION.md DEPLOY_GITHUB.md INSTALL_NOKIA_C22.md TEST_REPORT.md HANDOFF_INTEGRATION.md
  HANDOFF_BACKEND.md HANDOFF_ELEVENLABS.md .gitignore)
while IFS= read -r -d '' file; do
  rel="${file#"$SOURCE/"}"
  if [[ -e "$rel" ]] && ! cmp -s "$file" "$rel"; then
    # Installer/patch may have been updated on a re-run: fail rather than clobber.
    echo "FEHLER: Bestehende Datei mit anderem Inhalt: $rel" >&2
    echo "Nicht automatisch ueberschrieben; bitte Konflikt in Chat 04 pruefen." >&2
    exit 5
  fi
done < <(for item in "${COPY[@]}"; do
  if [[ -d "$SOURCE/$item" ]]; then find "$SOURCE/$item" -type f -print0;
  elif [[ -f "$SOURCE/$item" ]]; then printf '%s\0' "$SOURCE/$item"; fi
done)
for file in "$SOURCE"/web/tests/access.test.ts "$SOURCE"/web/tests/elevenlabs-adapter.test.ts "$SOURCE"/web/tests/sdk-mock-loader.mjs; do
  rel="${file#"$SOURCE/"}"
  if [[ -e "$rel" ]] && ! cmp -s "$file" "$rel"; then
    echo "FEHLER: Bestehender Integrations-Testkonflikt: $rel" >&2; exit 5
  fi
done
if [[ "$APPLY_PATCH" == 1 ]]; then git apply "$PATCH"; fi
for item in "${COPY[@]}"; do
  [[ -e "$SOURCE/$item" ]] || continue
  if [[ -d "$SOURCE/$item" ]]; then
    mkdir -p "$item"
    cp -an "$SOURCE/$item"/. "$item"/
  else
    mkdir -p "$(dirname "$item")"
    cp -n "$SOURCE/$item" "$item"
  fi
done
for file in access.test.ts elevenlabs-adapter.test.ts sdk-mock-loader.mjs; do
  cp -n "$SOURCE/web/tests/$file" "web/tests/$file"
done
echo "OK: Integration gegen den vorhandenen Repository-Stand eingespielt."
echo "Nächster Schritt: git status --short ; dann Code pruefen und committen."
echo "KEIN Deployment, KEINE Cloud-Token, KEINE Kosten von diesem Skript."
