import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/database";

export async function GET(req: NextRequest) {
  try {
    // Test basic database connection
    const result = await pool.query("SELECT NOW() as current_time");

    // Test if documents table exists
    const tableResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'documents'
      ) as table_exists
    `);

    // Test if document_analytics table exists
    const analyticsResult = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'document_analytics'
      ) as analytics_exists
    `);

    return NextResponse.json({
      success: true,
      database: "connected",
      current_time: result.rows[0].current_time,
      documents_table: tableResult.rows[0].table_exists,
      analytics_table: analyticsResult.rows[0].analytics_exists,
    });
  } catch (error) {
    console.error("Database test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
