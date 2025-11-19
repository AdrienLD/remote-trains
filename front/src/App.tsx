import { useEffect, useMemo, useState } from "react"
import "./App.css"
import { fetchNextTrains, filterData } from "./api"
import type { SortedTrains } from "../../back/src/types"
import TrainComponent from "./Train"

function App() {
  const [gares, setGares] = useState<SortedTrains[]>([])
  const [changesWidow, setChangesWidow] = useState<boolean>(false)
  const [listeGares, setListeGares] = useState<string[]>([])
  const [ignoreGares, setIgnoreGares] = useState<string[]>([])
  const [endStart, setendStart] = useState<boolean>(false)

  useEffect(() => {
    let isMounted = true

    async function load() {
      try {
        const garesData: SortedTrains[] = await fetchNextTrains()
        if (!isMounted) return
        setGares(garesData)
        setListeGares(
          Array.from(
            new Set(
              [...garesData] // on copie pour ne pas muter le state
                .sort((a, b) => {
                  const labelA = `${a.ligne.name} → ${a.destinationName}`
                  const labelB = `${b.ligne.name} → ${b.destinationName}`
                  return labelA.localeCompare(labelB)
                })
                .map((data) => data.id)
            )
          )
        )
      } catch (e) {
        console.error("Erreur fetchNextTrains", e)
      }
    }

    load()
    const interval = setInterval(load, 10_000) // refresh toutes les 30s

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [ignoreGares])

  const toggleIgnoreGare = (gare: string) => {
    setIgnoreGares((prev) =>
      prev.includes(gare) ? prev.filter((g) => g !== gare) : [...prev, gare]
    )
  }

  const visibleValues = useMemo(
    () => filterData(gares, ignoreGares),
    [gares, ignoreGares]
  )

  useEffect(() => {
    const url = new URL(window.location.href)
    const ignored = url.searchParams.get("ignoreGares")
    if (ignored !== null) {
      setIgnoreGares(ignored.split("_"))
    }
    setendStart(true)
  }, [])

  useEffect(() => {
    const url = new URL(window.location.href)

    if (endStart) {
      if (ignoreGares.length > 0) {
        url.searchParams.set("ignoreGares", ignoreGares.join("_"))
      } else {
        url.searchParams.delete("ignoreGares")
      }

      window.history.replaceState(null, "", url.toString())
    }
  }, [changesWidow])

  return (
    <div className="gares">
      {visibleValues.map((gare) => {
        return (
          <TrainComponent
            key={gare.ligne.id + gare.destinationName}
            {...gare}
          />
        )
      })}
      {changesWidow ? (
        <div className="changes">
          <div className="changes-panel">
            <h2>Filtres</h2>
            <div className="changes-row">
              <button onClick={() => setChangesWidow(!changesWidow)}>
                Fermer
              </button>
              <div className="list-ignore-gares">
                <p>Liste des lignes à ignorer</p>
                <div className="list-ignore-gares-buttons">
                  {listeGares.map((gareId) => {
                    const gareData = gares.find((g) => g.id === gareId)
                    const label = gareData
                      ? `${gareData.ligne.name} → ${gareData.destinationName}`
                      : gareId

                    return (
                      <div
                        key={gareId}
                        onClick={() => toggleIgnoreGare(gareId)}
                        className={
                          ignoreGares.includes(gareId)
                            ? "gare-btn gare-btn--active"
                            : "gare-btn"
                        }
                      >
                        {label}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setChangesWidow(!changesWidow)}>Ouvrir</button>
      )}
    </div>
  )
}

export default App
