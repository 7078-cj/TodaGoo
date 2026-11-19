import React from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import colors from '../constants/colors'

function Avatar({ name = '', src }) {
    if (src) {
        return <img src={src} alt={name} className="w-8 h-8 rounded-full object-cover" />
    }
    const initials = name
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()

    return (
        <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ backgroundColor: colors.background, color: colors.secondary }}
        >
            {initials || '?'}
        </div>
    )
}

export default function Table({
    row,
    list,
    loading,
    dataRender,
    handleEdit,
    setDeleteTarget,
    setDeleteOpen,
}) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ color: colors.dark }}>
                <thead>
                    <tr style={{ backgroundColor: colors.secondary, color: colors.onPrimary }}>
                        {row.map((label, i) => (
                            <th
                                key={i}
                                className={`px-4 py-3 text-left font-medium whitespace-nowrap ${
                                    i === 0 ? 'rounded-l-xl pl-6' : ''
                                } ${i === row.length - 1 ? 'rounded-r-xl' : ''}`}
                            >
                                {label}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan={row.length} className="py-10 text-center opacity-60">
                                Loading...
                            </td>
                        </tr>
                    ) : list.length === 0 ? (
                        <tr>
                            <td colSpan={row.length} className="py-10 text-center opacity-60">
                                No records found.
                            </td>
                        </tr>
                    ) : (
                        list.map((item) => (
                            <tr
                                key={item.id}
                                className="border-b last:border-b-0 hover:bg-black/[0.02] transition"
                                style={{ borderColor: colors.border }}
                            >
                                {dataRender.map(({ accessor, className = '', type }, i) => (
                                    <td key={accessor} className={`px-4 py-3 ${i === 0 ? 'pl-6' : ''}`}>
                                        {type === 'avatar' ? (
                                            <div className="flex items-center gap-3">
                                                <Avatar name={item[accessor]} src={item.photo} />
                                                <span className={className}>{item[accessor]}</span>
                                            </div>
                                        ) : (
                                            <span className={className}>{item[accessor]}</span>
                                        )}
                                    </td>
                                ))}

                                <td className="px-4 py-3">
                                    <div className="flex items-center justify-end gap-3">
                                        <button
                                            onClick={() => handleEdit(item)}
                                            title="Edit"
                                            className="hover:opacity-60 transition"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setDeleteTarget(item)
                                                setDeleteOpen(true)
                                            }}
                                            title="Delete"
                                            className="hover:opacity-60 transition"
                                            style={{ color: colors.dark }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}