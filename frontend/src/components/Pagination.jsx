import React from 'react'
import {ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({page, setPage, totalPages}) {
    const goPrev = () => {
        if (page > 1) setPage((p) => p - 1);
    };

    const goNext = () => {
        if (page < totalPages) setPage((p) => p + 1);
    };
    
    return (
        <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground">
                Page {page} of {totalPages}
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={goPrev}
                    disabled={page === 1}
                    className="px-3 py-1 border rounded disabled:opacity-40"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                <button
                    onClick={goNext}
                    disabled={page === totalPages}
                    className="px-3 py-1 border rounded disabled:opacity-40"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    )
}
