#!/usr/bin/env bash
# Parallel-batch driver for Sergio Aragonés / Mad-margin cartoon JPEGs.
# Copy this file into a project's art/cartoon/ folder alongside _prompts.tsv.
#
# Usage:
#   bash _gen_batch.sh        # generate every JPEG missing from this folder
#
# The companion file _prompts.tsv must live next to this script and contain:
#   name<TAB>subject-prompt-without-style-envelope
# one line per image, no header, no blank lines.
#
# genimg.sh refuses to clobber existing JPEGs, so re-running this regenerates
# only the missing ones. To re-roll a single image: delete its .jpeg, re-run.
#
# Default: 4 jobs in parallel. Tune MAXP if you hit rate limits.

set -uo pipefail

# ---- Configuration -----------------------------------------------------------

# Path to scriptorium's genimg.sh wrapper. Sean's checkout is typically here;
# adjust if you've put scriptorium elsewhere.
GENIMG="${GENIMG:-$HOME/git/scriptorium/scripts/genimg.sh}"

# Output dir = the dir this script lives in.
OUTDIR="$(cd "$(dirname "$0")" && pwd)"

# Parallelism. xAI handles 4 concurrent reasonably; bump if you have headroom.
MAXP="${MAXP:-4}"

# The canonical style envelope. Don't edit casually — it's tuned.
STYLE='Hand-drawn cartoon illustration in the loose frenetic style of Sergio Aragonés Mad Magazine margin doodles — bold dynamic ink linework with variable line weight, exaggerated cartoon figures with bulbous noses and big expressive eyes, action lines, dust clouds, motion smears, sweat droplets, hand-lettered captions integrated into the scene. Full color in classic Mad-magazine cover palette: deep red, mustard yellow, sky blue, leaf green on warm cream paper. NO photo-realism, NO digital smoothness, NO stiff geometric lines.'

# ---- Sanity checks -----------------------------------------------------------

if [ ! -x "$GENIMG" ] && [ ! -f "$GENIMG" ]; then
  echo "ERROR: scriptorium genimg.sh not found at $GENIMG" >&2
  echo "Set GENIMG=/path/to/genimg.sh or move scriptorium to ~/git/scriptorium" >&2
  exit 1
fi

if [ ! -f "$OUTDIR/_prompts.tsv" ]; then
  echo "ERROR: _prompts.tsv not found in $OUTDIR" >&2
  echo "Create it: one line per image, name<TAB>subject-prompt, no header." >&2
  exit 1
fi

# ---- Run ---------------------------------------------------------------------

pids=()
count=0

while IFS=$'\t' read -r name subject; do
  [ -z "${name:-}" ] && continue
  out="$OUTDIR/$name.jpeg"
  if [ -f "$out" ]; then
    echo "[skip-exists] $name"
    continue
  fi
  echo "[start] $name"
  (
    bash "$GENIMG" "$out" "$STYLE $subject" xai > "/tmp/genimg-$name.log" 2>&1
    if [ -s "$out" ]; then
      echo "[done]  $name ($(wc -c < "$out" | tr -d ' ') bytes)"
    else
      echo "[FAIL]  $name — see /tmp/genimg-$name.log"
    fi
  ) &
  pids+=($!)
  count=$((count+1))
  if [ "$count" -ge "$MAXP" ]; then
    wait "${pids[@]}"
    pids=()
    count=0
  fi
done < "$OUTDIR/_prompts.tsv"

# drain remaining
if [ "${#pids[@]}" -gt 0 ]; then
  wait "${pids[@]}"
fi

echo "ALL DONE."
ls -la "$OUTDIR"/*.jpeg 2>/dev/null | wc -l | xargs echo "jpegs in dir:"
