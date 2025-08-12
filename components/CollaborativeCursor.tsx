"use client";

import { useEffect, useState } from "react";
import { CollaborationUser } from "@/lib/collaboration";

interface CollaborativeCursorProps {
  users: CollaborationUser[];
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  currentUserId?: string;
}

export default function CollaborativeCursor({
  users,
  textareaRef,
  currentUserId,
}: CollaborativeCursorProps) {
  const [cursorPositions, setCursorPositions] = useState<
    Map<string, { x: number; y: number; line: number }>
  >(new Map());
  const [textareaMetrics, setTextareaMetrics] = useState<{
    lineHeight: number;
    fontSize: number;
    paddingTop: number;
    paddingLeft: number;
    scrollTop: number;
  } | null>(null);

  // Calculate cursor positions when users or textarea changes
  useEffect(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const computedStyle = window.getComputedStyle(textarea);

    const metrics = {
      lineHeight: parseFloat(computedStyle.lineHeight) || 20,
      fontSize: parseFloat(computedStyle.fontSize) || 14,
      paddingTop: parseFloat(computedStyle.paddingTop) || 0,
      paddingLeft: parseFloat(computedStyle.paddingLeft) || 0,
      scrollTop: textarea.scrollTop,
    };

    setTextareaMetrics(metrics);

    const newPositions = new Map();

    users.forEach((user) => {
      if (user.position !== undefined) {
        // Get the text content up to the cursor position
        const textBeforeCursor = textarea.value.substring(0, user.position);

        // Calculate line number
        const lines = textBeforeCursor.split("\n");
        const lineNumber = lines.length - 1;

        // Get the text on the current line
        const currentLineText = lines[lines.length - 1];

        // Create a temporary span to measure the exact width of the text
        const tempSpan = document.createElement("span");
        tempSpan.style.position = "absolute";
        tempSpan.style.visibility = "hidden";
        tempSpan.style.whiteSpace = "pre";
        tempSpan.style.font = computedStyle.font;
        tempSpan.style.fontFamily = computedStyle.fontFamily;
        tempSpan.style.fontSize = computedStyle.fontSize;
        tempSpan.style.fontWeight = computedStyle.fontWeight;
        tempSpan.style.letterSpacing = computedStyle.letterSpacing;
        tempSpan.style.wordSpacing = computedStyle.wordSpacing;
        tempSpan.style.lineHeight = computedStyle.lineHeight;
        tempSpan.textContent = currentLineText;

        document.body.appendChild(tempSpan);
        const textWidth = tempSpan.offsetWidth;
        document.body.removeChild(tempSpan);

        // Calculate cursor position
        const x = metrics.paddingLeft + textWidth;
        const y =
          metrics.paddingTop +
          lineNumber * metrics.lineHeight -
          metrics.scrollTop;

        newPositions.set(user.userId, { x, y, line: lineNumber });
      }
    });

    setCursorPositions(newPositions);
  }, [users, textareaRef, currentUserId, textareaRef.current?.value]);

  if (!textareaRef.current || !textareaMetrics) return null;

  return (
    <div
      className="absolute inset-0 pointer-events-none z-10"
      style={{
        top: textareaRef.current.offsetTop,
        left: textareaRef.current.offsetLeft,
        width: textareaRef.current.offsetWidth,
        height: textareaRef.current.offsetHeight,
      }}
    >
      {Array.from(cursorPositions.entries()).map(([userId, position]) => {
        const user = users.find((u) => u.userId === userId);
        if (!user) return null;

        const isCurrentUser = user.userId === currentUserId;

        return (
          <div key={userId}>
            {/* Cursor line */}
            <div
              className={`absolute w-0.5 transition-all duration-150 ease-out ${
                isCurrentUser ? "opacity-50" : "opacity-100"
              }`}
              style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                height: `${textareaMetrics.lineHeight}px`,
                backgroundColor: user.color,
                boxShadow: `0 0 4px ${user.color}`,
              }}
            />

            {/* User label */}
            <div
              className={`absolute px-2 py-1 text-xs font-medium text-white rounded shadow-lg transform -translate-y-full -translate-x-1/2 ${
                isCurrentUser ? "opacity-75" : "opacity-100"
              }`}
              style={{
                left: `${position.x}px`,
                top: `${position.y - 4}px`,
                backgroundColor: user.color,
                zIndex: 20,
              }}
            >
              {user.username || user.name}
              {isCurrentUser && <span className="ml-1 text-xs">(you)</span>}
              {user.isTyping && <span className="ml-1 animate-pulse">●</span>}
            </div>

            {/* Selection highlight */}
            {user.selection && user.selection.start !== user.selection.end && (
              <SelectionHighlight
                user={user}
                textareaRef={textareaRef}
                metrics={textareaMetrics}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface SelectionHighlightProps {
  user: CollaborationUser;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  metrics: {
    lineHeight: number;
    fontSize: number;
    paddingTop: number;
    paddingLeft: number;
    scrollTop: number;
  };
}

function SelectionHighlight({
  user,
  textareaRef,
  metrics,
}: SelectionHighlightProps) {
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (!textareaRef.current || !user.selection) return;

    const textarea = textareaRef.current;
    const text = textarea.value;
    const { start, end } = user.selection;

    if (start === end) return;

    const computedStyle = window.getComputedStyle(textarea);

    // Calculate selection boundaries
    const textBeforeStart = text.substring(0, start);
    const textBeforeEnd = text.substring(0, end);

    const linesBeforeStart = textBeforeStart.split("\n");
    const linesBeforeEnd = textBeforeEnd.split("\n");

    const startLine = linesBeforeStart.length - 1;
    const endLine = linesBeforeEnd.length - 1;

    const startLineText = linesBeforeStart[linesBeforeStart.length - 1];
    const endLineText = linesBeforeEnd[linesBeforeEnd.length - 1];

    // Measure start position
    const startSpan = document.createElement("span");
    startSpan.style.position = "absolute";
    startSpan.style.visibility = "hidden";
    startSpan.style.whiteSpace = "pre";
    startSpan.style.font = computedStyle.font;
    startSpan.style.fontFamily = computedStyle.fontFamily;
    startSpan.style.fontSize = computedStyle.fontSize;
    startSpan.style.fontWeight = computedStyle.fontWeight;
    startSpan.style.letterSpacing = computedStyle.letterSpacing;
    startSpan.style.wordSpacing = computedStyle.wordSpacing;
    startSpan.style.lineHeight = computedStyle.lineHeight;
    startSpan.textContent = startLineText;
    document.body.appendChild(startSpan);
    const startX = metrics.paddingLeft + startSpan.offsetWidth;
    document.body.removeChild(startSpan);

    // Measure end position
    const endSpan = document.createElement("span");
    endSpan.style.position = "absolute";
    endSpan.style.visibility = "hidden";
    endSpan.style.whiteSpace = "pre";
    endSpan.style.font = computedStyle.font;
    endSpan.style.fontFamily = computedStyle.fontFamily;
    endSpan.style.fontSize = computedStyle.fontSize;
    endSpan.style.fontWeight = computedStyle.fontWeight;
    endSpan.style.letterSpacing = computedStyle.letterSpacing;
    endSpan.style.wordSpacing = computedStyle.wordSpacing;
    endSpan.style.lineHeight = computedStyle.lineHeight;
    endSpan.textContent = endLineText;
    document.body.appendChild(endSpan);
    const endX = metrics.paddingLeft + endSpan.offsetWidth;
    document.body.removeChild(endSpan);

    const startY =
      metrics.paddingTop + startLine * metrics.lineHeight - metrics.scrollTop;
    const endY =
      metrics.paddingTop + endLine * metrics.lineHeight - metrics.scrollTop;

    setSelectionRect({
      x: Math.min(startX, endX),
      y: Math.min(startY, endY),
      width: Math.abs(endX - startX),
      height: Math.abs(endY - startY) + metrics.lineHeight,
    });
  }, [user.selection, textareaRef, metrics]);

  if (!selectionRect) return null;

  return (
    <div
      className="absolute opacity-20"
      style={{
        left: `${selectionRect.x}px`,
        top: `${selectionRect.y}px`,
        width: `${selectionRect.width}px`,
        height: `${selectionRect.height}px`,
        backgroundColor: user.color,
      }}
    />
  );
}
