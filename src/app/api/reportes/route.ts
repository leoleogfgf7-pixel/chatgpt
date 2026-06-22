import { db } from "@/db";
import { ventas, ventaItems, gastos, productos } from "@/db/schema";
import { NextResponse } from "next/server";
import { sql, eq, gte, and, desc } from "drizzle-orm";

export async function GET() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // ventas por dia ultimos 30 dias
  const ventasPorDia = await db.select({
    dia: sql<string>`to_char(${ventas.createdAt}, 'YYYY-MM-DD')`,
    total: sql<string>`coalesce(sum(${ventas.total}::numeric),0)::text`,
    costo: sql<string>`coalesce(sum(${ventas.costo}::numeric),0)::text`,
    count: sql<number>`count(*)::int`,
  }).from(ventas)
    .where(and(gte(ventas.createdAt, last30), eq(ventas.estado, "completada")))
    .groupBy(sql`to_char(${ventas.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${ventas.createdAt}, 'YYYY-MM-DD')`);

  // top productos
  const topProductos = await db.select({
    nombre: ventaItems.productoNombre,
    unidades: sql<number>`sum(${ventaItems.cantidad})::int`,
    ingresos: sql<string>`sum(${ventaItems.subtotal}::numeric)::text`,
    costo: sql<string>`sum(${ventaItems.precioCosto}::numeric * ${ventaItems.cantidad})::text`,
  }).from(ventaItems)
    .innerJoin(ventas, eq(ventaItems.ventaId, ventas.id))
    .where(eq(ventas.estado, "completada"))
    .groupBy(ventaItems.productoNombre)
    .orderBy(sql`sum(${ventaItems.subtotal}::numeric) desc`)
    .limit(10);

  // metodo pago
  const porMetodo = await db.select({
    metodo: ventas.metodoPago,
    total: sql<string>`sum(${ventas.total}::numeric)::text`,
    count: sql<number>`count(*)::int`,
  }).from(ventas)
    .where(eq(ventas.estado, "completada"))
    .groupBy(ventas.metodoPago)
    .orderBy(sql`sum(${ventas.total}::numeric) desc`);

  // inventario valorizado
  const [inv] = await db.select({
    totalCosto: sql<string>`coalesce(sum(${productos.precioCosto}::numeric * ${productos.stock}),0)::text`,
    totalVenta: sql<string>`coalesce(sum(${productos.precioVenta}::numeric * ${productos.stock}),0)::text`,
    items: sql<number>`count(*)::int`,
  }).from(productos).where(eq(productos.activo, true));

  // gastos mes
  const gastosMes = await db.select({
    categoria: gastos.categoria,
    total: sql<string>`sum(${gastos.monto}::numeric)::text`,
  }).from(gastos)
    .where(gte(gastos.createdAt, monthStart))
    .groupBy(gastos.categoria)
    .orderBy(sql`sum(${gastos.monto}::numeric) desc`);

  const totalGastos = gastosMes.reduce((s, g) => s + Number(g.total), 0);
  const totalVentasMes = ventasPorDia.reduce((s, d) => s + Number(d.total), 0);
  const totalCostoMes = ventasPorDia.reduce((s, d) => s + Number(d.costo), 0);

  return NextResponse.json({
    ventasPorDia, topProductos, porMetodo,
    inventario: inv, gastosMes, totalGastos,
    gananciasMes: totalVentasMes - totalCostoMes,
    netoMes: totalVentasMes - totalCostoMes - totalGastos,
  });
}
