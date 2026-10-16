#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
QUESTIONS="$ROOT/questions"
command -v espeak >/dev/null 2>&1 || { echo "Missing espeak (speech synthesis). Install espeak, then retry." >&2; exit 1; }
command -v ffmpeg >/dev/null 2>&1 || { echo "Missing ffmpeg (MP3 encoding). Install ffmpeg, then retry." >&2; exit 1; }
for n in 01 02 03 04 05; do
  espeak -v en-us+f3 -s 148 -p 48 -a 160 -f "$QUESTIONS/turn-$n.txt" -w "$QUESTIONS/turn-$n.wav"
  ffmpeg -hide_banner -loglevel error -y -i "$QUESTIONS/turn-$n.wav" -ac 1 -ar 16000 -codec:a libmp3lame -b:a 16k -write_xing 0 "$QUESTIONS/turn-$n.mp3"
  rm -f "$QUESTIONS/turn-$n.wav"
done
echo "Generated five MP3 fixtures in $QUESTIONS"
