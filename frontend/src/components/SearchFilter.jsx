import React from 'react'
import { Search } from 'lucide-react'

export default function SearchFilter({filters=[], search, setSearch}) {
    return (
        <>
            {filters.map(({ key, placeholder }) => (
                <div key={key} className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                        value={search[key]}
                        onChange={(e) =>
                            setSearch((p) => ({ ...p, [key]: e.target.value }))
                        }
                        placeholder={placeholder}
                        className="pl-7 pr-3 py-2 text-sm rounded-lg border bg-background w-40"
                    />

                    
                </div>
            ))}

            <div className="border-l h-5" />

                <button
                    onClick={() =>
                        setSearch({
                            driver_name: '',
                            vehicle_plate: '',
                            toda_station: '',
                            toda_number: ''
                        })
                    }
                    className="px-3 py-2 text-sm rounded-lg border"
                >
                    Clear
                </button>
        </>
    )
}
