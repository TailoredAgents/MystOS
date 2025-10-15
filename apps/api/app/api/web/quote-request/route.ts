import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function POST(_request: NextRequest) {
  return NextResponse.json(
    {
      error: "quote_deprecated",
      message: "Online instant quotes have been discontinued. Please schedule an in-person estimate."
    },
    { status: 410 }
  );
}
