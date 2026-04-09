import type { Message } from "@/lib/types";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";

  return (
    <div className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${
          isAssistant
            ? "border border-amber-100 bg-amber-50/70 text-slate-800"
            : "bg-slate-800 text-slate-100"
        }`}
      >
        <div className="mb-1 text-xs font-semibold opacity-75">
          {isAssistant ? "MindFlow 导师" : "你"}
        </div>
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}
