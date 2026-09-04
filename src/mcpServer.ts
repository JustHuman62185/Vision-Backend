import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Express } from "express";
import { randomUUID } from "node:crypto";
import { bridge, activeDevices } from "./bridge";
import { tools } from "./tools";

export function setupMcpServer(app: Express) {
  // 1. Deflect auto-discovery requests so Claude does not expect an OAuth server
  app.get("/.well-known/*", (req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // 2. Add simple Bearer Auth
  app.use("/mcp", (req, res, next) => {
    if (req.method === 'OPTIONS') {
      return next();
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== "Bearer vision-admin-123") {
      res.status(401).json({ error: "Unauthorized. Please use Bearer Token: vision-admin-123" });
      return;
    }
    next();
  });

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

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID()
  });

  server.connect(transport).then(() => {
    console.log("MCP Streamable HTTP Server connected to transport");
  }).catch((err) => {
    console.error("Failed to connect MCP server to transport", err);
  });

  app.post("/mcp", async (req, res) => {
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/mcp", async (req, res) => {
    await transport.handleRequest(req, res);
  });

  console.log('MCP Streamable HTTP Server endpoints attached at /mcp with Bearer Auth');
}
