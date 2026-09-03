import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { bridge, DeviceProfile } from './bridge';

export function setupWsServer(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    let registeredDeviceId: string | null = null;

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'register' && data.deviceId && data.secretId) {
          registeredDeviceId = data.deviceId;
          const profile: DeviceProfile = {
            secretId: data.secretId,
            deviceId: data.deviceId,
            name: data.deviceName || data.name,
            os: data.os,
            ip: data.ip,
            capabilities: data.capabilities
          };
          bridge.registerDevice(profile, ws);
        } else if (data.type === 'register') {
          console.error('Invalid register payload, missing deviceId or secretId');
          ws.close();
        } else if (registeredDeviceId) {
          const rawBytes = Buffer.byteLength(message.toString(), 'utf8');
          bridge.handleMessage(registeredDeviceId, data, rawBytes);
        }
      } catch (e) {
        console.error('Invalid WS message', e);
      }
    });
  });

  console.log('WebSocket server attached at /ws');
}
