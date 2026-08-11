import React from 'react'
import { Map, MapMarker, MarkerContent, MarkerPopup, MarkerTooltip, MapRoute } from "@/components/ui/map";

const DEFAULT_CENTER = [120.75886839058785, 14.949553352698302];

export default function IncidentReportMap({ report }) {
    const booking = report.booking
    if (!booking) return null

    const routeCoords = (booking.routes ?? []).map((p) => [p.lng, p.lat])

    const center = report.location
        ? [report.location.lng, report.location.lat]
        : booking.start
        ? [booking.start.lng, booking.start.lat]
        : DEFAULT_CENTER

    return (
        <div className="h-56 w-full rounded-md overflow-hidden border border-gray-200">
            <Map
                center={center}
                zoom={15}
                styles={{
                    light: "https://tiles.openfreemap.org/styles/bright",
                    dark: "https://tiles.openfreemap.org/styles/bright",
                }}
            >
                {routeCoords.length > 1 && (
                    <MapRoute
                        id={`incident-route-${report.id}`}
                        coordinates={routeCoords}
                        color="#4285F4"
                        width={4}
                        opacity={0.75}
                    />
                )}

                {booking.start && (
                    <MapMarker longitude={booking.start.lng} latitude={booking.start.lat}>
                        <MarkerContent>
                            <div className="w-4 h-4 rounded-full bg-emerald-500 border-2 border-white shadow" />
                        </MarkerContent>
                        <MarkerTooltip>Pickup</MarkerTooltip>
                        <MarkerPopup>
                            <div className="p-2 text-xs max-w-[180px]">{booking.start_address}</div>
                        </MarkerPopup>
                    </MapMarker>
                )}

                {booking.end && (
                    <MapMarker longitude={booking.end.lng} latitude={booking.end.lat}>
                        <MarkerContent>
                            <div className="w-4 h-4 rounded-full bg-gray-800 border-2 border-white shadow" />
                        </MarkerContent>
                        <MarkerTooltip>Drop-off</MarkerTooltip>
                        <MarkerPopup>
                            <div className="p-2 text-xs max-w-[180px]">{booking.end_address}</div>
                        </MarkerPopup>
                    </MapMarker>
                )}

                {report.location && (
                    <MapMarker longitude={report.location.lng} latitude={report.location.lat}>
                        <MarkerContent>
                            <div className="w-5 h-5 rounded-full bg-rose-500 border-2 border-white shadow-lg" />
                        </MarkerContent>
                        <MarkerTooltip>Incident location</MarkerTooltip>
                        <MarkerPopup>
                            <div className="p-2 text-xs">
                                <p className="font-medium capitalize">{report.incident_types.replace("_", " ")}</p>
                                {report.details && <p className="text-gray-500 mt-1">{report.details}</p>}
                            </div>
                        </MarkerPopup>
                    </MapMarker>
                )}
            </Map>
        </div>
    )
}