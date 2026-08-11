import React, { useEffect, useState } from 'react'
import {
    getPassengerList,
    blackListPassenger,
    unBlackListPassenger,
} from '../api/passenger';
import Table from '../components/Table';
import Pagination from '../components/Pagination';
import SearchFilter from '../components/SearchFilter';

export default function Passengers() {
    const [passengers, setPassengers] = useState([])
    const [page, setPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [loading, setLoading] = useState(false);
    const [actionLoadingId, setActionLoadingId] = useState(null);

    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

    const [search, setSearch] = useState("");
    const [minRating, setMinRating] = useState("");
    const [maxRating, setMaxRating] = useState("");
    const [blacklistedOnly, setBlacklistedOnly] = useState(false);

    const fetchPassengers = async (currentPage = page) => {
        try {
            setLoading(true);

            const params = new URLSearchParams();

            if (search) params.append('search', search);
            if (minRating) params.append('min_rating', minRating);
            if (maxRating) params.append('max_rating', maxRating);
            if (blacklistedOnly) params.append('blacklisted', 'true');
            params.append('page', currentPage);

            const res = await getPassengerList(params.toString());

            setPassengers(res.results || []);
            setTotalPages(Math.ceil((res.count || 0) / 10));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    const handleEdit = async (passenger) => {
        const isBlacklisted = passenger.passenger_profile.status === "BLACKLISTED";
        const confirmMsg = isBlacklisted
            ? `Remove ${passenger.first_name} ${passenger.last_name} from the blacklist?`
            : `Blacklist ${passenger.first_name} ${passenger.last_name}?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            setActionLoadingId(passenger.id);
            if (isBlacklisted) {
                await unBlackListPassenger(passenger.id);
            } else {
                await blackListPassenger(passenger.id);
            }
            await fetchPassengers(page);
        } catch (err) {
            console.error(err);
            alert('Failed to update passenger status.');
        } finally {
            setActionLoadingId(null);
        }
    }

    useEffect(() => {
        const handler = setTimeout(() => {
            if (page !== 1) {
                setPage(1);
            } else {
                fetchPassengers(1);
            }
        }, 500);

        return () => clearTimeout(handler);
    }, [search, minRating, maxRating, blacklistedOnly]);

    useEffect(() => {
        if (page !== 1) {
            fetchPassengers(page);
        }
    }, [page]);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
                <SearchFilter search={search} setSearch={setSearch} placeholder={"Search for Passengers....."} />

                <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={minRating}
                    onChange={(e) => setMinRating(e.target.value)}
                    placeholder="Min rating"
                    className="px-3 py-2 text-sm rounded-lg border bg-background w-28"
                />
                <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="5"
                    value={maxRating}
                    onChange={(e) => setMaxRating(e.target.value)}
                    placeholder="Max rating"
                    className="px-3 py-2 text-sm rounded-lg border bg-background w-28"
                />

                <label className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={blacklistedOnly}
                        onChange={(e) => setBlacklistedOnly(e.target.checked)}
                    />
                    Blacklisted only
                </label>
            </div>

            <Table
                row={[ 'First Name', 'Last Name', 'Status', '']}
                list={passengers}
                loading={loading}
                dataRender={[
                    { accessor: 'first_name', className: 'px-4 py-2 font-medium', profile_picture:'passenger_profile.profile_picture' },
                    { accessor: 'last_name', className: 'px-4 py-2 font-mono' },
                    { accessor: 'passenger_profile.status', className: 'px-4 py-2 capitalize' },
                ]}
                handleEdit={handleEdit}
                setDeleteTarget={setDeleteTarget}
                setDeleteOpen={setDeleteModalOpen}
                page={page}
                actionLoadingId={actionLoadingId}
            />

            <Pagination
                page={page}
                setPage={setPage}
                totalPages={totalPages}
            />
        </div>
    )
}