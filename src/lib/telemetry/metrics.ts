interface CounterMap {
  [key: string]: number;
}

interface LatencyMap {
  [key: string]: number[];
}

const counters: CounterMap = {};
const latencies: LatencyMap = {};

function inc(name: string, amount = 1) {
  counters[name] = (counters[name] ?? 0) + amount;
}

function observe(name: string, value: number) {
  if (!latencies[name]) latencies[name] = [];
  latencies[name].push(value);
  if (latencies[name].length > 500) {
    latencies[name] = latencies[name].slice(-500);
  }
}

export function recordAskMetrics(input: {
  latencyMs: number;
  retrievalStrategy: "hybrid" | "lexical_only";
  citationFailures: number;
  verdict: "trustworthy" | "caution" | "unreliable";
}) {
  inc("ask_requests_total");
  inc(`retrieval_strategy_${input.retrievalStrategy}_total`);
  inc(`audit_verdict_${input.verdict}_total`);
  if (input.citationFailures > 0) {
    inc("citation_failures_total", input.citationFailures);
  }
  observe("ask_latency_ms", input.latencyMs);
}

export function snapshotMetrics() {
  const p95 = (values: number[]) => {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    return sorted[index];
  };
  return {
    counters,
    latencies: {
      ask_latency_ms: {
        count: latencies.ask_latency_ms?.length ?? 0,
        p95: p95(latencies.ask_latency_ms ?? [])
      }
    }
  };
}
