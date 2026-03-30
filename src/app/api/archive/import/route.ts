import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { auth } from "@/lib/auth";

// POST — Validate an imported .messmate archive file
// Body: the file content as JSON text
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.messId) {
    return NextResponse.json({ error: "Not in a mess" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { fileContent } = body;

    if (!fileContent) {
      return NextResponse.json({ error: "No file content provided" }, { status: 400 });
    }

    let parsed;
    try {
      parsed = JSON.parse(fileContent);
    } catch {
      return NextResponse.json({ error: "Invalid file format — cannot parse" }, { status: 400 });
    }

    const { archive, _checksum } = parsed;

    if (!archive || !_checksum) {
      return NextResponse.json({ error: "Invalid .messmate file — missing structure" }, { status: 400 });
    }

    if (archive._format !== "messmate-archive" || archive._version !== 1) {
      return NextResponse.json({ error: "Unsupported archive format or version" }, { status: 400 });
    }

    // Verify integrity checksum
    const expectedHash = await computeHash(JSON.stringify(archive));
    if (expectedHash !== _checksum) {
      return NextResponse.json({
        error: "File integrity check failed — the file may have been tampered with",
        valid: false,
      }, { status: 400 });
    }

    // Return the validated archive data for client-side rendering
    return NextResponse.json({
      valid: true,
      archive,
    });
  } catch {
    return NextResponse.json({ error: "Failed to process the file" }, { status: 500 });
  }
}

async function computeHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = encoder.encode(data);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const hashArray = Array.from(new Uint8Array(hashBuf));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
