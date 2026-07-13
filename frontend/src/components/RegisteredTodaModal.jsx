import React, { useEffect, useState } from 'react'
import { CheckCircle } from 'lucide-react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import { createRegisteredTODA, updateRegisteredTODA } from '../api/registered_toda';

const EMPTY = { toda_number: '', driver_name: '', vehicle_plate: '', registration_date: '' };

export default function RegisteredTodaModal({ open, setOpen, selected, fetchList }) {
    const [form, setForm] = useState(EMPTY);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setForm(selected ? {
                toda_number: selected.toda_number ?? '',
                driver_name: selected.driver_name ?? '',
                vehicle_plate: selected.vehicle_plate ?? '',
                registration_date: selected.registration_date ?? '',
            } : EMPTY);
        }
    }, [open, selected]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((p) => ({ ...p, [name]: value }));
    };

    const handleSubmit = async () => {
        if (!form.driver_name || !form.vehicle_plate) return alert("Fill in required fields.");
        try {
            setLoading(true);
            if (selected) {
                await updateRegisteredTODA(selected.id, form);
            } else {
                await createRegisteredTODA(form);
            }
            await fetchList();
            setOpen(false);
        } catch (err) {
            console.error(err);
            alert("Failed to save.");
        } finally {
            setLoading(false);
        }
    };

    const fields = [
        { name: 'toda_number', label: 'TODA Number', type: 'text' },
        { name: 'driver_name', label: 'Driver Name', type: 'text', required: true },
        { name: 'vehicle_plate', label: 'Vehicle Plate', type: 'text', required: true },
        { name: 'registration_date', label: 'Registration Date', type: 'date' },
    ];

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="bg-amber-50 max-w-md">
                <DialogHeader>
                    <DialogTitle>{selected ? 'Update' : 'Add'} Registered TODA</DialogTitle>
                    <DialogDescription>Fill in the details below.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-col gap-3">
                    {fields.map(({ name, label, type, required }) => (
                        <div key={name} className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">
                                {label}{required && <span className="text-destructive ml-0.5">*</span>}
                            </label>
                            <input
                                name={name}
                                type={type}
                                value={form[name]}
                                onChange={handleChange}
                                disabled={loading}
                                className="px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                            />
                        </div>
                    ))}

                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-40"
                    >
                        {loading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <CheckCircle className="w-4 h-4" />
                                {selected ? 'Update' : 'Save'}
                            </>
                        )}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}