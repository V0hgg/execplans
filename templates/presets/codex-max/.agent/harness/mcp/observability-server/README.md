# Observability MCP Server

This server exposes three MCP tools for local observability queries:

- `query_logs`
- `query_metrics`
- `query_traces`

The server uses stdio JSON-RPC and is launched by Codex via `.codex/config.toml`.
