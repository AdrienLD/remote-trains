import type { SortedTrains } from "../../back/src/types"

const API_BASE = import.meta.env.DEV ? "http://localhost:3000" : ""

export async function fetchNextTrains() {
  const res = await fetch(`${API_BASE}/api/next-trains`)
  if (!res.ok) throw new Error("Erreur API backend")
  return res.json()
}

export const filterData = (
  datas: SortedTrains[],
  ignoreGares: string[]
): SortedTrains[] => {
  let results = datas

  if (ignoreGares.length > 0) {
    results = results.filter((data) => !ignoreGares.includes(data.id))
  }
  return results
}
