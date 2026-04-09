import type { Message } from "@/lib/types";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";

  return (
    <div className="flex gap-3">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${
          isAssistant ? "bg-[#D4A574]" : "bg-stone-600"
        }`}
      >
        {isAssistant ? "M" : "U"}
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-1 text-xs font-medium text-stone-500">
          {isAssistant ? "MindFlow" : "你"}
        </div>
        <div className="text-sm leading-7 text-stone-800">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    </div>
  );
}
