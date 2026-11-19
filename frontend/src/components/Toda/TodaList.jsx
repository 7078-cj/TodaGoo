import React from 'react'
import TodaCard from './TodaCard'
import colors from '../../constants/colors' // adjust path

function TodaList({ todas, fetchTodas }) {
    if (!todas.length)
        return (
            <p className="text-sm text-center py-6" style={{ color: colors.dark }}>
                No TODA stations found.
            </p>
        )

    // The outer card (border, rounded corners, "TODA Stations" title) lives in TodaPage
    return (
        <div className="flex flex-col">
            {/* Column headers – widths must match the Meta widths in TodaCard */}
            <div
                className="hidden md:flex items-center gap-4 px-6 py-2 text-[11px] uppercase tracking-wide border-t"
                style={{ borderColor: colors.border, color: colors.dark }}
            >
                <span className="w-11 shrink-0" />
                <span className="flex-1 opacity-50">Station</span>
                <span className="w-24 opacity-50">Base fare</span>
                <span className="w-28 opacity-50">Boundary</span>
                <span className="hidden lg:block w-24 opacity-50">Area</span>
                <span className="hidden xl:block w-28 opacity-50">Color</span>
                <span className="hidden lg:block w-28 opacity-50">Created</span>
                <span className="w-[68px] shrink-0" />
            </div>

            {todas.map((toda) => (
                <TodaCard key={toda.id} toda={toda} fetchTodas={fetchTodas} />
            ))}
        </div>
    )
}

export default TodaList