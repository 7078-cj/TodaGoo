import React, { useState } from 'react'
import AddBoundariesModal from './AddBoundariesModal'

export default function TodaCard({toda, fetchTodas}) {
    const [open, setOpen] = useState(false);

    
    return (
        <div key={toda.id} className="flex items-center gap-3 px-4 py-3">
            <div
                className="w-4 h-4 rounded-full flex-shrink-0 border border-black/10"
                style={{ backgroundColor: toda.color }}
            />
            <span className="text-sm font-medium">{toda.name}</span>
            <div>
                <AddBoundariesModal toda={toda} fetchTodas={fetchTodas} open={open} setOpen={setOpen}/>
            </div>
        </div>
    )
}
