import React from 'react'
import TodaCard from './TodaCard';

function TodaList({ todas, fetchTodas }) {
    if (!todas.length) return (
        <p className="text-sm text-muted-foreground text-center py-4">No TODA stations found.</p>
    );

    return (
        <div className="flex flex-col divide-y rounded-lg border overflow-hidden">
            {todas.map((toda) => (
                <TodaCard key={toda.id} toda={toda} fetchTodas={fetchTodas} />
            ))}
        </div>
    );
}

export default TodaList