import React, { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { getRegisteredTODAList, deleteRegisteredTODA } from '../api/registered_toda'
import RegisteredTodaModal from '../components/RegisteredTodaModal'
import DeleteConfirmModal from '../components/DeleteConfirmModal'
import UploadExcel from '../components/UploadExcel'
import Pagination from '../components/Pagination'
import Table from '../components/Table'
import SearchFilter from '../components/SearchFilter'
import colors from '../constants/colors'

const EMPTY_SEARCH = {
    driver_name: '',
    vehicle_plate: '',
    toda_station: '',
    toda_number: '',
}

export default function RegisteredTodaList() {
    const [list, setList] = useState([])
    const [loading, setLoading] = useState(false)
    const [todaOptions, setTodaOptions] = useState([])

    const [search, setSearch] = useState(EMPTY_SEARCH)            // what the user is typing
    const [debouncedSearch, setDebouncedSearch] = useState(EMPTY_SEARCH) // what we actually query

    const [modalOpen, setModalOpen] = useState(false)
    const [selected, setSelected] = useState(null)

    const [deleteOpen, setDeleteOpen] = useState(false)
    const [deleteTarget, setDeleteTarget] = useState(null)
    const [deleteLoading, setDeleteLoading] = useState(false)

    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)

    const requestId = useRef(0)      // ignore stale responses
    const lastKey = useRef(null)     // skip duplicate fetches (StrictMode)

    const fetchList = async (currentPage = page, filters = debouncedSearch) => {
        const id = ++requestId.current
        try {
            setLoading(true)

            const params = new URLSearchParams()
            Object.entries(filters).forEach(([k, v]) => {
                if (v) params.append(k, v)
            })
            params.append('page', currentPage)

            const res = await getRegisteredTODAList(params.toString())
            if (id !== requestId.current) return // a newer request replaced this one

            const results = res.results || []
            setList(results)
            setTotalPages(Math.max(1, Math.ceil((res.count || 0) / 10)))

            setTodaOptions((prev) => {
                const names = new Set(prev)
                results.forEach((r) => r.toda_name && names.add(r.toda_name))
                return Array.from(names).sort()
            })
        } catch (err) {
            console.error(err)
        } finally {
            if (id === requestId.current) setLoading(false)
        }
    }

    // 1) debounce typing -> debouncedSearch (and reset to page 1 together)
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(search) // same reference on mount = no re-render
            setPage(1)                 // no-op if already on page 1
        }, 500)
        return () => clearTimeout(handler)
    }, [search])

    // 2) the ONLY place that fetches automatically
    useEffect(() => {
        const key = JSON.stringify([page, debouncedSearch])
        if (lastKey.current === key) return // duplicate run (StrictMode) -> skip
        lastKey.current = key
        fetchList(page, debouncedSearch)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, debouncedSearch])

    // manual refresh (after delete / save / upload) - always forces a fetch
    const refresh = (p = page) => {
        lastKey.current = JSON.stringify([p, debouncedSearch])
        return fetchList(p, debouncedSearch)
    }

    const handleUploadSuccess = () => {
        if (page !== 1) setPage(1) // effect fetches page 1
        else refresh(1)
    }

    const handleEdit = (item) => {
        setSelected(item)
        setModalOpen(true)
    }

    const handleAdd = () => {
        setSelected(null)
        setModalOpen(true)
    }

    const handleDeleteConfirm = async () => {
        try {
            setDeleteLoading(true)
            await deleteRegisteredTODA(deleteTarget.id)
            await refresh(page)
            setDeleteOpen(false)
        } catch (err) {
            console.error(err)
            alert('Failed to delete.')
        } finally {
            setDeleteLoading(false)
        }
    }

    return (
        <div
            className="min-h-screen p-6 flex flex-col gap-5"
            style={{ backgroundColor: colors.background }}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <h1 className="text-2xl font-bold" style={{ color: colors.text }}>
                    TODA Drivers
                </h1>

                <div className="flex items-center gap-2">
                    <UploadExcel onSuccess={handleUploadSuccess} />
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg hover:opacity-90 transition"
                        style={{ backgroundColor: colors.primary, color: colors.onPrimary }}
                    >
                        <Plus className="w-4 h-4" /> Add
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
                <SearchFilter
                    filters={[
                        { key: 'driver_name', placeholder: 'Driver name' },
                        {
                            key: 'toda_station',
                            type: 'select',
                            placeholder: 'All TODAs',
                            options: todaOptions,
                        },
                        { key: 'vehicle_plate', placeholder: 'Plate number' },
                        { key: 'toda_number', placeholder: 'TODA number' },
                    ]}
                    search={search}
                    setSearch={setSearch}
                    emptySearch={EMPTY_SEARCH}
                />
            </div>

            {/* Table card */}
            <div
                className="rounded-2xl p-3 shadow-sm"
                style={{ backgroundColor: colors.surface }}
            >
                <Table
                    row={['Drivers', 'Plate No.', 'TODA', 'Registration date', '']}
                    list={list}
                    loading={loading}
                    page={page}
                    dataRender={[
                        { accessor: 'driver_name', type: 'avatar', className: 'font-medium' },
                        { accessor: 'vehicle_plate', className: '' },
                        { accessor: 'toda_name', className: '' },
                        { accessor: 'registration_date', className: '' },
                    ]}
                    handleEdit={handleEdit}
                    setDeleteTarget={setDeleteTarget}
                    setDeleteOpen={setDeleteOpen}
                />

                <Pagination page={page} setPage={setPage} totalPages={totalPages} />
            </div>

            <RegisteredTodaModal
                open={modalOpen}
                setOpen={setModalOpen}
                selected={selected}
                fetchList={() => refresh(page)}
            />

            <DeleteConfirmModal
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleDeleteConfirm}
                loading={deleteLoading}
                itemName={deleteTarget?.driver_name}
            />
        </div>
    )
}