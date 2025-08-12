import { auth, currentUser } from "@clerk/nextjs/server";
import { getUserByClerkId, createUser, updateUserActivity } from "./database";
import { User } from "@/types/database";

// Get current user from Clerk and sync with database
export async function getCurrentUser(): Promise<User | null> {
  try {
    const { userId } = await auth();

    if (!userId) {
      return null;
    }

    // Get user from our database
    let user = await getUserByClerkId(userId);

    if (!user) {
      // User doesn't exist in our database, get from Clerk and create
      const clerkUser = await currentUser();

      if (!clerkUser) {
        return null;
      }

      // Get primary email
      const primaryEmail = clerkUser.emailAddresses.find(
        (email) => email.id === clerkUser.primaryEmailAddressId
      );

      if (!primaryEmail) {
        console.error("No primary email found for user:", userId);
        return null;
      }

      // Create user in our database
      user = await createUser({
        clerk_user_id: userId,
        email: primaryEmail.emailAddress,
        first_name: clerkUser.firstName || undefined,
        last_name: clerkUser.lastName || undefined,
        avatar_url: clerkUser.imageUrl || undefined,
      });
    } else {
      // Update last activity
      await updateUserActivity(userId);
    }

    return user;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

// Get user by ID (for internal use)
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const { getUserById } = await import("./database");
    return await getUserById(userId);
  } catch (error) {
    console.error("Error getting user by ID:", error);
    return null;
  }
}

// Check if user has permission for a document
export async function checkDocumentPermission(
  userId: string,
  documentId: string,
  requiredPermission: "owner" | "editor" | "viewer" | "commenter" = "viewer"
): Promise<boolean> {
  try {
    const { pool } = await import("./database");

    const query = `
      SELECT permission_level 
      FROM document_collaborators 
      WHERE user_id = $1 AND document_id = $2 AND is_active = TRUE
    `;

    const result = await pool.query(query, [userId, documentId]);

    if (result.rows.length === 0) {
      return false;
    }

    const permission = result.rows[0].permission_level;

    // Permission hierarchy: owner > editor > viewer > commenter
    const permissionLevels = {
      owner: 4,
      editor: 3,
      viewer: 2,
      commenter: 1,
    };

    return (
      permissionLevels[permission as keyof typeof permissionLevels] >=
      permissionLevels[requiredPermission]
    );
  } catch (error) {
    console.error("Error checking document permission:", error);
    return false;
  }
}

// Get user's documents
export async function getUserDocuments(userId: string, limit = 10, offset = 0) {
  try {
    const { pool } = await import("./database");

    const query = `
      SELECT d.*, 
             u.first_name || ' ' || u.last_name as owner_name,
             COUNT(dc.user_id) as collaborator_count
      FROM documents d
      LEFT JOIN users u ON d.owner_id = u.id
      LEFT JOIN document_collaborators dc ON d.id = dc.document_id AND dc.is_active = TRUE
      WHERE d.owner_id = $1 OR EXISTS (
        SELECT 1 FROM document_collaborators 
        WHERE document_id = d.id AND user_id = $1 AND is_active = TRUE
      )
      GROUP BY d.id, u.first_name, u.last_name
      ORDER BY d.updated_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await pool.query(query, [userId, limit, offset]);
    return result.rows;
  } catch (error) {
    console.error("Error getting user documents:", error);
    return [];
  }
}
