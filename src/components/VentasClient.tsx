
"use client";

import { useEffect, useState } from "react";

export default function VentasClient() {
  const [data, setData] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/test");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error(error);
        setData([]);
      }
    }
    fetchData();
  }, []);

  return (
    <div>
      <h1>Ventas</h1>
      {data.map((item: any, i) => (
        <div key={i}>{JSON.stringify(item)}</div>
      ))}
    </div>
  );
}
