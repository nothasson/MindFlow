"use client";

import { FormEvent, useState, KeyboardEvent } from "react";

interface ChatInputProps {
  isLoading: boolean;
  onSend: (content: string) => Promise<void> | void;
}

export function ChatInput({ isLoading, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const submit = async () => {
    const content = value.trim();
    if (!content || isLoading) return;
    setValue("");
    await onSend(content);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="relative rounded-2xl bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]"
    >
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="有什么想学的？"
        rows={2}
        className="w-full resize-none rounded-2xl bg-transparent px-5 pb-14 pt-5 text-base text-stone-800 outline-none placeholder:text-stone-400"
      />
      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-400">MindFlow</span>
          <button
            type="submit"
            disabled={isLoading || !value.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-stone-800 text-white transition hover:bg-stone-700 disabled:bg-stone-200 disabled:text-stone-400"
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
      </div>
    </form>
  );
}
