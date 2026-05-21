import React from 'react'

function TodaList({ todas }) {
    if (!todas.length) return (
        <p className="text-sm text-muted-foreground text-center py-4">No TODA stations found.</p>
    );

    return (
        <div className="flex flex-col divide-y rounded-lg border overflow-hidden">
            {todas.map((toda) => (
                <div key={toda.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                        className="w-4 h-4 rounded-full flex-shrink-0 border border-black/10"
                        style={{ backgroundColor: toda.color }}
                    />
                    <span className="text-sm font-medium">{toda.name}</span>
                </div>
            ))}
        </div>
    );
}

export default TodaList