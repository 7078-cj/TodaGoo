import React, { useState, useEffect, useRef } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import MapComponent from './MapComponent';

export default function CreateUpdateStation({ station, open, onClose, onCreate, onUpdate, areas }) {
    const [name, setName] = useState('');
    const [location, setLocation] = useState({ lat: null, lng: null });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const idempotencyKeyRef = useRef(null);

    useEffect(() => {
        if (open) {
            setName(station ? station.name : '');
            setLocation(station ? station.location : { lat: null, lng: null });
            setError(null);
            idempotencyKeyRef.current = uuidv4();
        }
    }, [station, open]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (submitting) return;

        if (!name || !location.lat || !location.lng) {
            alert('Please fill in all fields and select a location on the map.');
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            if (station) {
                await onUpdate({ id: station.id, name, location }, idempotencyKeyRef.current);
            } else {
                await onCreate({ name, location }, idempotencyKeyRef.current);
            }
            onClose();
        } catch (err) {
            console.error('Failed to save station:', err);
            setError(err.message || 'Failed to save station. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{station ? 'Update' : 'Create'} Station</DialogTitle>
                    <DialogDescription>
                        {station
                            ? 'Update the station name or location on the map.'
                            : 'Enter a name and select a location on the map to create a new station.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter station name..."
                        className="w-full outline-none text-sm bg-transparent border border-gray-300 rounded-md px-3 py-2"
                        disabled={submitting}
                    />
                    <div className="h-64 w-full border border-gray-300 rounded-md">
                        <MapComponent
                            location={location}
                            setLocation={setLocation}
                            editMode={true}
                            areas={areas}
                        />
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm disabled:bg-gray-400"
                    >
                        {submitting
                            ? (station ? 'Updating...' : 'Creating...')
                            : `${station ? 'Update' : 'Create'} Station`}
                    </button>
                </form>
            </DialogContent>
        </Dialog>
    )
}