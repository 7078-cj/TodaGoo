import React from 'react'
import { Pencil, Trash2, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'

export default function Table({row=[], list,loading, dataRender=[],handleEdit, setDeleteTarget, setDeleteOpen, page}) {
    return (
        <div className="rounded-lg border overflow-hidden text-sm">
            <table className="w-full">
                <thead className="bg-muted text-muted-foreground text-xs uppercase">
                    <tr>
                        {row.map((h) => (
                            <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                        ))}
                    </tr>
                </thead>

                <tbody className="divide-y">
                    {loading ? (
                        <tr>
                            <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                Loading...
                            </td>
                        </tr>
                    ) : list.length ? (
                        list.map((item, i) => (
                            <tr key={item.id} className="hover:bg-muted/40 transition">
                                <td key={i} className="px-4 py-2">{i}</td>
                                {dataRender &&
                                    dataRender.map((d, di) => (
                                        <td key={di} className={d.className}>{item[d.accessor]}</td>
                                    ))}
                                <td className="px-4 py-2">
                                    <div className="flex items-center gap-2 justify-end">
                                        <button onClick={() => handleEdit(item)}>
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
                            <td colSpan={6} className="text-center py-8 text-muted-foreground">
                                No records found.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    )
}
