import React from 'react'
import TodaCard from './TodaCard';
import colors from '../../constants/colors'; // adjust path

function TodaList({ todas, fetchTodas }) {
    if (!todas.length) return (
        <p
            className="text-sm text-center py-6"
            style={{ color: colors.dark }}
        >
            No TODA stations found.
        </p>
    );

    // The outer card (border, rounded corners, "TODA Stations" title) lives in TodaPage
    return (
        <div className="flex flex-col">
            {todas.map((toda) => (
                <TodaCard key={toda.id} toda={toda} fetchTodas={fetchTodas} />
            ))}
        </div>
    );
}

export default TodaList