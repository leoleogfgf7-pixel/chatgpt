import { db } from "@/db";
import { ventas, productos, clientes, gastos, ventaItems } from "@/db/schema";
import { NextResponse } from "next/server";
import { sql, eq, gte, and, desc } from "drizzle-orm";

export async function GET() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // ventas hoy
  const [ventasHoy] = await db.select({
    count: sql<number>`count(*)::int`,
    total: sql<string>`coalesce(sum(${ventas.total}::numeric),0)::text`,
  }).from(ventas).where(and(gte(ventas.createdAt, todayStart), eq(ventas.estado, "completada")));

  // ventas mes
  const [ventasMes] = await db.select({
    count: sql<number>`count(*)::int`,
    total: sql<string>`coalesce(sum(${ventas.total}::numeric),0)::text`,
    costo: sql<string>`coalesce(sum(${ventas.costo}::numeric),0)::text`,
  }).from(ventas).where(and(gte(ventas.createdAt, monthStart), eq(ventas.estado, "completada")));

  // stock bajo
  const stockBajo = await db.select().from(productos)
    .where(and(eq(productos.activo, true), sql`${productos.stock} <= ${productos.stockMinimo}`))
    .orderBy(productos.stock).limit(10);

  // total productos
  const [prodCount] = await db.select({ count: sql<number>`count(*)::int` })
    .from(productos).where(eq(productos.activo, true));

  // total clientes
  const [cliCount] = await db.select({ count: sql<number>`count(*)::int` }).from(clientes);

  // gastos mes
  const [gastosMes] = await db.select({
    total: sql<string>`coalesce(sum(${gastos.monto}::numeric),0)::text`,
  }).from(gastos).where(gte(gastos.createdAt, monthStart));

  // ultimas ventas
  const ultimasVentas = await db.select().from(ventas).orderBy(desc(ventas.createdAt)).limit(5);

  // top productos
  const topProductos = await db.select({
    productoNombre: ventaItems.productoNombre,
    totalUnidades: sql<number>`sum(${ventaItems.cantidad})::int`,
    totalVentas: sql<string>`sum(${ventaItems.subtotal}::numeric)::text`,
  }).from(ventaItems)
    .innerJoin(ventas, eq(ventaItems.ventaId, ventas.id))
    .where(eq(ventas.estado, "completada"))
    .groupBy(ventaItems.productoNombre)
    .orderBy(sql`sum(${ventaItems.subtotal}::numeric) desc`)
    .limit(5);

  return NextResponse.json({
    ventasHoy, ventasMes, stockBajo, prodCount: prodCount.count,
    cliCount: cliCount.count, gastosMes: gastosMes.total,
    ultimasVentas, topProductos,
  });
}
