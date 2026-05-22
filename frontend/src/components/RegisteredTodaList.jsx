import React, { useEffect, useState } from 'react'
import { Pencil, Trash2, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { getRegisteredTODAList, deleteRegisteredTODA } from '../api/registered_toda'
import RegisteredTodaModal from './RegisteredTodaModal'
import DeleteConfirmModal from './DeleteConfirmModal'
import UploadExcel from './UploadExcel'

export default function RegisteredTodaList() {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(false);

    const [search, setSearch] = useState({
        driver_name: '',
        vehicle_plate: '',
        toda_station: '',
        toda_number: ''
    });

    const [modalOpen, setModalOpen] = useState(false);
    const [selected, setSelected] = useState(null);

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchList = async (currentPage = page) => {
        try {
            setLoading(true);

            const params = new URLSearchParams();

            Object.entries(search).forEach(([k, v]) => {
                if (v) params.append(k, v);
            });

            params.append('page', currentPage);

            const res = await getRegisteredTODAList(params.toString());

            setList(res.results || []);
            setTotalPages(Math.ceil((res.count || 0) / 10));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const handler = setTimeout(() => {
            setPage(1);
            fetchList(1);
        }, 500);

        return () => clearTimeout(handler);
    }, [search]);

    useEffect(() => {
        fetchList(page);
    }, [page]);

    const handleEdit = (item) => {
        setSelected(item);
        setModalOpen(true);
    };

    const handleAdd = () => {
        setSelected(null);
        setModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        try {
            setDeleteLoading(true);
            await deleteRegisteredTODA(deleteTarget.id);
            await fetchList(page);
            setDeleteOpen(false);
        } catch (err) {
            console.error(err);
            alert("Failed to delete.");
        } finally {
            setDeleteLoading(false);
        }
    };

    const goPrev = () => {
        if (page > 1) setPage((p) => p - 1);
    };

    const goNext = () => {
        if (page < totalPages) setPage((p) => p + 1);
    };

    return (
        <div className="flex flex-col gap-4">

            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
                {[
                    { key: 'driver_name', placeholder: 'Driver name' },
                    { key: 'vehicle_plate', placeholder: 'Plate number' },
                    { key: 'toda_station', placeholder: 'TODA station' },
                    { key: 'toda_number', placeholder: 'TODA number' },
                ].map(({ key, placeholder }) => (
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
                
                <div>
                    <UploadExcel onSuccess={() => fetchList(1)} />
                

                    <button
                    onClick={handleAdd}
                    className="ml-auto flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground"
                >
                    <Plus className="w-4 h-4" /> Add
                </button>
                </div>
                
            </div>

            {/* Table */}
            <div className="rounded-lg border overflow-hidden text-sm">
                <table className="w-full">
                    <thead className="bg-muted text-muted-foreground text-xs uppercase">
                        <tr>
                            {['#', 'Driver Name', 'Plate', 'TODA Station', 'Registration Date', ''].map((h) => (
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
                                    <td className="px-4 py-2 text-muted-foreground">
                                        {(page - 1) * 10 + i + 1}
                                    </td>
                                    <td className="px-4 py-2 font-medium">{item.driver_name}</td>
                                    <td className="px-4 py-2 font-mono">{item.vehicle_plate}</td>
                                    <td className="px-4 py-2">{item.toda_name ?? '—'}</td>
                                    <td className="px-4 py-2 text-muted-foreground">
                                        {item.registration_date}
                                    </td>
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

            {/* Pagination */}
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

            <RegisteredTodaModal
                open={modalOpen}
                setOpen={setModalOpen}
                selected={selected}
                fetchList={() => fetchList(page)}
            />

            <DeleteConfirmModal
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleDeleteConfirm}
                loading={deleteLoading}
                itemName={deleteTarget?.driver_name}
            />
        </div>
    );
}