import type { Message } from "@/lib/types";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${
          isAssistant
            ? "bg-white text-slate-900 border border-slate-200"
            : "bg-slate-900 text-white"
        }`}
      >
        <div className="mb-1 text-xs font-medium opacity-70">
          {isAssistant ? "MindFlow" : "你"}
        </div>
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
