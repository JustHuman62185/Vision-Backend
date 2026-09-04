import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from 'express';

const app = express();
const server = new Server({ name: "test", version: "1" }, { capabilities: {} });

app.get("/mcp", async (req, res) => {
  try {
    console.log('Connecting new transport');
    const transport = new SSEServerTransport("/mcp/message", res);
    await server.connect(transport);
    console.log('Connected');
  } catch (err) {
    console.error('Error in connect:', err.message);
    res.status(500).send(err.message);
  }
});

app.listen(3002, () => console.log('Listening 3002'));
