export const tools = [
  {
    name: "device.list",
    description: "Returns a list of all currently connected Android devices and their deviceIds.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "notifications.get_unread",
    description: "Fetches all unread Android notifications from the device.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "phone.notification",
    description: "Takes an action, id, and optional replyText to interact with a notification.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["dismiss", "reply", "open"] },
        id: { type: "string" },
        replyText: { type: "string" },
      },
      required: ["action", "id"],
    },
  },
  {
    name: "phone.screenshot",
    description: "Captures a screenshot of the current Android device screen and returns it as a Base64 JPEG string.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "phone.open_app",
    description: "Launches an Android application.",
    inputSchema: {
      type: "object",
      properties: {
        packageName: { type: "string", description: "e.g. com.whatsapp" },
      },
      required: ["packageName"],
    },
  },
  {
    name: "phone.tap",
    description: "Taps the screen by text, contentDescription, or exact coordinates.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
        contentDescription: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
      },
    },
  },
  {
    name: "phone.tap_sequence",
    description: "Executes a rapid sequence of physical screen taps in one single operation.",
    inputSchema: {
      type: "object",
      properties: {
        sequence: {
          type: "string",
          description: "Stringified JSON array of tap objects e.g. [{\"x\":120,\"y\":500},{\"x\":450,\"y\":600}]",
        },
      },
      required: ["sequence"],
    },
  },
  {
    name: "phone.type",
    description: "Instantly types a full string of text into the currently focused input field.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
    },
  },
  {
    name: "phone.scroll",
    description: "Scrolls the screen.",
    inputSchema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["forward", "backward", "up", "down"] },
      },
      required: ["direction"],
    },
  },
  {
    name: "phone.back",
    description: "Presses the Android system back button.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "phone.home",
    description: "Presses the Android system home button.",
    inputSchema: { type: "object", properties: {} },
  },
];
