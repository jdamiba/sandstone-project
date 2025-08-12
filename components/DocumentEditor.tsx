"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Document } from "@/types/database";

import { useCollaboration, CollaborationUser } from "@/lib/collaboration";
import CollaborationUI from "./CollaborationUI";
import CollaborativeCursor from "./CollaborativeCursor";

// Extend Window interface to include our global function
declare global {
  interface Window {
    refreshDocumentsList?: () => void;
  }
}

interface DocumentEditorProps {
  document: Document;
  currentUser?: { id: string; first_name?: string; last_name?: string };
  onSave?: (updatedDocument: Partial<Document>) => void;
  onCancel?: () => void;
}

export default function DocumentEditor({
  document,
  currentUser,
  onSave,
  onCancel,
}: DocumentEditorProps) {
  const router = useRouter();
  const collaboration = useCollaboration();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [collaborators, setCollaborators] = useState<CollaborationUser[]>([]);
  const [formData, setFormData] = useState({
    title: document.title,
    content: document.content,
    description: document.description || "",
    tags: document.tags?.join(", ") || "",
    is_public: document.is_public,
    allow_comments: document.allow_comments,
    allow_suggestions: document.allow_suggestions,
    require_approval: document.require_approval,
  });
  const [hasChanges, setHasChanges] = useState(false);
  const [currentContent, setCurrentContent] = useState(document.content);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const collaborationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cursorTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check if current user has edit permissions
  // Public documents can be edited by any logged-in user
  const hasEditPermissions =
    currentUser && (document.owner_id === currentUser.id || document.is_public);

  // Handle cursor updates with useCallback to prevent unnecessary re-renders
  const handleCursorUpdate = useCallback(() => {
    if (!contentRef.current || !isEditing || !currentUser) return;

    const textarea = contentRef.current;
    const position = textarea.selectionStart;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;

    // Send cursor position to collaboration server
    collaboration.updateCursor(
      position,
      selectionStart !== selectionEnd
        ? { start: selectionStart, end: selectionEnd }
        : undefined,
      currentUser.first_name ||
        currentUser.last_name ||
        `User ${currentUser.id.slice(0, 8)}`
    );
  }, [isEditing, currentUser, collaboration]);

  // Check for changes
  useEffect(() => {
    const originalData = {
      title: document.title,
      content: currentContent,
      description: document.description || "",
      tags: document.tags?.join(", ") || "",
      is_public: document.is_public,
      allow_comments: document.allow_comments,
      allow_suggestions: document.allow_suggestions,
      require_approval: document.require_approval,
    };

    const changed = Object.keys(formData).some(
      (key) =>
        formData[key as keyof typeof formData] !==
        originalData[key as keyof typeof originalData]
    );

    setHasChanges(changed);

    console.log("Change detection - currentContent:", currentContent);
    console.log("Change detection - formData.content:", formData.content);
    console.log("Change detection - hasChanges:", changed);
  }, [formData, document, currentContent]);

  // Setup collaboration
  useEffect(() => {
    if (isEditing && currentUser) {
      // Join document collaboration with current user's ID
      collaboration.joinDocument(document.id, currentUser.id);

      // Setup event handlers
      collaboration.setUserUpdateCallback((users) => {
        setCollaborators(users);
      });

      collaboration.setDocumentUpdateCallback((documentState) => {
        console.log(
          "Received document update from collaboration:",
          documentState
        );
        // Update the form data with the new content from other users
        setFormData((prev) => ({
          ...prev,
          content: documentState.content,
        }));
        setCurrentContent(documentState.content);
        setHasChanges(false);
        setLastSaved(new Date());
      });

      collaboration.setErrorCallback((error) => {
        console.error("Collaboration error:", error);
      });

      // Send initial cursor position after a short delay to ensure connection is established
      setTimeout(() => {
        if (contentRef.current) {
          handleCursorUpdate();
        }
      }, 100);

      return () => {
        collaboration.leaveDocument();
        if (collaborationTimeoutRef.current) {
          clearTimeout(collaborationTimeoutRef.current);
        }
        if (cursorTimeoutRef.current) {
          clearTimeout(cursorTimeoutRef.current);
        }
      };
    }
  }, [isEditing, document.id, currentUser, collaboration, handleCursorUpdate]);

  // Function to refresh document content from server
  const refreshDocumentContent = async () => {
    try {
      const response = await fetch(`/api/documents/${document.id}`);
      if (response.ok) {
        const data = await response.json();
        const updatedDocument = data.document;

        // Reset ALL form data to match the server
        setFormData({
          title: updatedDocument.title,
          content: updatedDocument.content,
          description: updatedDocument.description || "",
          tags: updatedDocument.tags?.join(", ") || "",
          is_public: updatedDocument.is_public,
          allow_comments: updatedDocument.allow_comments,
          allow_suggestions: updatedDocument.allow_suggestions,
          require_approval: updatedDocument.require_approval,
        });

        // Update current content to match the server
        setCurrentContent(updatedDocument.content);

        console.log("Refreshed document content:", updatedDocument.content);
        console.log("Refreshed form data:", {
          title: updatedDocument.title,
          content: updatedDocument.content,
          description: updatedDocument.description,
        });
      }
    } catch (error) {
      console.error("Error refreshing document content:", error);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // Send content changes to collaboration server in real-time
    if (name === "content" && isEditing && currentUser) {
      // Send typing indicator
      collaboration.sendTypingIndicator();

      // Clear existing timeout
      if (collaborationTimeoutRef.current) {
        clearTimeout(collaborationTimeoutRef.current);
      }

      // Debounce the collaboration update (send after 500ms of no typing)
      collaborationTimeoutRef.current = setTimeout(() => {
        collaboration.sendDocumentChange(value);
      }, 500);
    }
  };

  // Update cursor position when typing stops
  const handleContentInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // Call the regular input change handler
    handleInputChange(e);

    // Debounce cursor position updates
    if (isEditing && currentUser) {
      // Clear existing cursor timeout
      if (cursorTimeoutRef.current) {
        clearTimeout(cursorTimeoutRef.current);
      }

      // Update cursor position after user stops typing (500ms delay)
      cursorTimeoutRef.current = setTimeout(() => {
        handleCursorUpdate();
      }, 500);
    }
  };

  const handleSave = async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      // Handle all changes using the PUT endpoint
      const updateData = {
        title: formData.title.trim(),
        content: formData.content,
        description: formData.description.trim() || null,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
        is_public: formData.is_public,
        allow_comments: formData.allow_comments,
        allow_suggestions: formData.allow_suggestions,
        require_approval: formData.require_approval,
      };

      const response = await fetch(`/api/documents/${document.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save document");
      }

      // Update the current content with the saved content
      setCurrentContent(formData.content);

      console.log("Save: Document updated successfully");

      // Don't exit edit mode, just reset the change detection
      setHasChanges(false);
      setLastSaved(new Date());

      if (onSave) {
        onSave({
          ...document,
          ...updateData,
          content: formData.content,
          description: updateData.description || undefined,
        });
      }

      // Refresh the documents list to show updated content
      if (typeof window !== "undefined" && window.refreshDocumentsList) {
        window.refreshDocumentsList();
      }

      // Show success feedback without refreshing the page
      // The user can continue editing
    } catch (error) {
      console.error("Error saving document:", error);
      alert(error instanceof Error ? error.message : "Failed to save document");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async () => {
    // Use the refresh function to get the latest content
    await refreshDocumentContent();

    setIsEditing(false);
    setHasChanges(false);
    setLastSaved(null);

    // Refresh the documents list to show current content
    if (typeof window !== "undefined" && window.refreshDocumentsList) {
      window.refreshDocumentsList();
    }

    // Force a router refresh to get fresh data
    router.refresh();

    if (onCancel) {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Save on Ctrl+S or Cmd+S
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      if (hasChanges) {
        handleSave();
      }
    }
  };

  if (!isEditing) {
    return (
      <div className="space-y-6">
        {/* Document Header */}
        <div className="border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {document.title}
          </h1>
          {document.description && (
            <p className="text-gray-600 mb-4">{document.description}</p>
          )}
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span>
              Last updated: {new Date(document.updated_at).toLocaleString()}
            </span>
            {document.tags && document.tags.length > 0 && (
              <div className="flex items-center space-x-1">
                <span>Tags:</span>
                {document.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Document Content */}
        <div className="prose max-w-none">
          <div className="whitespace-pre-wrap text-gray-900 leading-relaxed">
            {document.content}
          </div>
        </div>

        {/* Edit Button and Status */}
        <div className="flex items-center justify-between">
          {document.is_public &&
            currentUser &&
            document.owner_id !== currentUser.id && (
              <div className="text-sm text-gray-600">
                🌐 This is a public document - you can edit it
              </div>
            )}
          {hasEditPermissions && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Edit Document
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" onKeyDown={handleKeyDown}>
      {/* Collaboration UI */}
      <CollaborationUI users={collaborators} />

      {/* Edit Header */}
      <div className="border-b border-gray-200 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            Editing Document
          </h2>
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-sm text-orange-600">• Unsaved changes</span>
            )}
            {lastSaved && !hasChanges && (
              <span className="text-sm text-green-600">
                • Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            {isEditing && collaborators.length > 0 && (
              <span className="text-sm text-blue-600">
                • {collaborators.length} collaborator
                {collaborators.length > 1 ? "s" : ""} online
              </span>
            )}
            {process.env.NODE_ENV === "development" && (
              <button
                onClick={refreshDocumentContent}
                className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-300 rounded hover:bg-gray-200"
                title="Refresh content from server"
              >
                🔄
              </button>
            )}
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="px-3 py-1 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        {/* Document Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>

          <div>
            <label
              htmlFor="tags"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Tags
            </label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              placeholder="tag1, tag2, tag3"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
              placeholder="Brief description of the document"
            />
          </div>

          <div className="md:col-span-2">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Document Settings
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Public/Private Setting */}
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="is_public"
                    checked={formData.is_public}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {formData.is_public
                      ? "🌐 Public Document"
                      : "🔒 Private Document"}
                  </span>
                </label>
                <p className="text-xs text-gray-500 ml-6">
                  {formData.is_public
                    ? "All logged-in users can view this document"
                    : "Only you and collaborators can view this document"}
                </p>
              </div>

              {/* Collaboration Settings */}
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="allow_comments"
                    checked={formData.allow_comments}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                  />
                  <span className="text-sm text-gray-700">Allow Comments</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="allow_suggestions"
                    checked={formData.allow_suggestions}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    Allow Suggestions
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    name="require_approval"
                    checked={formData.require_approval}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    Require Approval
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Document Content Editor */}
      <div className="relative">
        <label
          htmlFor="content"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Content *
        </label>
        <div className="relative">
          <textarea
            ref={contentRef}
            id="content"
            name="content"
            value={formData.content}
            onChange={handleContentInput}
            onKeyUp={handleCursorUpdate}
            onMouseUp={handleCursorUpdate}
            onSelect={handleCursorUpdate}
            rows={20}
            className="w-full px-4 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black font-mono text-sm leading-relaxed resize-y"
            placeholder="Start writing your document content here..."
          />
          {isEditing && (
            <CollaborativeCursor
              users={collaborators}
              textareaRef={contentRef}
              currentUserId={currentUser?.id}
            />
          )}
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Use Ctrl+S (or Cmd+S) to save • {formData.content.length} characters
        </div>
      </div>

      {/* Save/Cancel Buttons */}
      <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
