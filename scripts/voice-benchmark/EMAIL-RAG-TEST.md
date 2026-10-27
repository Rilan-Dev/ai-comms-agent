# Realtime voice email-retrieval test

This harness was originally adapted from a reference platform's `scripts/voice-benchmark/conversation.mjs` so the five-turn benchmark can be run from this repository against a voice agent. It records browser request timings and voice latency events; it does **not** itself prove email retrieval is connected or authorized.

## Generate spoken inputs

The five English questions in `questions/turn-01.txt` through `turn-05.txt` form one follow-up sequence. Generate MP3s with:

```bash
bash scripts/voice-benchmark/generate-email-questions.sh
```

This requires `espeak` and `ffmpeg`. The MP3s are mono, 16 kHz, 16 kbps and are decoded through the browser AudioContext by the benchmark. Alternatively, use the generated `questions/turn-*.mp3` files supplied with the test bundle.

## Install the isolated browser dependency

```bash
npm install --prefix scripts/voice-benchmark
npx --prefix scripts/voice-benchmark playwright install chromium
```

On Linux, install the OS libraries required by Playwright Chromium if it reports missing shared libraries.

## Run the five-turn test

Use a URL for an agent that you are authorized to test. The agent page must expose the expected Connect/Start control and the platform's voice latency telemetry event.

```bash
node scripts/voice-benchmark/conversation.mjs \
  --url="https://YOUR-DEPLOYMENT-URL/agents/YOUR-TEST-AGENT-ID" \
  --provider=sarvam \
  --input-1=scripts/voice-benchmark/questions/turn-01.mp3 \
  --input-2=scripts/voice-benchmark/questions/turn-02.mp3 \
  --input-3=scripts/voice-benchmark/questions/turn-03.mp3 \
  --input-4=scripts/voice-benchmark/questions/turn-04.mp3 \
  --input-5=scripts/voice-benchmark/questions/turn-05.mp3 \
  --out=tool-results/email-rag-sarvam.json
```

The `--provider` value is a label, not a provider switch; the agent must already be configured for Sarvam. The output can include request URLs/statuses/timings and latency telemetry, but diagnostics are designed to strip query strings and redact common tokens. Review output before sharing it.

## Questions

1. Find the latest invoice/payment email; report sender, subject and arrival date.
2. Follow up on the same message for amount, invoice number and due date; admit missing fields.
3. Find the latest related reply/follow-up and summarize what it says.
4. Check for a message that changes or contradicts the date/amount and compare sender/date/subject.
5. Give the next action based only on the messages found, citing sender/subject/date and not guessing.

## Security / acceptance boundary

As of the current project-control record, `ISS-026` remains open: the web Chat email-context loader is not yet scoped to the active agent's mailbox grants. The email hybrid retriever is also deliberately not wired into Chat/realtime voice, and the vector adapter/outbox remain unbound. Therefore this harness may test the voice transport and timing, but do **not** treat an answer about emails as proof that ai-comms-agent's email RAG is live, and do not wire email retrieval into user-facing voice until FIX-01 closes ISS-026. A live email-RAG acceptance run still requires an authorized test agent/mailbox, completed ingestion, and OPS-01 runtime isolation/correctness checks.
