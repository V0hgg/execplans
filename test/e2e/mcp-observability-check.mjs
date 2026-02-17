#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function frame(message) {
  const payload = JSON.stringify(message);
  return `Content-Length: ${Buffer.byteLength(payload, "utf8")}\r\n\r\n${payload}`;
}

function parseFrames(buffer) {
  const messages = [];
  let pending = buffer;

  while (true) {
    const headerEnd = pending.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      break;
    }

    const header = pending.slice(0, headerEnd).toString("utf8");
    const contentLengthLine = header
      .split("\r\n")
      .find((line) => line.toLowerCase().startsWith("content-length:"));

    if (!contentLengthLine) {
      throw new Error("Missing Content-Length header in MCP frame");
    }

    const contentLength = Number(contentLengthLine.split(":")[1].trim());
    const messageStart = headerEnd + 4;
    const messageEnd = messageStart + contentLength;
    if (pending.length < messageEnd) {
      break;
    }

    messages.push(JSON.parse(pending.slice(messageStart, messageEnd).toString("utf8")));
    pending = pending.slice(messageEnd);
  }

  return { messages, pending };
}

async function main() {
  const targetRepo = process.argv[2];
  if (!targetRepo) {
    throw new Error("Usage: node test/e2e/mcp-observability-check.mjs <target-repo>");
  }

  const serverPath = path.join(
    targetRepo,
    ".agent",
    "harness",
    "mcp",
    "observability-server",
    "server.mjs",
  );

  const child = spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      OBS_LOGS_URL: "http://127.0.0.1:9428",
      OBS_METRICS_URL: "http://127.0.0.1:8428",
      OBS_TRACES_URL: "http://127.0.0.1:10428",
    },
  });

  let outputBuffer = Buffer.alloc(0);
  let stderrText = "";
  let requestId = 1;
  const responses = new Map();

  child.stdout.on("data", (chunk) => {
    outputBuffer = Buffer.concat([outputBuffer, chunk]);
    const parsed = parseFrames(outputBuffer);
    outputBuffer = parsed.pending;
    for (const message of parsed.messages) {
      if (message.id !== undefined) {
        responses.set(message.id, message);
      }
    }
  });

  child.stderr.on("data", (chunk) => {
    stderrText += chunk.toString("utf8");
  });

  const request = async (method, params) => {
    const id = requestId++;
    child.stdin.write(frame({ jsonrpc: "2.0", id, method, params }));

    const deadline = Date.now() + 10000;
    while (!responses.has(id) && Date.now() < deadline) {
      await sleep(25);
    }

    if (!responses.has(id)) {
      throw new Error(`Timed out waiting for response id=${id}; stderr=${stderrText}`);
    }

    const response = responses.get(id);
    if (response.error) {
      throw new Error(`MCP error for ${method}: ${response.error.message}`);
    }

    return response.result;
  };

  try {
    await request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "e2e-mcp-check", version: "1.0.0" },
    });

    const listResult = await request("tools/list", {});
    const toolNames = (listResult.tools ?? []).map((tool) => tool.name).sort();
    const expectedTools = ["query_logs", "query_metrics", "query_traces"];
    for (const toolName of expectedTools) {
      if (!toolNames.includes(toolName)) {
        throw new Error(`Missing MCP tool: ${toolName} (found: ${toolNames.join(", ")})`);
      }
    }

    const logsResult = await request("tools/call", {
      name: "query_logs",
      arguments: { query: "smoke-log-line", limit: 1 },
    });
    const logsText = logsResult?.content?.[0]?.text ?? "";
    if (!logsText.includes("smoke-log-line")) {
      throw new Error("MCP query_logs did not return smoke-log-line");
    }

    const metricsResult = await request("tools/call", {
      name: "query_metrics",
      arguments: { query: "process_cpu_cores_available" },
    });
    const metricsText = metricsResult?.content?.[0]?.text ?? "";
    if (!metricsText.includes("\"status\":\"success\"")) {
      throw new Error("MCP query_metrics did not return success status");
    }

    let tracesPass = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const tracesResult = await request("tools/call", {
        name: "query_traces",
        arguments: { query: "smoke-service", limit: 1 },
      });

      const tracesText = tracesResult?.content?.[0]?.text ?? "";
      if (tracesText.includes("smoke-service")) {
        tracesPass = true;
        break;
      }

      await sleep(500);
    }

    if (!tracesPass) {
      throw new Error("MCP query_traces did not return smoke-service after retries");
    }

    console.log("[mcp] tools/list: PASS (query_logs, query_metrics, query_traces)");
    console.log("[mcp] query_logs: PASS");
    console.log("[mcp] query_metrics: PASS");
    console.log("[mcp] query_traces: PASS");
  } finally {
    child.kill("SIGTERM");
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
