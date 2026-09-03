export const tools = [
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
  },
  {
    name: "phone.tap",
    description: "Takes x,y coordinates, text, or contentDescription to tap the screen",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "The ID of the target Android device" },
        x: { type: "number", description: "The X coordinate to tap" },
        y: { type: "number", description: "The Y coordinate to tap" },
        text: { type: "string", description: "The text of the element to tap" },
        contentDescription: { type: "string", description: "The content description of the element to tap" }
      },
      required: ["deviceId"]
    }
  },
  {
    name: "phone.notification",
    description: "Takes an action, id, and optional replyText to interact with a notification",
    inputSchema: {
      type: "object",
      properties: {
        deviceId: { type: "string", description: "The ID of the target Android device" },
        action: { type: "string", enum: ["read", "dismiss", "reply"], description: "The action to perform" },
        id: { type: "string", description: "The ID of the notification" },
        replyText: { type: "string", description: "The text to reply with, if action is reply" }
      },
      required: ["deviceId", "action", "id"]
    }
  }
];
