export const tools = [
  {
    name: "device.get_info",
    description: "Returns battery, OS, and network state for the specified device",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "The ID of the target Android device" }
      },
      required: ["deviceId"]
    }
  },
  {
    name: "notifications.get_unread",
    description: "Fetches unread Android notifications",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "The ID of the target Android device" }
      },
      required: ["deviceId"]
    }
  },
  {
    name: "phone.tap",
    description: "Takes x,y coordinates to tap the screen",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "The ID of the target Android device" },
        x: { type: "number", description: "The X coordinate to tap" },
        y: { type: "number", description: "The Y coordinate to tap" }
      },
      required: ["deviceId", "x", "y"]
    }
  },
  {
    name: "whatsapp.send_message",
    description: "Takes a contact name and message string to send via WhatsApp",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "The ID of the target Android device" },
        contactName: { type: "string", description: "The name of the contact" },
        message: { type: "string", description: "The message to send" }
      },
      required: ["deviceId", "contactName", "message"]
    }
  }
];
