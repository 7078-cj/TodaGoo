import React, { useMemo, useState } from 'react'
import AddBoundariesModal from './AddBoundariesModal'
import DeleteConfirmModal from '../DeleteConfirmModal'
import { deleteTODA } from '../../api/toda'
import colors from '../../constants/colors' // adjust path

/* ---------- icons ---------- */
const EditIcon = ({ color }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6" />
        <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
)

const TrashIcon = ({ color }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
    </svg>
)

/* ---------- helpers ---------- */

// area = [ outerRing, ...holes ], each ring = [[lng, lat], ...]
function getBoundaryInfo(area) {
    const outer = Array.isArray(area?.[0]) ? area[0] : []
    if (outer.length < 3) return { points: 0, km2: 0, path: '' }

    // closed ring repeats the first point at the end
    const first = outer[0]
    const last = outer[outer.length - 1]
    const closed = first[0] === last[0] && first[1] === last[1]
    const points = closed ? outer.length - 1 : outer.length

    // --- approximate area in km² (equirectangular projection + shoelace) ---
    const meanLat = outer.reduce((s, p) => s + p[1], 0) / outer.length
    const kmPerLng = 111.32 * Math.cos((meanLat * Math.PI) / 180)
    const kmPerLat = 110.57

    const ringArea = (ring) => {
        let sum = 0
        for (let i = 0; i < ring.length - 1; i++) {
            const [x1, y1] = [ring[i][0] * kmPerLng, ring[i][1] * kmPerLat]
            const [x2, y2] = [ring[i + 1][0] * kmPerLng, ring[i + 1][1] * kmPerLat]
            sum += x1 * y2 - x2 * y1
        }
        return Math.abs(sum) / 2
    }

    const holes = (area || []).slice(1).reduce((s, r) => s + ringArea(r), 0)
    const km2 = Math.max(0, ringArea(outer) - holes)

    // --- svg thumbnail path (36x36 box, y flipped) ---
    const lngs = outer.map((p) => p[0])
    const lats = outer.map((p) => p[1])
    const minX = Math.min(...lngs)
    const maxX = Math.max(...lngs)
    const minY = Math.min(...lats)
    const maxY = Math.max(...lats)
    const w = (maxX - minX) * kmPerLng || 1
    const h = (maxY - minY) * kmPerLat || 1
    const size = 36
    const pad = 3
    const scale = (size - pad * 2) / Math.max(w, h)
    const offX = (size - w * scale) / 2
    const offY = (size - h * scale) / 2

    const path =
        outer
            .map(([lng, lat], i) => {
                const x = offX + (lng - minX) * kmPerLng * scale
                const y = size - (offY + (lat - minY) * kmPerLat * scale)
                return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
            })
            .join(' ') + ' Z'

    return { points, km2, path }
}

const formatDate = (iso) => {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d)) return '—'
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatPeso = (n) =>
    n == null || n === ''
        ? '—'
        : `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

function Meta({ label, value, className = '' }) {
    return (
        <div className={`flex flex-col ${className}`}>
            <span className="text-[11px] uppercase tracking-wide opacity-50">{label}</span>
            <span className="text-sm font-medium">{value}</span>
        </div>
    )
}

/* ---------- component ---------- */
export default function TodaCard({ toda, fetchTodas }) {
    const [editOpen, setEditOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleteLoading, setDeleteLoading] = useState(false)

    const boundary = useMemo(() => getBoundaryInfo(toda.area), [toda.area])
    const color = toda.color || colors.secondary

    const handleDelete = async () => {
        try {
            setDeleteLoading(true)
            await deleteTODA(toda.id)
            await fetchTodas()
            setDeleteOpen(false)
        } catch (err) {
            console.error(err)
            alert('Failed to delete TODA')
        } finally {
            setDeleteLoading(false)
        }
    }

    return (
        <div
            className="flex items-center gap-4 px-6 py-3 border-t"
            style={{ borderColor: colors.border, color: colors.dark }}
        >
            {/* Boundary thumbnail */}
            <div
                className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center"
                style={{ backgroundColor: `${color}1A` }} // 10% tint of the TODA color
                title={boundary.points ? `${boundary.points} boundary points` : 'No boundary set'}
            >
                {boundary.path ? (
                    <svg width="36" height="36" viewBox="0 0 36 36">
                        <path
                            d={boundary.path}
                            fill={`${color}55`}
                            stroke={color}
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                        />
                    </svg>
                ) : (
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                )}
            </div>

            {/* Name + prefix */}
            <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{toda.name}</span>
                    {toda.prefix && (
                        <span
                            className="px-2 py-0.5 text-[11px] font-mono rounded-md shrink-0"
                            style={{ backgroundColor: colors.background, color: colors.secondary }}
                            title="TODA number prefix"
                        >
                            #{toda.prefix}
                        </span>
                    )}
                </div>

                {/* mobile-only summary (columns below are hidden on small screens) */}
                <span className="text-xs opacity-60 md:hidden">
                    {formatPeso(toda.base_fare)} · {boundary.points} pts
                </span>
            </div>

            {/* Meta columns */}
            <Meta label="Base fare" value={formatPeso(toda.base_fare)} className="hidden md:flex w-24" />
            <Meta
                label="Boundary"
                value={boundary.points ? `${boundary.points} points` : 'Not set'}
                className="hidden md:flex w-28"
            />
            <Meta
                label="Area"
                value={boundary.km2 ? `${boundary.km2.toFixed(2)} km²` : '—'}
                className="hidden lg:flex w-24"
            />
            <Meta
                label="Color"
                value={
                    <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="font-mono text-xs uppercase">{color}</span>
                    </span>
                }
                className="hidden xl:flex w-28"
            />
            <Meta label="Created" value={formatDate(toda.created_at)} className="hidden lg:flex w-28" />

            {/* Actions */}
            <div className="flex items-center gap-1 shrink-0">
                <button
                    onClick={() => setEditOpen(true)}
                    aria-label={`Edit ${toda.name}`}
                    className="p-1.5 rounded hover:opacity-70"
                >
                    <EditIcon color={colors.dark} />
                </button>

                <button
                    onClick={() => setDeleteOpen(true)}
                    aria-label={`Delete ${toda.name}`}
                    className="p-1.5 rounded hover:opacity-70"
                >
                    <TrashIcon color={colors.dark} />
                </button>
            </div>

            <AddBoundariesModal
                toda={toda}
                fetchTodas={fetchTodas}
                open={editOpen}
                setOpen={setEditOpen}
            />

            <DeleteConfirmModal
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleDelete}
                loading={deleteLoading}
                itemName={toda.name}
            />
        </div>
    )
}