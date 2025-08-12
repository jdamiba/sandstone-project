import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { pool } from "@/lib/database";
import DocumentActions from "@/components/DocumentActions";
import DocumentEditor from "@/components/DocumentEditor";

interface DocumentPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function DocumentPage({ params }: DocumentPageProps) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  // Await params for Next.js 15 compatibility
  const { id } = await params;

  // Fetch document
  const documentQuery = `
    SELECT 
      d.*,
      u.first_name || ' ' || u.last_name as owner_name
    FROM documents d
    LEFT JOIN users u ON d.owner_id = u.id
    WHERE d.id = $1 AND (
      d.owner_id = $2 OR 
      d.is_public = TRUE OR
      EXISTS (
        SELECT 1 FROM document_collaborators 
        WHERE document_id = d.id AND user_id = $2 AND is_active = TRUE
      )
    )
  `;

  const documentResult = await pool.query(documentQuery, [id, user.id]);

  if (documentResult.rows.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Document Not Found
          </h1>
          <p className="text-gray-600 mb-6">
            The document you&aposre looking for doesn&apost exist or you
            don&apost have access to it.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Go Back Home
          </Link>
        </div>
      </div>
    );
  }

  const document = documentResult.rows[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Document Header */}
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {document.title}
                </h1>
                {document.description && (
                  <p className="text-gray-600 mt-1">{document.description}</p>
                )}
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                  <span>Owner: {document.owner_name}</span>
                  <span>
                    Created:{" "}
                    {new Date(document.created_at).toLocaleDateString()}
                  </span>
                  <span>
                    Updated:{" "}
                    {new Date(document.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {document.is_public && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Public
                  </span>
                )}
                <DocumentActions
                  documentId={document.id}
                  documentTitle={document.title}
                  isOwner={document.owner_id === user.id}
                />
              </div>
            </div>
          </div>

          {/* Document Content */}
          <div className="px-6 py-6">
            <DocumentEditor
              key={`${document.id}-${document.updated_at}`}
              document={document}
              currentUser={user}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
