import React from 'react'
import { Search, ChevronDown, FilterX } from 'lucide-react'
import colors from '../constants/colors'

const baseField = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    color: colors.dark,
}

export default function SearchFilter({
    filters = null,
    search,
    setSearch,
    placeholder,
    emptySearch = {},
}) {
    if (filters) {
        return (
            <>
                {filters.map(({ key, placeholder, type, options = [] }) =>
                    type === 'select' ? (
                        <div key={key} className="relative">
                            <select
                                value={search[key]}
                                onChange={(e) =>
                                    setSearch((p) => ({ ...p, [key]: e.target.value }))
                                }
                                className="appearance-none pl-3 pr-9 py-2.5 text-sm rounded-xl border w-44 outline-none cursor-pointer focus:ring-2"
                                style={{ ...baseField, '--tw-ring-color': colors.secondary }}
                            >
                                <option value="">{placeholder}</option>
                                {options.map((o) => (
                                    <option key={o} value={o}>
                                        {o}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown
                                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                                style={{ color: colors.dark }}
                            />
                        </div>
                    ) : (
                        <div key={key} className="relative">
                            <Search
                                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-50"
                                style={{ color: colors.dark }}
                            />
                            <input
                                value={search[key]}
                                onChange={(e) =>
                                    setSearch((p) => ({ ...p, [key]: e.target.value }))
                                }
                                placeholder={placeholder}
                                className="pl-9 pr-3 py-2.5 text-sm rounded-xl border w-44 outline-none focus:ring-2 placeholder:opacity-50"
                                style={{ ...baseField, '--tw-ring-color': colors.secondary }}
                            />
                        </div>
                    )
                )}

                {/* Clear filters */}
                <button
                    onClick={() => setSearch(emptySearch)}
                    title="Clear filters"
                    className="p-2.5 rounded-xl border hover:opacity-80 transition"
                    style={baseField}
                >
                    <FilterX className="w-4 h-4" />
                </button>
            </>
        )
    }

    return (
        <div className="relative w-56">
            <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-50"
                style={{ color: colors.dark }}
            />
            <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={placeholder}
                className="pl-9 pr-3 py-2.5 text-sm rounded-xl border w-full outline-none focus:ring-2 placeholder:opacity-50"
                style={{ ...baseField, '--tw-ring-color': colors.secondary }}
            />
        </div>
    )
}