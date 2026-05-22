import React, { useState } from 'react'
import AddBoundariesModal from './AddBoundariesModal'
import DeleteConfirmModal from '../DeleteConfirmModal'
import { deleteTODA } from '../../api/toda';


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
        <div key={toda.id} className="flex items-center gap-3 px-4 py-3">
            <div
                className="w-4 h-4 rounded-full flex-shrink-0 border border-black/10"
                style={{ backgroundColor: toda.color }}
            />
            <span className="text-sm font-medium">{toda.name}</span>

            <div>
                <AddBoundariesModal toda={toda} fetchTodas={fetchTodas} open={editOpen} setOpen={setEditOpen} />
            </div>

            <button
                onClick={() => setDeleteOpen(true)}
                className="text-sm text-red-500 hover:underline"
            >
                Delete
            </button>

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