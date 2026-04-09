"use client";

import { FormEvent, useState } from "react";

interface ChatInputProps {
  isLoading: boolean;
  onSend: (content: string) => Promise<void> | void;
}

export function ChatInput({ isLoading, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const content = value.trim();
    if (!content || isLoading) {
      return;
    }

    setValue("");
    await onSend(content);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-3 rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-sm"
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="输入你的问题，或者先说说你现在的理解..."
        rows={3}
        className="min-h-24 flex-1 resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-amber-300"
      />
      <button
        type="submit"
        disabled={isLoading}
        className="rounded-2xl bg-amber-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-amber-300"
      >
        {isLoading ? "思考中..." : "发送"}
      </button>
    </form>
  );
}
