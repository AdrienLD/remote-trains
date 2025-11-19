import "./train.css"
import type { InfosSortedTrains, SortedTrains } from "../../back/src/types"

function TrainComponent(train: SortedTrains) {
  return (
    <div className="carte">
      <img className="picto" src={train.ligne.picto} />
      <div className="destination">{train.destinationName}</div>
      {train.infosList.map((info, index) => (
        <TimeComponent key={index} {...info} />
      ))}
    </div>
  )
}

function TimeComponent(info: InfosSortedTrains) {
  const now = Date.now()
  const targetTime = new Date(info.expectedArrivalTime).getTime()
  const diffMs = targetTime - now
  const final = Math.floor(diffMs / 60_000)
  return (
    <div className="horaires">
      <div className="trestant" style={{ color: getStatusColor(info.status) }}>
        {final}
      </div>
      <div className="voie">{info.platform}</div>
    </div>
  )
}

function getStatusColor(status: string): string {
  switch (status) {
    case "onTime":
    case "early":
      return "white"
    case "delayed":
      return "orange"
    case "cancelled":
    case "missed":
      return "red"
    default:
      return "gray" // noReport, notExpected, inconnu...
  }
}

export default TrainComponent
