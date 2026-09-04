import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Express } from "express";
import { bridge, activeDevices } from "./bridge";
import { tools } from "./tools";

export function setupMcpServer(app: Express) {
  const server = new Server(
    {
      name: "vision-mcp-bridge",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    if (name === 'device.list') {
      const devices = bridge.getConnectedDevices();
      return {
        content: [{ type: "text", text: JSON.stringify(devices, null, 2) }],
        isError: false,
      };
    }

    const deviceId = activeDevices.size > 0 ? activeDevices.keys().next().value : null;
    if (!deviceId) {
      throw new Error("No deviceId found and no devices currently connected.");
    }

    try {
      const result = await bridge.executeOnDevice(deviceId, name, args);
      return {
        content: [{ type: "text", text: typeof result === 'string' ? result : JSON.stringify(result) }],
        isError: false,
      };
    } catch (e: any) {
      return {
        content: [{ type: "text", text: `Error executing on device: ${e.message}` }],
        isError: true,
      };
    }
  });

  const transports = new Map<string, SSEServerTransport>();

  app.get("/mcp", async (req, res) => {
    const transport = new SSEServerTransport("/mcp/message", res);
    transports.set(transport.sessionId, transport);
    
    res.on("close", () => {
      transports.delete(transport.sessionId);
    });

    await server.connect(transport);
  });

  app.post("/mcp/message", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);
    if (!transport) {
      res.status(404).send("Session not found");
      return;
    }
    await transport.handlePostMessage(req, res);
  });
  
  console.log('MCP SSE Server endpoints attached at GET /mcp and POST /mcp/message');
}
