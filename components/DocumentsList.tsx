"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Document } from "@/types/database";
import DeleteDocumentModal from "./DeleteDocumentModal";

// Extend Window interface to include our global function
declare global {
  interface Window {
    refreshDocumentsList?: () => void;
  }
}

interface DocumentsListProps {
  initialDocuments?: Document[];
}

export default function DocumentsList({
  initialDocuments = [],
}: DocumentsListProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showOnlyPublic, setShowOnlyPublic] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    documentId: string;
    documentTitle: string;
  }>({
    isOpen: false,
    documentId: "",
    documentTitle: "",
  });

  const fetchDocuments = useCallback(
    async (search?: string) => {
      setIsLoading(true);
      try {
        let url = "/api/documents";
        if (search && search.trim()) {
          url = `/api/search?q=${encodeURIComponent(search.trim())}`;
        }

        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          // Handle both regular documents and search results
          let docs = data.documents || data;
          docs = Array.isArray(docs) ? docs : [];

          // Apply public filter if enabled
          if (showOnlyPublic) {
            docs = docs.filter((doc: Document) => doc.is_public);
          }

          setDocuments(docs);
        }
      } catch (error) {
        console.error("Error fetching documents:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [showOnlyPublic]
  );

  // Expose refresh function to parent components
  const refreshDocuments = () => {
    fetchDocuments(searchTerm);
  };

  // Make refresh function available globally for other components to call
  if (typeof window !== "undefined") {
    window.refreshDocumentsList = refreshDocuments;
  }

  useEffect(() => {
    if (initialDocuments.length === 0) {
      fetchDocuments();
    }
  }, [initialDocuments.length, showOnlyPublic, fetchDocuments]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDocuments(searchTerm);
  };

  const getDocumentIcon = () => {
    return (
      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
        <svg
          className="w-5 h-5 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter Bar */}
      <div className="space-y-3">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search documents..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Search
          </button>
        </form>

        {/* Filter Options */}
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showOnlyPublic}
              onChange={(e) => setShowOnlyPublic(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
            />
            <span className="text-sm text-gray-700">
              Show only public documents
            </span>
          </label>
        </div>
      </div>

      {/* Documents List */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No documents found
          </h3>
          <p className="text-gray-600 mb-4">
            {searchTerm
              ? "No documents match your search criteria."
              : "Get started by creating your first document."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {documents.map((document) => (
            <div
              key={document.id}
              onClick={() => router.push(`/documents/${document.id}`)}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start space-x-3">
                {getDocumentIcon()}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {document.title}
                    </h3>
                    <div className="flex items-center space-x-2">
                      {document.is_public && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Public
                        </span>
                      )}
                    </div>
                  </div>

                  {document.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {document.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>
                        Updated: {formatDate(document.updated_at.toString())}
                      </span>
                      {document.is_public && document.owner_name && (
                        <span className="text-gray-600">
                          by {document.owner_name}
                        </span>
                      )}
                      {document.tags && document.tags.length > 0 && (
                        <div className="flex items-center space-x-1">
                          <span>Tags:</span>
                          {document.tags.slice(0, 2).map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {tag}
                            </span>
                          ))}
                          {document.tags.length > 2 && (
                            <span className="text-xs text-gray-400">
                              +{document.tags.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/documents/${document.id}`);
                        }}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Open →
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteModal({
                            isOpen: true,
                            documentId: document.id,
                            documentTitle: document.title,
                          });
                        }}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <DeleteDocumentModal
        isOpen={deleteModal.isOpen}
        onClose={() =>
          setDeleteModal({ isOpen: false, documentId: "", documentTitle: "" })
        }
        documentId={deleteModal.documentId}
        documentTitle={deleteModal.documentTitle}
      />
    </div>
  );
}
