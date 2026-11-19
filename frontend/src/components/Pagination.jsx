import React from 'react'
import colors from '../constants/colors'

// builds [1, 2, 3, '…', 40] style lists
function getPages(page, total) {
    if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1)

    const pages = new Set([1, total, page - 1, page, page + 1])
    const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)

    const out = []
    sorted.forEach((p, i) => {
        if (i > 0 && p - sorted[i - 1] > 1) out.push('…')
        out.push(p)
    })
    return out
}

export default function Pagination({ page, setPage, totalPages }) {
    const btn = 'px-3 py-1 text-xs rounded-md border transition disabled:opacity-40 disabled:cursor-not-allowed'

    return (
        <div className="flex items-center justify-between px-3 pt-4 pb-1 text-xs" style={{ color: colors.dark }}>
            <span>
                Page <b>{page}</b> of {totalPages}
            </span>

            <div className="flex items-center gap-1.5">
                <button
                    className={btn}
                    style={{ borderColor: colors.border, backgroundColor: colors.surface }}
                    disabled={page <= 1}
                    onClick={() => setPage(page - 1)}
                >
                    Previous
                </button>

                {getPages(page, totalPages).map((p, i) =>
                    p === '…' ? (
                        <span key={`dots-${i}`} className="px-1 opacity-60">
                            …
                        </span>
                    ) : (
                        <button
                            key={p}
                            onClick={() => setPage(p)}
                            className="min-w-[28px] px-2 py-1 text-xs rounded-md border transition"
                            style={
                                p === page
                                    ? {
                                            backgroundColor: colors.active,
                                            borderColor: colors.active,
                                            color: colors.onPrimary,
                                        }
                                    : { borderColor: colors.border, backgroundColor: colors.surface }
                            }
                        >
                            {p}
                        </button>
                    )
                )}

                <button
                    className={btn}
                    style={{ borderColor: colors.border, backgroundColor: colors.surface }}
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                >
                    Next
                </button>
            </div>
        </div>
    )
}