---
name: ui-legibility
description: Inspect a running UI with Chrome DevTools MCP using navigation, DOM snapshots, and screenshots.
---
When invoked:
1) Start the worktree runtime with `.agent/harness/worktree/up.sh`.
2) Use the `chrome_devtools` MCP server to navigate to `http://127.0.0.1:$APP_PORT`.
3) Capture DOM snapshots before and after actions to verify structural changes.
4) Capture screenshots for visual regressions and include file paths in findings.
5) Stop the runtime with `.agent/harness/worktree/down.sh` when done.
