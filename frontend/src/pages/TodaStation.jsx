import React, { useEffect, useState } from 'react'
import { getTODAStationList, updateTODAStation, createTODAStation, deleteTODAStation } from '../api/toda_station';
import MapComponent from '../components/MapComponent';
import { getTODAList } from '../api/toda';
import CreateUpdateStation from '../components/CreateUpdateStation';

function addPolygonToMap(name, color, area) {
    return {
        type: "Feature",
        properties: {
            name,
            color,
            fillOpacity: 0.3,
        },
        geometry: {
            type: "Polygon",
            coordinates: area,
        },
    };
}

export default function TodaStation() {
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedStation, setSelectedStation] = useState(null);

    const [todaStationList, setTodaStationList] = useState([]);
    const [markers, setMarkers] = useState([]);
    const [todas, setTodas] = useState([]);
    const [polygons, setPolygons] = useState([]);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [actionError, setActionError] = useState(null);

    const fetchTodas = async () => {
        try {
            const response = await getTODAList();
            const data = response?.data ?? response;

            setTodas(data);
            const newPolygons = data.map((toda) =>
                addPolygonToMap(toda.name, toda.color, toda.area)
            );
            setPolygons(newPolygons);
        } catch (error) {
            console.error("Error fetching TODAs:", error);
            setError("Failed to load TODA zones. Please refresh the page.");
        }
    };

    const fetchTodaStations = async () => {
        try {
            const res = await getTODAStationList();
            const data = res?.data ?? res;
            setTodaStationList(data);
        } catch (error) {
            console.error("Error fetching TODA stations:", error);
            setError("Failed to load TODA stations. Please refresh the page.");
        }
    };

    useEffect(() => {
        const loadAll = async () => {
            setLoading(true);
            setError(null);
            await Promise.all([fetchTodaStations(), fetchTodas()]);
            setLoading(false);
        };
        loadAll();
    }, []);


    useEffect(() => {
        const newMarkers = todaStationList.map((station) => ({
            latitude: station.location.lat,
            longitude: station.location.lng,
            name: station.name,
        }));
        setMarkers(newMarkers);
    }, [todaStationList]);

    const handleOpenCreate = () => {
        setSelectedStation(null);
        setActionError(null);
        setModalOpen(true);
    };

    const handleOpenEdit = (station) => {
        setSelectedStation(station);
        setActionError(null);
        setModalOpen(true);
    };

    const handleCreate = async ({ name, location }, idempotencyKey) => {
        setActionError(null);
        const created = await createTODAStation(
            { name, lat: location.lat, lng: location.lng },
            idempotencyKey
        );
        const newStation = created?.data ?? created;
        setTodaStationList((prev) => [...prev, newStation]);
    };

    const handleUpdate = async ({ id, name, location }, idempotencyKey) => {
        setActionError(null);
        const updated = await updateTODAStation(
            id,
            { name, lat: location.lat, lng: location.lng },
            idempotencyKey
        );
        const updatedStation = updated?.data ?? updated;
        setTodaStationList((prev) =>
            prev.map((s) => (s.id === id ? updatedStation : s))
        );
    };

    const handleDelete = async (station) => {
        const confirmed = window.confirm(`Delete station "${station.name}"?`);
        if (!confirmed) return;

        try {
            setActionError(null);
            await deleteTODAStation(station.id);
            setTodaStationList((prev) => prev.filter((s) => s.id !== station.id));
        } catch (error) {
            console.error("Error deleting TODA station:", error);
            setActionError("Failed to delete station. Please try again.");
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <h1 className="text-lg font-semibold">TODA Station Page</h1>
                <button
                    onClick={handleOpenCreate}
                    className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 text-sm"
                >
                    Add Station
                </button>
            </div>

            {error && (
                <div className="mb-2 p-2 bg-red-100 text-red-700 rounded-md text-sm">
                    {error}
                </div>
            )}
            {actionError && (
                <div className="mb-2 p-2 bg-red-100 text-red-700 rounded-md text-sm">
                    {actionError}
                </div>
            )}

            <div className="h-96 w-full border border-gray-300 rounded-md">
                <MapComponent
                    Markers={markers}
                    editMode={false}
                    userLocation={false}
                    areas={polygons}
                />
            </div>

            {loading ? (
                <p className="text-sm text-gray-500 mt-2">Loading stations...</p>
            ) : (
                <div className="mt-2 space-y-2">
                    {todaStationList.length === 0 && (
                        <p className="text-sm text-gray-500">No stations found.</p>
                    )}
                    {todaStationList.map((station) => (
                        <div
                            key={station.id}
                            className="flex items-center justify-between border rounded-md p-2"
                        >
                            <div>
                                <p>Name: {station.name}</p>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleOpenEdit(station)}
                                    className="px-3 py-1 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 text-sm"
                                >
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(station)}
                                    className="px-3 py-1 bg-red-500 text-white rounded-md hover:bg-red-600 text-sm"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CreateUpdateStation
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                station={selectedStation}
                onCreate={handleCreate}
                onUpdate={handleUpdate}
                areas={polygons}
            />
        </div>
    )
}