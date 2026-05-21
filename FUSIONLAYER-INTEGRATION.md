# FusionLayer Memory Integration for Continue.dev

This branch demonstrates integrating FusionLayer memory into Continue.dev via the `@fusionlayer/continue-provider` npm package.

## Setup

1. Install the provider:
   ```bash
   npm install @fusionlayer/continue-provider
   ```

2. Add to `.continue/config.json`:
   ```json
   {
     "contextProviders": [
       {
         "name": "fusionlayer-memory",
         "params": {
           "endpoint": "http://localhost:10999",
           "maxItems": 5,
           "minRelevance": 0.72
         }
       }
     ],
     "mcpServers": [
       {
         "name": "fusionlayer",
         "transport": {
           "type": "sse",
           "url": "http://localhost:10999/mcp"
         }
       }
     ]
   }
   ```

3. Start the FusionLayer daemon before using Continue.

## How it works

- **Read path:** Before each message, Continue queries the FusionLayer daemon for relevant memory artifacts. Top-5 by relevance (cosine similarity ≥ 0.72) are injected as context.
- **Write path:** After each turn, conversation summaries are captured as UACP-Memory artifacts via the MCP server.

## Requirements

- FusionLayer daemon running on `localhost:10999`
- `@fusionlayer/continue-provider` ≥ 0.1.0

## Source

Provider implementation: `hn2/fusionlayer/packages/continue-provider`
Spec: `hn2/fusionlayer/docs/integrations/CONTINUE-DEV-INTEGRATION-SPEC-2026.md`
