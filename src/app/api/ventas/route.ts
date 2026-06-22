import { db } from "@/db";
import { ventas, ventaItems, productos, movimientos } from "@/db/schema";
import { NextResponse } from "next/server";
import { eq, desc, sql, and, gte } from "drizzle-orm";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const estado = url.searchParams.get("estado");
  const conditions = estado ? [eq(ventas.estado, estado)] : [];

  const rows = await db.select().from(ventas)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(ventas.createdAt));

  // get items for each venta
  const ids = rows.map((r) => r.id);
  let items: (typeof ventaItems.$inferSelect)[] = [];
  if (ids.length > 0) {
    items = await db.select().from(ventaItems).where(
      sql`${ventaItems.ventaId} = ANY(${ids})`
    );
  }

  const result = rows.map((v) => ({
    ...v,
    items: items.filter((i) => i.ventaId === v.id),
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const b = await req.json();
  const itemsData: {
    productoId: number; cantidad: number;
    precioUnitario: number; precioCosto: number;
    productoNombre: string; usoPrecioEspecial?: boolean;
  }[] = b.items;

  if (!itemsData?.length) return NextResponse.json({ error: "Sin items" }, { status: 400 });

  let subtotal = 0;
  let costoTotal = 0;
  const processedItems = itemsData.map((it) => {
    const st = it.precioUnitario * it.cantidad;
    subtotal += st;
    costoTotal += it.precioCosto * it.cantidad;
    return { ...it, subtotal: st };
  });

  const descuento = Number(b.descuento || 0);
  const total = subtotal - descuento;

  const [venta] = await db.insert(ventas).values({
    clienteId: b.clienteId || null,
    clienteNombre: b.clienteNombre || "Público General",
    subtotal: String(subtotal), descuento: String(descuento),
    total: String(total), costo: String(costoTotal),
    metodoPago: b.metodoPago || "efectivo",
    estado: "completada", notas: b.notas || null,
  }).returning();

  for (const it of processedItems) {
    await db.insert(ventaItems).values({
      ventaId: venta.id, productoId: it.productoId,
      productoNombre: it.productoNombre, cantidad: it.cantidad,
      precioUnitario: String(it.precioUnitario),
      precioCosto: String(it.precioCosto),
      usoPrecioEspecial: it.usoPrecioEspecial || false,
      subtotal: String(it.subtotal),
    });

    // descontar stock
    await db.update(productos).set({
      stock: sql`${productos.stock} - ${it.cantidad}`,
      updatedAt: new Date(),
    }).where(eq(productos.id, it.productoId));

    // registrar movimiento
    await db.insert(movimientos).values({
      productoId: it.productoId, productoNombre: it.productoNombre,
      tipo: "salida", cantidad: it.cantidad,
      motivo: "Venta", referencia: `Venta #${venta.id}`,
    });
  }

  return NextResponse.json(venta, { status: 201 });
}
