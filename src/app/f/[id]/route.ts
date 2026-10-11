import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    if (!UUID_RE.test(id)) {
        return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    // Parse body (form-encoded or JSON)
    let body: Record<string, unknown> = {};
    try {
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
            const json = await request.json();
            if (!json || typeof json !== "object" || Array.isArray(json)) {
                return NextResponse.json({ error: "Invalid body" }, { status: 400 });
            }
            body = json as Record<string, unknown>;
        } else {
            const formData = await request.formData();
            for (const [key, value] of formData.entries()) {
                if (typeof value === "string") body[key] = value;
            }
        }
    } catch {
        return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { _redirect, ...data } = body;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    const supabase = createClient(url, serviceKey, {
        auth: { persistSession: false },
    });

    // Look up the form
    const { data: form, error: formError } = await supabase
        .from("forms")
        .select("id")
        .eq("id", id)
        .maybeSingle();

    if (formError) {
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
    if (!form) {
        return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    // Save the submission
    const { error: insertError } = await supabase
        .from("submissions")
        .insert({ form_id: id, data });

    if (insertError) {
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    // Optional redirect (http/https only)
    if (typeof _redirect === "string") {
        try {
            const target = new URL(_redirect);
            if (target.protocol === "http:" || target.protocol === "https:") {
                return NextResponse.redirect(target, 303);
            }
        } catch {
            // invalid URL: fall through to JSON response
        }
    }

    return NextResponse.json({ ok: true });
}