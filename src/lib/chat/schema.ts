import { z } from "zod";

export const MAX_CHAT_MESSAGES = 50;
export const MAX_CHAT_MESSAGE_CHARS = 4000;

export const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z
    .string()
    .min(1, "content must be a non-empty string")
    .max(
      MAX_CHAT_MESSAGE_CHARS,
      `content must be ${MAX_CHAT_MESSAGE_CHARS} characters or fewer`,
    ),
});

export const ChatRequestSchema = z.object({
  messages: z
    .array(MessageSchema)
    .min(1, "messages must not be empty")
    .max(MAX_CHAT_MESSAGES, `messages must contain ${MAX_CHAT_MESSAGES} items or fewer`),
});
