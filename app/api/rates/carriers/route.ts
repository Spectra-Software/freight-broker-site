import { NextResponse } from "next/server";

// Simple static carriers list for demo. Replace with DB lookup as needed.
const carriers = [
  { id: "carrier_a", name: "Carrier A" },
  { id: "carrier_b", name: "Carrier B" },
  { id: "carrier_c", name: "Carrier C" },
];

export async function GET() {
  return NextResponse.json({ carriers });
}
