"use client";

import { useState } from "react";
import { CollaborationUser } from "@/lib/collaboration";

interface CollaborationUIProps {
  users: CollaborationUser[];
  onUserClick?: (user: CollaborationUser) => void;
}

export default function CollaborationUI({
  users,
  onUserClick,
}: CollaborationUIProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (users.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Collaboration indicator */}
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-gray-900">
            Collaborators ({users.length})
          </h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className={`w-4 h-4 transition-transform ${
                isExpanded ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {isExpanded && (
          <div className="space-y-2">
            {users.map((user) => (
              <div
                key={user.socketId}
                className="flex items-center space-x-2 p-2 rounded-md hover:bg-gray-50 cursor-pointer"
                onClick={() => onUserClick?.(user)}
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: user.color }}
                />
                <span className="text-sm text-gray-700 truncate">
                  {user.name}
                </span>
                {user.isTyping && (
                  <span className="text-xs text-gray-500 italic">
                    typing...
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Always visible user avatars */}
        <div className="flex -space-x-2">
          {users.slice(0, 3).map((user) => (
            <div
              key={user.socketId}
              className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white"
              style={{ backgroundColor: user.color }}
              title={user.name}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
          ))}
          {users.length > 3 && (
            <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-300 flex items-center justify-center text-xs font-medium text-gray-600">
              +{users.length - 3}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Cursor component for showing other users' cursors
export function UserCursor({ user }: { user: CollaborationUser }) {
  if (user.position === undefined) return null;

  return (
    <div
      className="absolute pointer-events-none z-10"
      style={{
        left: `${user.position * 8}px`, // Approximate character width
        top: "0px",
      }}
    >
      <div className="w-0.5 h-6" style={{ backgroundColor: user.color }} />
      <div
        className="absolute -top-6 left-0 px-2 py-1 rounded text-xs text-white whitespace-nowrap"
        style={{ backgroundColor: user.color }}
      >
        {user.name}
      </div>
    </div>
  );
}

// Selection highlight component
export function UserSelection({ user }: { user: CollaborationUser }) {
  if (!user.selection) return null;

  const { start, end } = user.selection;
  const width = (end - start) * 8; // Approximate character width

  return (
    <div
      className="absolute pointer-events-none z-5 opacity-20"
      style={{
        left: `${start * 8}px`,
        top: "0px",
        width: `${width}px`,
        height: "1.5rem",
        backgroundColor: user.color,
      }}
    />
  );
}
