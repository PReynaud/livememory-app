import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpToolJson } from '../../../server/utils/mcp-log-tools';

type ToolContent = {
  type?: string;
  text?: string;
};

const parseToolJson = (result: { content?: unknown }): McpToolJson => {
  const content = Array.isArray(result.content) ? result.content as ToolContent[] : [];
  const text = content.find(entry => entry.type === 'text')?.text;
  if (!text) {
    throw new Error(`MCP tool returned no JSON text: ${JSON.stringify(result)}`);
  }

  return JSON.parse(text) as McpToolJson;
};

export const callMcpTool = async (
  baseURL: string,
  personalKey: string,
  name: string,
  args: Record<string, unknown> = {}
): Promise<{ json: McpToolJson; isError?: boolean }> => {
  const transport = new StreamableHTTPClientTransport(new URL(`${baseURL.replace(/\/$/, '')}/api/mcp`), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${personalKey}`,
        Accept: 'application/json, text/event-stream'
      }
    }
  });
  const client = new Client({ name: 'livememory-e2e', version: '1.0.0' });
  await client.connect(transport);

  try {
    const result = await client.callTool({ name, arguments: args });
    return {
      json: parseToolJson(result),
      isError: result.isError === true
    };
  } finally {
    await client.close().catch(() => undefined);
  }
};

export const postMcpUnauthorized = async (baseURL: string) => {
  return fetch(`${baseURL.replace(/\/$/, '')}/api/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'livememory-e2e', version: '1.0.0' }
      }
    })
  });
};
