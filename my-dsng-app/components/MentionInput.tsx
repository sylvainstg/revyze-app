import React, { useState, useRef, useEffect } from "react";
import { User, UserRole } from "../types";

interface MentionInputProps {
  value: string;
  onChange: (value: string, mentions: string[]) => void;
  placeholder?: string;
  collaborators: string[]; // List of emails
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  currentUserEmail?: string;
  minHeight?: string;
}

export const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  placeholder,
  collaborators,
  className = "",
  autoFocus = false,
  onKeyDown,
  currentUserEmail,
  minHeight = "80px",
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [query, setQuery] = useState("");
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const [mentions, setMentions] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Filter collaborators: exclude current user, match query
  const suggestions = collaborators
    .filter((email) => email !== currentUserEmail)
    .filter((email) => email.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 5); // Limit to 5 suggestions

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursorPosition = e.target.selectionStart;

    // Check for mention trigger
    const textBeforeCursor = newValue.slice(0, newCursorPosition);
    const lastAtPos = textBeforeCursor.lastIndexOf("@");

    if (lastAtPos !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtPos + 1);
      // Only trigger if no whitespace after @ (or beginning of string)
      // and checking if it looks like a username/email part
      if (!/\s/.test(textAfterAt)) {
        setQuery(textAfterAt);
        setShowSuggestions(true);
        setActiveSuggestionIndex(0);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }

    setCursorPosition(e.target.selectionStart);
    onChange(newValue, Array.from(mentions));
  };

  const handleSelectSuggestion = (email: string) => {
    const textBeforeCursor = value.slice(0, cursorPosition);
    const lastAtPos = textBeforeCursor.lastIndexOf("@");
    const textAfterCursor = value.slice(cursorPosition);

    const prefix = textBeforeCursor.slice(0, lastAtPos);
    // Insert the mention
    const newValue = `${prefix}@${email} ${textAfterCursor}`;

    // Update mentions list
    const newMentions = new Set(mentions);
    newMentions.add(email);
    setMentions(newMentions);

    onChange(newValue, Array.from(newMentions));
    setShowSuggestions(false);

    // Reset focus and cursor
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const newPos = prefix.length + email.length + 2; // +2 for @ and space
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestionIndex(
          (prev) => (prev - 1 + suggestions.length) % suggestions.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelectSuggestion(suggestions[activeSuggestionIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDownInternal}
        placeholder={placeholder}
        className={`w-full p-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-white text-slate-900 placeholder:text-slate-400 ${className}`}
        style={{ minHeight }}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 bottom-full mb-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
          <div className="text-[10px] bg-slate-50 px-3 py-1 text-slate-500 font-medium border-b border-slate-100 uppercase tracking-wider">
            Mention someone
          </div>
          {suggestions.map((email, index) => (
            <button
              key={email}
              onClick={() => handleSelectSuggestion(email)}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-indigo-50 transition-colors ${
                index === activeSuggestionIndex
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-700"
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                {email.charAt(0).toUpperCase()}
              </div>
              <span className="truncate">{email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
