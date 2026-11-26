import React, { useEffect, useState } from 'react'
import { CheckCircle } from 'lucide-react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import { createRegisteredTODA, updateRegisteredTODA } from '../api/registered_toda';

const EMPTY = { toda_number: '', driver_name: '', vehicle_plate: '', registration_date: '' };

// Same rules as the Django mixin
const TODA_PATTERN = /^(0[1-9]|1[01])-\d{3}$/;
const PLATE_PATTERN = /^[A-Z]{2,3}[-\s]?\d{3,4}$/;

const validators = {
    toda_number: (v) => {
        if (!v.trim()) return 'TODA number is required.';
        if (!TODA_PATTERN.test(v.trim())) return 'Format must be 01-XXX to 11-XXX (e.g., 01-123 or 10-400).';
        return '';
    },
    driver_name: (v) => (!v.trim() ? 'Driver name is required.' : ''),
    vehicle_plate: (v) => {
        if (!v.trim()) return 'Vehicle plate is required.';
        if (!PLATE_PATTERN.test(v.trim().toUpperCase())) return 'Invalid plate format (e.g., ABC1234 or ABC-1234).';
        return '';
    },
};

const validateForm = (form) => {
    const errors = {};
    Object.entries(validators).forEach(([name, fn]) => {
        const msg = fn(form[name] ?? '');
        if (msg) errors[name] = msg;
    });
    return errors;
};

// Turns DRF's { field: ["msg"] } into { field: "msg" }
const parseApiErrors = (data) => {
    if (!data || typeof data !== 'object') return {};
    return Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.join(' ') : String(v)])
    );
};

export default function RegisteredTodaModal({ open, setOpen, selected, fetchList }) {
    const [form, setForm] = useState(EMPTY);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open) {
            setErrors({});
            setForm(selected ? {
                toda_number: selected.toda_number ?? '',
                driver_name: selected.driver_name ?? '',
                vehicle_plate: selected.vehicle_plate ?? '',
                // <input type="date"> needs YYYY-MM-DD, not a full datetime string
                registration_date: selected.registration_date?.slice(0, 10) ?? '',
            } : EMPTY);
        }
    }, [open, selected]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((p) => ({ ...p, [name]: name === 'vehicle_plate' ? value.toUpperCase() : value }));
        // clear this field's error as the user edits
        setErrors((p) => ({ ...p, [name]: '' }));
    };

    const handleBlur = (e) => {
        const { name } = e.target;
        const fn = validators[name];
        if (fn) setErrors((p) => ({ ...p, [name]: fn(form[name] ?? '') }));
    };

    const handleSubmit = async () => {
        const validationErrors = validateForm(form);
        if (Object.keys(validationErrors).length) {
            setErrors(validationErrors);
            return;
        }

        const payload = {
            ...form,
            toda_number: form.toda_number.trim(),
            driver_name: form.driver_name.trim(),
            vehicle_plate: form.vehicle_plate.trim().toUpperCase(),
        };

        try {
            setLoading(true);
            if (selected) {
                await updateRegisteredTODA(selected.id, payload);
            } else {
                await createRegisteredTODA(payload);
            }
            await fetchList();
            setOpen(false);
        } catch (err) {
            console.error(err);
            const apiErrors = parseApiErrors(err?.response?.data);
            if (Object.keys(apiErrors).length) {
                setErrors(apiErrors);
            } else {
                setErrors({ form: 'Failed to save. Please try again.' });
            }
        } finally {
            setLoading(false);
        }
    };

    const fields = [
        { name: 'toda_number', label: 'TODA Number', type: 'text', required: true, placeholder: '01-123' },
        { name: 'driver_name', label: 'Driver Name', type: 'text', required: true },
        { name: 'vehicle_plate', label: 'Vehicle Plate', type: 'text', required: true, placeholder: 'ABC-1234' },
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
                    {fields.map(({ name, label, type, required, placeholder }) => (
                        <div key={name} className="flex flex-col gap-1">
                            <label htmlFor={name} className="text-xs font-medium text-muted-foreground">
                                {label}{required && <span className="text-destructive ml-0.5">*</span>}
                            </label>
                            <input
                                id={name}
                                name={name}
                                type={type}
                                value={form[name]}
                                placeholder={placeholder}
                                onChange={handleChange}
                                onBlur={handleBlur}
                                disabled={loading}
                                aria-invalid={!!errors[name]}
                                className={`px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 disabled:opacity-50 ${
                                    errors[name] ? 'border-destructive focus:ring-destructive' : 'focus:ring-ring'
                                }`}
                            />
                            {errors[name] && (
                                <p className="text-xs text-destructive">{errors[name]}</p>
                            )}
                        </div>
                    ))}

                    {(errors.form || errors.non_field_errors || errors.detail) && (
                        <p style={{ color: 'red', fontSize: '0.875rem' }} className="mt-1">
                            {errors.form || errors.non_field_errors || errors.detail}
                        </p>
                    )}

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