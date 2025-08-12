"use client";

import { useState } from "react";
import DeleteDocumentModal from "./DeleteDocumentModal";

interface DocumentActionsProps {
  documentId: string;
  documentTitle: string;
  isOwner: boolean;
}

export default function DocumentActions({
  documentId,
  documentTitle,
  isOwner,
}: DocumentActionsProps) {
  const [deleteModal, setDeleteModal] = useState(false);

  return (
    <>
      <div className="flex items-center space-x-2">
        {isOwner && (
          <button
            onClick={() => setDeleteModal(true)}
            className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 hover:bg-red-50 rounded-md"
          >
            Delete
          </button>
        )}
      </div>

      <DeleteDocumentModal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        documentId={documentId}
        documentTitle={documentTitle}
      />
    </>
  );
}
