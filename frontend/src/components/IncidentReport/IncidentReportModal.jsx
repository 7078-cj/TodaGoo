import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import IncidentReportMap from './IncidentReportMap';

const STATUS_STYLES = {
    open: "bg-amber-100 text-amber-800 ring-amber-600/20",
    resolved: "bg-emerald-100 text-emerald-800 ring-emerald-600/20",
    dismissed: "bg-gray-100 text-gray-600 ring-gray-500/20",
};

function Field({ label, value }) {
    if (value === null || value === undefined || value === "") return null
    return (
        <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</p>
            <p className="text-sm text-gray-800">{value}</p>
        </div>
    )
}

function PersonPanel({ title, person, vehicle }) {
    if (!person) return null
    return (
        <div className="rounded-md border border-gray-200 p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
            <div className="flex items-center gap-3">
                <img
                    src={person.profile_picture}
                    alt={`${person.first_name} ${person.last_name}`}
                    className="w-14 h-14 rounded-full object-cover border border-gray-200"
                />
                <div>
                    <p className="text-sm font-medium text-gray-900">
                        {person.first_name} {person.last_name}
                    </p>
                    <p className="text-xs text-gray-500">{person.contact_number}</p>
                    {person.rating && (
                        <p className="text-xs text-amber-600">★ {person.rating}</p>
                    )}
                </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
                <Field label="Address" value={person.address} />
                <Field label="TODA #" value={person.toda_number} />
                <Field label="Plate #" value={person.vehicle_plate} />
            </div>

            {vehicle && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                    {person.vehicle_front_picture && (
                        <div>
                            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Vehicle front</p>
                            <img
                                src={person.vehicle_front_picture}
                                alt="Vehicle front"
                                className="w-full h-28 object-cover rounded-md border border-gray-200"
                            />
                        </div>
                    )}
                    {person.vehicle_back_picture && (
                        <div>
                            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Vehicle back</p>
                            <img
                                src={person.vehicle_back_picture}
                                alt="Vehicle back"
                                className="w-full h-28 object-cover rounded-md border border-gray-200"
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default function IncidentReportModal({ report, onClose }) {
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === "Escape") onClose()
        }
        document.addEventListener("keydown", onKeyDown)
        document.body.style.overflow = "hidden"
        return () => {
            document.removeEventListener("keydown", onKeyDown)
            document.body.style.overflow = ""
        }
    }, [onClose])

    if (!report) return null
    const booking = report.booking

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-lg bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4 sticky top-0 bg-white z-10">
                    <div>
                        <p className="text-lg font-semibold text-gray-900">Incident #{report.id}</p>
                        <p className="text-xs text-gray-500">
                            {new Date(report.created_at).toLocaleString()}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[report.status] ?? STATUS_STYLES.open}`}
                        >
                            {report.status}
                        </span>
                        <button
                            onClick={onClose}
                            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-5">
                    {/* Incident details */}
                    <div className="grid grid-cols-2 gap-3">
                        <Field label="Type" value={report.incident_types?.replace("_", " ")} />
                        <Field label="Injured party" value={report.injured_party} />
                        <Field label="Booking" value={booking ? `#${booking.id}` : undefined} />
                    </div>
                    {report.details && (
                        <div>
                            <p className="text-[11px] text-gray-400 uppercase tracking-wide">Details</p>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{report.details}</p>
                        </div>
                    )}

                    {/* Evidence */}
                    {report.evidence?.length > 0 && (
                        <div>
                            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Evidence</p>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {report.evidence.map((ev) => (
                                    <a key={ev.id} href={ev.file} target="_blank" rel="noreferrer">
                                        <img
                                            src={ev.file}
                                            alt="evidence"
                                            className="w-full h-24 object-cover rounded-md border border-gray-200"
                                        />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* People involved */}
                    {booking && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <PersonPanel title="Passenger" person={booking.passenger} />
                            <PersonPanel title="Driver" person={booking.driver} vehicle />
                        </div>
                    )}

                    {/* Trip info */}
                    {booking && (
                        <div className="rounded-md border border-gray-200 p-3">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Trip</p>
                            <div className="grid grid-cols-2 gap-2">
                                <Field label="Pickup" value={booking.start_address} />
                                <Field label="Drop-off" value={booking.end_address} />
                                <Field label="Trip status" value={booking.status} />
                                <Field label="Price" value={booking.price ? `₱${booking.price}` : undefined} />
                            </div>
                        </div>
                    )}

                    {/* Map */}
                    {report.location && booking && (
                        <div>
                            <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">
                                Route & incident location
                            </p>
                            <IncidentReportMap report={report} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}