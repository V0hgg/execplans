import { stdin, stdout, stderr } from "node:process";

const LOGS_URL = process.env.OBS_LOGS_URL ?? "http://127.0.0.1:9428";
const METRICS_URL = process.env.OBS_METRICS_URL ?? "http://127.0.0.1:8428";
const TRACES_URL = process.env.OBS_TRACES_URL ?? "http://127.0.0.1:10428";

const TOOLS = [
  {
    name: "query_logs",
    description: "Run a LogsQL query against local VictoriaLogs.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number", minimum: 1, maximum: 500 },
      },
      required: ["query"],
    },
  },
  {
    name: "query_metrics",
    description: "Run a PromQL/MetricsQL query against local VictoriaMetrics.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "query_traces",
    description: "Run a trace query against local VictoriaTraces (LogsQL-compatible adapter).",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number", minimum: 1, maximum: 500 },
      },
      required: ["query"],
    },
  },
];

function writeMessage(message) {
  const payload = JSON.stringify(message);
  const framed = `Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`;
  stdout.write(framed);
}

function asTextResult(text) {
  return { content: [{ type: "text", text }] };
}

async function postForm(url, params) {
  const body = new URLSearchParams(params).toString();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}: ${text}`);
  }

  return text;
}

async function queryLogs(args) {
  const limit = String(args.limit ?? 20);
  return postForm(`${LOGS_URL}/select/logsql/query`, { query: String(args.query), limit });
}

async function queryMetrics(args) {
  return postForm(`${METRICS_URL}/prometheus/api/v1/query`, { query: String(args.query) });
}

async function queryTraces(args) {
  const limit = String(args.limit ?? 20);
  return postForm(`${TRACES_URL}/select/logsql/query`, { query: String(args.query), limit });
}

async function handleRequest(request) {
  if (request.method === "initialize") {
    return {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "observability-mcp-server",
        version: "0.0.1",
      },
    };
  }

  if (request.method === "tools/list") {
    return { tools: TOOLS };
  }

  if (request.method === "tools/call") {
    const name = request.params?.name;
    const args = request.params?.arguments ?? {};

    let output;
    if (name === "query_logs") {
      output = await queryLogs(args);
    } else if (name === "query_metrics") {
      output = await queryMetrics(args);
    } else if (name === "query_traces") {
      output = await queryTraces(args);
    } else {
      throw new Error(`Unknown tool: ${name}`);
    }

    return asTextResult(output);
  }

  if (request.method === "notifications/initialized") {
    return null;
  }

  throw new Error(`Unsupported method: ${request.method}`);
}

let buffer = Buffer.alloc(0);

function tryReadFrame() {
  const headerEnd = buffer.indexOf("\r\n\r\n");
  if (headerEnd === -1) {
    return null;
  }

  const headerText = buffer.slice(0, headerEnd).toString("utf8");
  const contentLengthHeader = headerText
    .split("\r\n")
    .find((line) => line.toLowerCase().startsWith("content-length:"));

  if (!contentLengthHeader) {
    throw new Error("Missing Content-Length header");
  }

  const contentLength = Number(contentLengthHeader.split(":")[1].trim());
  const frameStart = headerEnd + 4;
  const frameEnd = frameStart + contentLength;

  if (buffer.length < frameEnd) {
    return null;
  }

  const json = buffer.slice(frameStart, frameEnd).toString("utf8");
  buffer = buffer.slice(frameEnd);

  return JSON.parse(json);
}

stdin.on("data", async (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);

  while (true) {
    let message;
    try {
      message = tryReadFrame();
    } catch (error) {
      stderr.write(`Failed to parse frame: ${String(error)}\n`);
      return;
    }

    if (!message) {
      break;
    }

    if (message.id === undefined) {
      continue;
    }

    try {
      const result = await handleRequest(message);
      writeMessage({ jsonrpc: "2.0", id: message.id, result });
    } catch (error) {
      writeMessage({
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
});
