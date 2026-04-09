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
      className="relative rounded-2xl border border-stone-200 bg-white shadow-sm transition focus-within:border-stone-400 focus-within:shadow-md"
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="输入你的问题..."
        rows={3}
        className="w-full resize-none rounded-2xl bg-transparent px-4 pb-12 pt-4 text-sm text-stone-800 outline-none placeholder:text-stone-400"
      />
      <div className="absolute bottom-3 right-3 flex items-center gap-2">
        <button
          type="submit"
          disabled={isLoading || !value.trim()}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-800 text-white transition hover:bg-stone-700 disabled:bg-stone-300 disabled:text-stone-500"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
          </svg>
        </button>
      </div>
    </form>
  );
}
