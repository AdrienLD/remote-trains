import express from "express"
import fs from "fs"
import path from "path"
import cors from "cors"
import { createHash } from "crypto"
import { InfosSortedTrains, Line, SortedTrains, Train } from "./types"
import { env } from "process"
import "dotenv/config"

const trainsDir = path.join(__dirname, "trains")
if (!fs.existsSync(trainsDir)) {
  fs.mkdirSync(trainsDir, { recursive: true })
}

const apiKey = env.API_KEY
if (!apiKey) {
  throw new Error("API_KEY manquante dans les variables d'environnement")
}

const headers = {
  Accept: "application/json",
  "Content-Type": "application/json",
  apiKey,
}

const app = express()
app.use(
  cors({
    origin: "http://localhost:5173",
  })
)
const PORT = 3000

app.get("/ping", (_req, res) => {
  res.send("pong")
})

app.get("/api/next-trains", async (_req, res) => {
  try {
    const result = await fetchData("STIF:StopArea:SP:43082:")
    res.json(result)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: "Erreur lors de la récupération des trains" })
  }
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`)
})

function getFileInfo(line: string) {
  try {
    const stats = fs.statSync(path.join(trainsDir, `${line}.json`)) // ⬅︎ lève une erreur si le fichier n'existe pas

    return {
      exists: true,
      size: stats.size,
      modifiedAt: stats.mtime,
      createdAt: stats.ctime,
    }
  } catch (err: any) {
    return { exists: false }
  }
}

async function createFileInfo(line: string) {
  const endpoint = `https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets/referentiel-des-lignes/records?where=id_line="${line}"&limit=1`
  const response = await fetch(endpoint)
  if (!response.ok) {
    throw new Error(
      `Error fetching CSV from ${endpoint}: ${response.status} ${response.statusText}`
    )
  }
  const data = await response.json()
  await fs.promises.writeFile(
    path.join(trainsDir, `${line}.json`),
    JSON.stringify(data.results[0])
  )
}

async function recuperateLineInfos(line: string) {
  if (!line) return null
  const now = Date.now()
  const DAY_MS = 24 * 60 * 60 * 1000

  const file = getFileInfo(line)

  if (
    !file ||
    !file.exists ||
    !file.modifiedAt ||
    now - file.modifiedAt.getTime() > DAY_MS
  )
    await createFileInfo(line)
  const infos = fs.readFileSync(path.join(trainsDir, `${line}.json`), "utf-8")
  return JSON.parse(infos)
}

const sortTrains = (trains: Train[]): SortedTrains[] => {
  const now = Date.now()
  const sortedTrains: SortedTrains[] = []

  for (const train of trains) {
    const expected = new Date(train.expectedArrivalTime).getTime()
    if (expected <= now) continue

    const info: InfosSortedTrains = {
      arrivalTime: train.arrivalTime,
      expectedArrivalTime: train.expectedArrivalTime,
      platform: train.platform,
      status: train.status,
    }
    const existing = sortedTrains.find(
      (t) =>
        t.ligne.id === train.ligne.id &&
        t.destinationName === train.destinationName
    )

    if (existing) {
      if (existing.infosList.length < 3 && info.status !== "arrived") {
        existing.infosList.push(info)
      }
    } else {
      const label = `${train.ligne} - ${train.destinationName}`
      sortedTrains.push({
        id: createHash("sha256").update(label).digest("hex").slice(0, 5),
        label,
        ligne: train.ligne,
        destinationName: train.destinationName,
        infosList: [info],
      })
    }
  }

  return sortedTrains.sort((a, b) => {
    const aNext = Math.min(
      ...a.infosList.map((info) => new Date(info.expectedArrivalTime).getTime())
    )
    const bNext = Math.min(
      ...b.infosList.map((info) => new Date(info.expectedArrivalTime).getTime())
    )
    return aNext - bNext
  })
}

async function fetchData(ref: string): Promise<SortedTrains[]> {
  const endpoint = `https://prim.iledefrance-mobilites.fr/marketplace/stop-monitoring?MonitoringRef=${ref}`

  const response = await fetch(endpoint, { headers })
  if (!response.ok) {
    throw new Error(
      `Error fetching data from ${endpoint}: ${response.status} ${response.statusText}`
    )
  }

  const data = (await response.json()) as any

  const delivery = data.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]

  if (!delivery || !delivery.MonitoredStopVisit) {
    console.warn("Pas de StopMonitoringDelivery ou de MonitoredStopVisit")
    return []
  }

  const trains: Train[] = await Promise.all(
    delivery.MonitoredStopVisit.map(async (visit: any) => {
      const mj = visit.MonitoredVehicleJourney
      const call = mj.MonitoredCall
      const formattedLine = mj.LineRef?.value.match(/STIF:Line::(C\d+):/)
      const lineId = formattedLine ? formattedLine[1] : null
      const LineInfos = await recuperateLineInfos(lineId)
      if (!LineInfos) return null

      const ligne: Line = {
        id: LineInfos.id_line,
        name: LineInfos.name_line,
        picto: LineInfos.picto.url,
      }

      return {
        ligne,
        destinationName: mj.DestinationName?.[0]?.value,
        arrivalTime: call?.AimedArrivalTime,
        expectedArrivalTime: call?.ExpectedArrivalTime,
        platform: call?.ArrivalPlatformName?.value ?? null,
        status: call?.ArrivalStatus,
      } as Train
    })
  )

  const validTrains = trains.filter((t): t is Train => t !== null)
  return sortTrains(validTrains)
}
