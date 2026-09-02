import { WebSocket } from 'ws';
import { analytics } from './analytics';

export interface DeviceProfile {
  deviceId: string;
  name?: string;
  os?: string;
  ip?: string;
  capabilities?: string[];
}

interface ConnectedDevice extends DeviceProfile {
  ws: WebSocket;
}

export class Bridge {
  private connections = new Map<string, ConnectedDevice>();
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void; timeout: NodeJS.Timeout; startTime: number }>();

  constructor() {
    setInterval(() => {
      if (analytics.checkAndResetActivity()) {
        this.broadcastAnalytics();
      }
    }, 2000);
  }

  registerDevice(profile: DeviceProfile, ws: WebSocket) {
    this.connections.set(profile.deviceId, { ...profile, ws });
    console.log(`Device registered: ${profile.deviceId} (${profile.name || 'Unknown'})`);

    ws.on('close', () => {
      if (this.connections.get(profile.deviceId)?.ws === ws) {
        this.connections.delete(profile.deviceId);
        console.log(`Device disconnected: ${profile.deviceId}`);
      }
    });
  }

  handleMessage(deviceId: string, data: any, rawBytes: number = 0) {
    if (data.type === 'tool_result' && data.id) {
      const req = this.pendingRequests.get(data.id);
      if (req) {
        clearTimeout(req.timeout);
        const latency = Date.now() - req.startTime;
        analytics.recordSuccess(latency, rawBytes);
        req.resolve(data.result);
        this.pendingRequests.delete(data.id);
        this.broadcastAnalytics();
      }
    } else if (data.type === 'tool_error' && data.id) {
      const req = this.pendingRequests.get(data.id);
      if (req) {
        clearTimeout(req.timeout);
        analytics.recordError(rawBytes);
        req.reject(new Error(data.error || 'Unknown error from device'));
        this.pendingRequests.delete(data.id);
        this.broadcastAnalytics();
      }
    }
  }

  async executeOnDevice(deviceId: string, toolName: string, args: any): Promise<any> {
    const device = this.connections.get(deviceId);
    if (!device) {
      throw new Error(`Device ${deviceId} not connected`);
    }

    const id = `req-${Math.random().toString(36).substring(2, 11)}`;
    const payload = {
      type: 'tool_call',
      id,
      tool: toolName,
      args,
    };
    const payloadString = JSON.stringify(payload);
    const bytesSent = Buffer.byteLength(payloadString, 'utf8');
    analytics.recordRequest(bytesSent);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        analytics.recordError();
        analytics.recordAlert(`Timeout waiting for ${toolName} on ${deviceId}`, 'WARNING');
        reject(new Error(`Timeout waiting for response from ${deviceId} for tool ${toolName}`));
      }, 30000); // 30s timeout

      this.pendingRequests.set(id, { resolve, reject, timeout, startTime: Date.now() });

      device.ws.send(payloadString, (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          analytics.recordError();
          reject(err);
        }
      });
    });
  }

  getConnectedDevices(): DeviceProfile[] {
    return Array.from(this.connections.values()).map(({ ws, ...profile }) => profile);
  }

  broadcastAnalytics() {
    const payload = JSON.stringify({
      type: "analytics_update",
      data: analytics.getSummary()
    });
    for (const device of this.connections.values()) {
      if (device.ws.readyState === WebSocket.OPEN) {
        device.ws.send(payload);
      }
    }
  }
}

export const bridge = new Bridge();
