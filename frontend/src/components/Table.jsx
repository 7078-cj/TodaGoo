import React from 'react'
import { Pencil, Trash2 } from 'lucide-react'

const getValue = (obj, path) =>
    path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), obj);

export default function Table({
    row = [],
    list = [],
    loading = false,
    dataRender = [],
    handleEdit,
    setDeleteTarget,
    setDeleteOpen,
    page,
    actionLoadingId = null,
}) {
    const colCount = row.length || 1;

    return (
        <div className="rounded-lg border overflow-hidden text-sm">
            <table className="w-full">
                <thead className="bg-muted text-muted-foreground text-xs uppercase">
                    <tr>
                        {row.map((h) => (
                            <th
                                key={h}
                                className="px-4 py-2 text-left font-medium"
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody className="divide-y">
                    {loading ? (
                        <tr>
                            <td
                                colSpan={colCount}
                                className="text-center py-8 text-muted-foreground"
                            >
                                Loading...
                            </td>
                        </tr>
                    ) : list.length ? (
                        list.map((item) => (
                            <tr
                                key={item.id}
                                className="hover:bg-muted/40 transition"
                            >
                                {dataRender.map((d, di) => {
                                    const value = getValue(item, d.accessor);
                                    const image = d.profile_picture
                                        ? getValue(item, d.profile_picture)
                                        : null;

                                    const content = d.profile_picture ? (
                                        <div className="flex items-center gap-3">
                                            {image ? (
                                                <img
                                                    src={image}
                                                    alt={`${item.first_name || ''} profile`}
                                                    className="w-8 h-8 rounded-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                                                    {item.first_name
                                                        ?.charAt(0)
                                                        ?.toUpperCase() || '?'}
                                                </div>
                                            )}

                                            <span>{value}</span>
                                        </div>
                                    ) : (
                                        value
                                    );

                                    return (
                                        <td
                                            key={di}
                                            className={`${d.className || ''} ${
                                                d.onClick
                                                    ? 'cursor-pointer hover:underline'
                                                    : ''
                                            }`}
                                            onClick={
                                                d.onClick
                                                    ? () => d.onClick(item)
                                                    : undefined
                                            }
                                        >
                                            {content}
                                        </td>
                                    );
                                })}

                                <td className="px-4 py-2">
                                    <div className="flex items-center gap-2 justify-end">
                                        <button
                                            onClick={() => handleEdit(item)}
                                            disabled={
                                                actionLoadingId === item.id
                                            }
                                            className="disabled:opacity-40"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>

                                        <button
                                            onClick={() => {
                                                setDeleteTarget(item);
                                                setDeleteOpen(true);
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td
                                colSpan={colCount}
                                className="text-center py-8 text-muted-foreground"
                            >
                                No records found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}