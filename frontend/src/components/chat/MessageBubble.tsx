import type { Message } from "@/lib/types";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";

  return (
    <div className="flex gap-3">
      <div
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
          isAssistant ? "bg-[#C67A4A]" : "bg-stone-500"
        }`}
      >
        {isAssistant ? "M" : "U"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap text-[15px] leading-7 text-stone-800">
          {message.content}
        </p>
      </div>
    </div>
  );
}
