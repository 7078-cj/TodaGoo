import React, { useEffect, useState } from 'react'
import { Pencil, Trash2, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { getRegisteredTODAList, deleteRegisteredTODA } from '../api/registered_toda'
import RegisteredTodaModal from '../components/RegisteredTodaModal'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import UploadExcel from '../components/UploadExcel'
import Pagination from '../components/Pagination'
import Table from '../components/Table'
import SearchFilter from '../components/SearchFilter'

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
            if (page !== 1) {
                setPage(1);
            } else {
                fetchList(1);
            }
        }, 500);

        return () => clearTimeout(handler);
    }, [search]);

    useEffect(() => {
        if (page !== 1) {
            fetchList(page);
        }
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


    return (
        <div className="flex flex-col gap-4">

            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
                <SearchFilter
                    filters={[
                        { key: 'driver_name', placeholder: 'Driver name' },
                        { key: 'vehicle_plate', placeholder: 'Plate number' },
                        { key: 'toda_station', placeholder: 'TODA station' },
                        { key: 'toda_number', placeholder: 'TODA number' },
                    ]}
                    search={search}
                    setSearch={setSearch}
                />

                
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

            <Table
                row={[ 'Driver Name', 'Plate', 'TODA Station', 'Registration Date', '']}
                list={list}
                loading={loading}
                page={page}
                dataRender={[
                    { accessor: 'driver_name', className: 'px-4 py-2 font-medium' },
                    { accessor: 'vehicle_plate', className: 'px-4 py-2 font-mono' },
                    { accessor: 'toda_name', className: 'px-4 py-2' },
                    { accessor: 'registration_date', className: 'px-4 py-2 text-muted-foreground' },
                ]}
                handleEdit={handleEdit}
                setDeleteTarget={setDeleteTarget}
                setDeleteOpen={setDeleteOpen}
            />

            <Pagination
                page={page}
                setPage={setPage}
                totalPages={totalPages}
            />

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
