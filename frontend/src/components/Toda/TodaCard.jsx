import React, { useState } from 'react'
import AddBoundariesModal from './AddBoundariesModal'
import DeleteConfirmModal from '../DeleteConfirmModal'
import { deleteTODA } from '../../api/toda';
import colors from '../../constants/colors'; // adjust path

const EditIcon = ({ color }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6" />
        <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const TrashIcon = ({ color }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
    </svg>
);

export default function TodaCard({ toda, fetchTodas }) {
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const handleDelete = async () => {
        try {
            setDeleteLoading(true);
            await deleteTODA(toda.id);
            await fetchTodas();
            setDeleteOpen(false);
        } catch (err) {
            console.error(err);
            alert("Failed to delete TODA");
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div
            className="flex items-center gap-4 px-6 py-3 border-t"
            style={{ borderColor: colors.border }}
        >
            <span
                className="w-4 h-4 rounded-full shrink-0"
                style={{ backgroundColor: toda.color }}
            />

            <span className="flex-1 text-sm" style={{ color: colors.dark }}>
                {toda.name}
            </span>

            <button
                onClick={() => setEditOpen(true)}
                aria-label={`Edit ${toda.name}`}
                className="p-1 rounded hover:opacity-70"
            >
                <EditIcon color={colors.dark} />
            </button>

            <button
                onClick={() => setDeleteOpen(true)}
                aria-label={`Delete ${toda.name}`}
                className="p-1 rounded hover:opacity-70"
            >
                <TrashIcon color={colors.dark} />
            </button>

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
    );
}