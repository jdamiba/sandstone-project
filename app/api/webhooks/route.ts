import { headers } from "next/headers";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import {
  createUser,
  updateUser,
  deleteUser,
  getUserByClerkId,
} from "@/lib/database";

// Use Clerk's built-in types
import type { UserJSON } from "@clerk/nextjs/server";

// Webhook secret from Clerk dashboard
const webhookSecret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;

export async function POST(req: Request) {
  try {
    // Get the headers
    const headerPayload = await headers();
    const svix_id = headerPayload.get("svix-id");
    const svix_timestamp = headerPayload.get("svix-timestamp");
    const svix_signature = headerPayload.get("svix-signature");

    // If there are no headers, error out
    if (!svix_id || !svix_timestamp || !svix_signature) {
      return new NextResponse("Error occured -- no svix headers", {
        status: 400,
      });
    }

    // Get the body
    const payload = await req.text();

    // Create a new Svix instance with your secret.
    const wh = new Webhook(webhookSecret || "");

    let evt: WebhookEvent;

    // Verify the payload with the headers
    try {
      evt = wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as WebhookEvent;
    } catch (err) {
      console.error("Error verifying webhook:", err);
      return new NextResponse("Error occured", {
        status: 400,
      });
    }

    // Handle the webhook
    const eventType = evt.type;
    console.log(`Processing webhook event: ${eventType}`);

    switch (eventType) {
      case "user.created":
        await handleUserCreated(evt.data);
        break;
      case "user.updated":
        await handleUserUpdated(evt.data);
        break;
      case "user.deleted":
        await handleUserDeleted(evt.data as { id: string });
        break;
      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return new NextResponse("Internal Server Error", {
      status: 500,
    });
  }
}

async function handleUserCreated(data: UserJSON) {
  try {
    const { id, email_addresses, first_name, last_name, image_url } = data;

    // Get the primary email address
    const primaryEmail = email_addresses?.find(
      (email) => email.id === data.primary_email_address_id
    );

    if (!primaryEmail) {
      console.error("No primary email found for user:", id);
      return;
    }

    // Check if user already exists
    const existingUser = await getUserByClerkId(id);
    if (existingUser) {
      console.log("User already exists:", id);
      return;
    }

    // Create new user in database
    const newUser = await createUser({
      clerk_user_id: id,
      email: primaryEmail.email_address,
      first_name: first_name || undefined,
      last_name: last_name || undefined,
      avatar_url: image_url || undefined,
    });

    console.log("Created new user:", newUser.id);
  } catch (error) {
    console.error("Error creating user:", error);
    throw error;
  }
}

async function handleUserUpdated(data: UserJSON) {
  try {
    const { id, email_addresses, first_name, last_name, image_url } = data;

    // Get the primary email address
    const primaryEmail = email_addresses?.find(
      (email) => email.id === data.primary_email_address_id
    );

    if (!primaryEmail) {
      console.error("No primary email found for user:", id);
      return;
    }

    // Update user in database
    const updatedUser = await updateUser(id, {
      email: primaryEmail.email_address,
      first_name: first_name || undefined,
      last_name: last_name || undefined,
      avatar_url: image_url || undefined,
    });

    if (updatedUser) {
      console.log("Updated user:", updatedUser.id);
    } else {
      console.log("User not found for update:", id);
    }
  } catch (error) {
    console.error("Error updating user:", error);
    throw error;
  }
}

async function handleUserDeleted(data: { id: string }) {
  try {
    const { id } = data;

    // Soft delete user in database
    const deleted = await deleteUser(id);

    if (deleted) {
      console.log("Deleted user:", id);
    } else {
      console.log("User not found for deletion:", id);
    }
  } catch (error) {
    console.error("Error deleting user:", error);
    throw error;
  }
}
