import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express, { Express } from "express";
import { randomUUID } from "node:crypto";
import { bridge, activeDevices } from "./bridge";
import { tools } from "./tools";

export function setupMcpServer(app: Express) {
  // --- Mock OAuth 2.1 Server for Claude.ai ---
  app.get("/.well-known/oauth-authorization-server", (req, res) => {
    const baseUrl = `https://${req.get("host")}`;
    res.json({
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      scopes_supported: ["mcp"],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post", "none"],
    });
  });

  app.post("/oauth/register", (req, res) => {
    res.status(201).json({
      client_id: "vision_client_" + randomUUID(),
      client_secret: "vision_secret_" + randomUUID(),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0,
      grant_types: ["authorization_code", "refresh_token"],
      redirect_uris: req.body?.redirect_uris || [],
      client_name: req.body?.client_name || "Claude Web",
    });
  });

  app.get("/oauth/authorize", (req, res) => {
    const { redirect_uri, state } = req.query;
    if (!redirect_uri) {
      res.status(400).send("Missing redirect_uri");
      return;
    }
    const code = "vision_code_" + randomUUID();
    const url = new URL(redirect_uri as string);
    url.searchParams.set("code", code);
    if (state) url.searchParams.set("state", state as string);
    res.redirect(url.toString());
  });

  app.post("/oauth/token", express.urlencoded({ extended: true }), (req, res) => {
    res.json({
      access_token: "vision_token_" + randomUUID(),
      token_type: "Bearer",
      expires_in: 31536000,
      refresh_token: "vision_refresh_" + randomUUID(),
    });
  });

  // Bearer token check for /mcp paths
  app.use("/mcp", (req, res, next) => {
    if (req.method === 'OPTIONS') return next();
    next();
  });

  // --- MCP Server Setup (SSE Transport) ---
  const transports = new Map<string, SSEServerTransport>();

  // GET /mcp initiates the SSE connection
  app.get("/mcp", async (req, res) => {
    try {
      // 1. Create a transport for this specific connection
      const transport = new SSEServerTransport("/mcp/message", res);
      transports.set(transport.sessionId, transport);

      // 2. Create a fresh MCP Server instance tied to this connection
      const mcpServer = new Server(
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

      // 3. Register handlers for this instance
      mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools: tools };
      });

      mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
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

      // 4. Clean up when connection closes
      req.on("close", () => {
        transports.delete(transport.sessionId);
      });

      // 5. Connect the server to the transport
      await mcpServer.connect(transport);
      console.log(`New MCP SSE connection established. Session: ${transport.sessionId}`);

    } catch (error) {
      console.error("Failed to establish SSE connection", error);
      if (!res.headersSent) res.status(500).send("Internal Server Error");
    }
  });

  // POST /mcp/message handles all incoming JSON-RPC messages for an established session
  app.post("/mcp/message", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.get(sessionId);
    
    if (!transport) {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }

    try {
      await transport.handlePostMessage(req, res);
    } catch (error) {
      console.error("Error handling POST message:", error);
      if (!res.headersSent) res.status(500).json({ error: "Internal error processing message" });
    }
  });

  console.log('MCP SSE Server endpoints attached at GET /mcp and POST /mcp/message');
}
