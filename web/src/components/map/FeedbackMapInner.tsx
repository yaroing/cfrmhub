import { Icon } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { Link } from 'react-router-dom'
import marker2x from 'leaflet/dist/images/marker-icon-2x.png'
import marker from 'leaflet/dist/images/marker-icon.png'
import shadow from 'leaflet/dist/images/marker-shadow.png'
import type { FeedbackChannel } from '../../types'
import { CHANNEL_LABELS } from '../../types'

export type MapPoint = {
  id: string
  lat: number
  lng: number
  description: string
  channel: FeedbackChannel
}

const DefaultIcon = new Icon({
  iconUrl: marker,
  iconRetinaUrl: marker2x,
  shadowUrl: shadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

type Props = { pts: MapPoint[] }

/**
 * Carte lourde (Leaflet) — chargée dynamiquement pour ne pas bloquer le JS principal du dashboard.
 */
export default function FeedbackMapInner({ pts }: Props) {
  const center: [number, number] = [pts[0].lat, pts[0].lng]

  return (
    <MapContainer
      center={center}
      zoom={5}
      className="h-full w-full"
      scrollWheelZoom
      preferCanvas
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pts.map((f) => (
        <Marker key={f.id} position={[f.lat, f.lng]} icon={DefaultIcon}>
          <Popup>
            <div className="max-w-xs text-sm">
              <p className="font-medium">{CHANNEL_LABELS[f.channel]}</p>
              <p className="line-clamp-3">{f.description}</p>
              <Link to={`/app/feedback/${f.id}`} className="text-blue-600 underline">
                Ouvrir la fiche
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
