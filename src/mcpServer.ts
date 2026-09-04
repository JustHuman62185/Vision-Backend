import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  isInitializeRequest,
} from "@modelcontextprotocol/sdk/types.js";
import { Express } from "express";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { bridge, activeDevices } from "./bridge";
import { tools } from "./tools";

export const deviceContext = new AsyncLocalStorage<string>();

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

    const deviceId = deviceContext.getStore() || (activeDevices.size > 0 ? activeDevices.keys().next().value : null);
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

  const transports: Record<string, StreamableHTTPServerTransport> = {};
  const sessionToDevice = new Map<string, string>();

  app.use("/mcp", (req, res, next) => {
    let deviceId = req.query.deviceId as string | undefined;
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    // Track the association between the StreamableHTTP session and the deviceId
    if (deviceId && sessionId) {
      sessionToDevice.set(sessionId, deviceId);
    } else if (!deviceId && sessionId) {
      deviceId = sessionToDevice.get(sessionId);
    }

    if (deviceId) {
      deviceContext.run(deviceId, next);
    } else {
      deviceContext.run('', next);
    }
  });

  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid: string) => {
            transports[sid] = transport;
            // Also store initial association if we have deviceId during initialization
            const initDeviceId = req.query.deviceId as string | undefined;
            if (initDeviceId) {
              sessionToDevice.set(sid, initDeviceId);
            }
          }
        });
        
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            delete transports[sid];
            sessionToDevice.delete(sid);
          }
        };

        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided'
          },
          id: null
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error'
          },
          id: null
        });
      }
    }
  });

  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });

  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });
  
  console.log('MCP Streamable HTTP Server endpoints attached at /mcp');
}
