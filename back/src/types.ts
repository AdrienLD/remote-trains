export type Line = {
  id: string
  name: string
  picto: string
}

export type Train = {
  ligne: Line
  destinationName: string
  arrivalTime: string
  expectedArrivalTime: string
  platform: string
  status: string
}

export type SortedTrains = {
  id: string
  label: string
  ligne: Line
  destinationName: string
  infosList: InfosSortedTrains[]
}

export type InfosSortedTrains = {
  arrivalTime: string
  expectedArrivalTime: string
  platform: string
  status: string
}
