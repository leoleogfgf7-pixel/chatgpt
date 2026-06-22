import { db } from "@/db";
import { categorias } from "@/db/schema";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(categorias).orderBy(categorias.nombre);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const body = await req.json();
  const [row] = await db.insert(categorias).values({ nombre: body.nombre, color: body.color || "#6366f1" }).returning();
  return NextResponse.json(row, { status: 201 });
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  await db.delete(categorias).where(eq(categorias.id, id));
  return NextResponse.json({ ok: true });
}
