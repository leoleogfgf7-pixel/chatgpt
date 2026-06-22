"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { formatSoles, formatDateTime } from "@/lib/utils";

interface Venta {
  id: number; clienteNombre: string; total: string; subtotal: string;
  descuento: string; metodoPago: string; estado: string; createdAt: string;
  items: { productoNombre: string; cantidad: number; precioUnitario: string; subtotal: string; usoPrecioEspecial: boolean }[];
}

export default function VentasPage() {
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = () => {
    const p = filter ? `?estado=${filter}` : "";
    fetch(`/api/ventas${p}`).then(r => r.ok ? r.json() : []).then(setVentas).catch(() => setVentas([]));
  };
  useEffect(() => { fetch("/api/setup").catch(() => {}).finally(() => load()); }, []);
  useEffect(() => { load(); }, [filter]);

  const cancelar = async (id: number) => {
    if (!confirm("¿Cancelar esta venta? Se devolverá el stock.")) return;
    await fetch(`/api/ventas/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado: "cancelada" }) });
    load();
  };

  const completadas = ventas.filter(v => v.estado === "completada");
  const total = completadas.reduce((s, v) => s + Number(v.total), 0);

  const metodoPagoIcon: Record<string, string> = {
    efectivo: "💵", yape: "📱", plin: "📲", transferencia: "🏦", tarjeta: "💳", otro: "💫"
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gradient">Ventas</h1>
          <p className="text-gray-500 text-sm mt-1">{completadas.length} completadas · Total: <span className="text-emerald-400 font-semibold">{formatSoles(total)}</span></p>
        </div>
        <Link href="/ventas/nueva" className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:from-emerald-500 hover:to-green-500 transition-all shadow-lg shadow-emerald-500/20">
          + Nueva Venta
        </Link>
      </div>

      <div className="flex gap-2">
        {["", "completada", "cancelada"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === f ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
            }`}>
            {f === "" ? "Todas" : f === "completada" ? "✓ Completadas" : "✕ Canceladas"}
          </button>
        ))}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">#</th>
                <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Cliente</th>
                <th className="px-5 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Pago</th>
                <th className="px-5 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</th>
                <th className="px-5 py-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                <th className="px-5 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {ventas.map(v => (
                <Fragment key={v.id}>
                  <tr className="hover:bg-white/[0.02] cursor-pointer transition-colors" onClick={() => setExpanded(expanded === v.id ? null : v.id)}>
                    <td className="px-5 py-4 font-mono text-gray-400">{v.id}</td>
                    <td className="px-5 py-4 text-gray-400 text-xs">{formatDateTime(v.createdAt)}</td>
                    <td className="px-5 py-4 text-white font-medium">{v.clienteNombre}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1 text-gray-300 capitalize">
                        {metodoPagoIcon[v.metodoPago] || "💫"} {v.metodoPago}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right font-bold text-white font-mono">{formatSoles(v.total)}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        v.estado === "completada" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-red-500/15 text-red-400 border border-red-500/20"
                      }`}>
                        {v.estado === "completada" ? "✓" : "✕"} {v.estado}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {v.estado === "completada" && (
                        <button onClick={(e) => { e.stopPropagation(); cancelar(v.id); }} className="text-gray-600 hover:text-red-400 text-xs transition">
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === v.id && (
                    <tr>
                      <td colSpan={7} className="bg-white/[0.02] px-8 py-4 border-t border-white/5">
                        <div className="space-y-1.5">
                          {v.items.map((it, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-gray-300">
                                {it.productoNombre} × {it.cantidad}
                                {it.usoPrecioEspecial && <span className="text-amber-400 ml-1.5">⭐ Especial</span>}
                                <span className="text-gray-600 ml-1.5">@ {formatSoles(it.precioUnitario)}</span>
                              </span>
                              <span className="text-white font-mono">{formatSoles(it.subtotal)}</span>
                            </div>
                          ))}
                          {Number(v.descuento) > 0 && (
                            <div className="flex justify-between text-xs text-red-400 pt-1 border-t border-white/5">
                              <span>Descuento</span>
                              <span>-{formatSoles(v.descuento)}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
              {ventas.length === 0 && (
                <tr><td colSpan={7} className="text-center py-16 text-gray-600">Sin ventas registradas</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { Fragment } from "react";
