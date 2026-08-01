import React, { useState } from 'react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import MapComponent from './MapComponent';

export default function CreateUpdateStation({ station, open, onClose, onCreate, onUpdate }) {
    const [name, setName] = useState(station ? station.name : '');
    const [location, setLocation] = useState(station ? station.location : { lat: null, lng: null });

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !location.lat || !location.lng) {
            alert('Please fill in all fields and select a location on the map.');
            return;
        }

        if (station) {
            onUpdate({ id: station.id, name, location });
        } else {
            onCreate({ name, location });
        }

        setName('');
        setLocation({ lat: null, lng: null });

        onClose();
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
                    />

                    <MapComponent
                        location={location}
                        setLocation={setLocation}
                        editable={true}
                    />

                    <button
                        type="submit"
                        className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                    >
                        {station ? 'Update' : 'Create'} Station
                    </button>
                </form>
            </DialogContent>
        </Dialog>
    )
}