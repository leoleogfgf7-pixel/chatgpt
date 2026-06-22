import { db } from "@/db";
import { productos, categorias, ventaItems, ventas } from "@/db/schema";
import { NextResponse } from "next/server";
import { eq, sql, and } from "drizzle-orm";

export async function GET() {
  // All active products with category
  const prods = await db
    .select({
      id: productos.id,
      nombre: productos.nombre,
      sku: productos.sku,
      precioCosto: productos.precioCosto,
      precioVenta: productos.precioVenta,
      precioEspecial: productos.precioEspecial,
      stock: productos.stock,
      unidad: productos.unidad,
      categoriaNombre: categorias.nombre,
      categoriaColor: categorias.color,
    })
    .from(productos)
    .leftJoin(categorias, eq(productos.categoriaId, categorias.id))
    .where(eq(productos.activo, true))
    .orderBy(productos.nombre);

  // Sales data per product (only completed)
  const ventasData = await db
    .select({
      productoId: ventaItems.productoId,
      unidadesVendidas: sql<number>`coalesce(sum(${ventaItems.cantidad}), 0)::int`,
      ingresosVentas: sql<string>`coalesce(sum(${ventaItems.subtotal}::numeric), 0)::text`,
      costoVentas: sql<string>`coalesce(sum(${ventaItems.precioCosto}::numeric * ${ventaItems.cantidad}), 0)::text`,
    })
    .from(ventaItems)
    .innerJoin(ventas, eq(ventaItems.ventaId, ventas.id))
    .where(eq(ventas.estado, "completada"))
    .groupBy(ventaItems.productoId);

  const ventasMap = new Map(ventasData.map((v) => [v.productoId, v]));

  const result = prods.map((p) => {
    const vData = ventasMap.get(p.id);
    const costo = Number(p.precioCosto ?? 0);
    const venta = Number(p.precioVenta ?? 0);
    const especial = p.precioEspecial ? Number(p.precioEspecial) : null;
    const stock = p.stock ?? 0;
    const margenUnidad = venta - costo;
    const margenEspecial = especial !== null ? especial - costo : null;

    const unidadesVendidas = vData?.unidadesVendidas ?? 0;
    const ingresosVentas = Number(vData?.ingresosVentas ?? 0);
    const costoVentas = Number(vData?.costoVentas ?? 0);
    const gananciaGenerada = ingresosVentas - costoVentas;

    // Potential: what I'd earn selling all remaining stock at normal price
    const gananciaPotencial = margenUnidad * stock;
    // Potential at special price
    const gananciaPotencialEspecial = margenEspecial !== null ? margenEspecial * stock : null;

    // Invested in current stock
    const inversionStock = costo * stock;
    // Revenue if I sell all remaining stock
    const ingresosPotenciales = venta * stock;

    // ROI on this product so far
    const roi = costoVentas > 0 ? ((gananciaGenerada / costoVentas) * 100) : 0;

    return {
      id: p.id,
      nombre: p.nombre,
      sku: p.sku,
      categoriaNombre: p.categoriaNombre,
      categoriaColor: p.categoriaColor,
      unidad: p.unidad,
      precioCosto: costo,
      precioVenta: venta,
      precioEspecial: especial,
      stock,
      margenUnidad,
      margenEspecial,
      unidadesVendidas,
      ingresosVentas,
      costoVentas,
      gananciaGenerada,
      gananciaPotencial,
      gananciaPotencialEspecial,
      inversionStock,
      ingresosPotenciales,
      roi,
    };
  });

  // Global totals
  const totals = {
    totalProductos: result.length,
    totalUnidadesVendidas: result.reduce((s, r) => s + r.unidadesVendidas, 0),
    totalIngresosVentas: result.reduce((s, r) => s + r.ingresosVentas, 0),
    totalCostoVentas: result.reduce((s, r) => s + r.costoVentas, 0),
    totalGananciaGenerada: result.reduce((s, r) => s + r.gananciaGenerada, 0),
    totalStockActual: result.reduce((s, r) => s + r.stock, 0),
    totalInversionStock: result.reduce((s, r) => s + r.inversionStock, 0),
    totalIngresosPotenciales: result.reduce((s, r) => s + r.ingresosPotenciales, 0),
    totalGananciaPotencial: result.reduce((s, r) => s + r.gananciaPotencial, 0),
    // Grand total: earned + potential
    totalProyectado: result.reduce((s, r) => s + r.gananciaGenerada + r.gananciaPotencial, 0),
  };

  return NextResponse.json({ productos: result, totals });
}
