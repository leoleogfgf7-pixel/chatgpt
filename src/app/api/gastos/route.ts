import { db } from "@/db";
import { gastos } from "@/db/schema";
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(gastos).orderBy(desc(gastos.createdAt)).limit(200);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const b = await req.json();
  const [row] = await db.insert(gastos).values({
    concepto: b.concepto, monto: String(b.monto),
    categoria: b.categoria || "otros", notas: b.notas || null,
  }).returning();
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await db.delete(gastos).where(eq(gastos.id, id));
  return NextResponse.json({ ok: true });
}
