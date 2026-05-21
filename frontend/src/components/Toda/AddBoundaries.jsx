import React, { useState } from 'react'
import MapComponent from '../MapComponent';
import { MapPin, Plus, Trash2, CheckCircle } from 'lucide-react';

function AddBoundaries({
    name,
    setName,
    selectedColor,
    setColor,
    area,
    setArea,
    TODA_COLORS,
    handleSubmit,
    loading
}) {
    const [pendingPoint, setPendingPoint] = useState({ lat: null, lng: null });

    const markers = area.map((coord, i) => ({
        id: i,
        name: `Point ${i + 1}`,
        latitude: coord[1],
        longitude: coord[0],
    }));

    const previewAreas = area.length >= 3
        ? [{
            type: "Feature",
            properties: {
                name: name || "New boundary",
                color: TODA_COLORS[selectedColor]?.hex ?? selectedColor,
                fillOpacity: 0.2,
            },
            geometry: {
                type: "Polygon",
                coordinates: [area],
            },
        }]
        : [];

    const handleAddPoint = () => {
        if (loading) return;
        if (!pendingPoint.lat || !pendingPoint.lng) return;

        setArea((prev) => [...prev, [pendingPoint.lng, pendingPoint.lat]]);
        setPendingPoint({ lat: null, lng: null });
    };

    const handleRemovePoint = (index) => {
        if (loading) return;
        setArea((prev) => prev.filter((_, i) => i !== index));
    };

    const handleAddBoundaries = async (e) => {
        e.preventDefault();

        if (loading) return;
        if (!name) return alert("Please provide a name.");
        if (area.length < 3) return alert("At least 3 points are needed to define an area.");

        await handleSubmit();
    };

    return (
        <div className="flex flex-col gap-3 h-full">

            {/* Name + Color */}
            <div className="flex gap-2">
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Boundary name…"
                    disabled={loading}
                    className="flex-1 px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                />

                <select
                    value={selectedColor}
                    onChange={(e) => setColor(e.target.value)}
                    disabled={loading}
                    className="px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                    {Object.values(TODA_COLORS).map(({ value, label, hex }) => (
                        <option key={value} value={value}>
                            {label} ({hex})
                        </option>
                    ))}
                </select>

                <div
                    className="w-10 h-10 rounded-lg border shadow-inner flex-shrink-0"
                    style={{
                        backgroundColor: TODA_COLORS[selectedColor]?.hex ?? selectedColor
                    }}
                />
            </div>

            {/* Map */}
            <div className="flex-1 rounded-xl overflow-hidden border min-h-[260px]">
                <MapComponent
                    location={{ lat: pendingPoint.lat, lng: pendingPoint.lng }}
                    areas={previewAreas}
                    setLocation={setPendingPoint}
                    editMode={true}
                    Markers={markers}
                />
            </div>

            {/* Pending point */}
            {pendingPoint.lat && pendingPoint.lng ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted text-sm">
                    <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0" />
                    <span className="flex-1 font-mono text-xs">
                        {pendingPoint.lat.toFixed(6)}, {pendingPoint.lng.toFixed(6)}
                    </span>

                    <button
                        onClick={handleAddPoint}
                        disabled={loading}
                        className="flex items-center gap-1 px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50"
                    >
                        <Plus className="w-3 h-3" /> Add Point
                    </button>
                </div>
            ) : (
                <p className="text-xs text-muted-foreground text-center py-1">
                    Click anywhere on the map to select a point
                </p>
            )}

            {/* Points list */}
            {markers.length > 0 && (
                <div className="rounded-lg border divide-y max-h-36 overflow-y-auto text-sm">
                    {markers.map((m, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                            <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                                {i + 1}
                            </span>

                            <span className="flex-1 font-mono text-xs text-muted-foreground">
                                {m.latitude.toFixed(5)}, {m.longitude.toFixed(5)}
                            </span>

                            <button
                                onClick={() => handleRemovePoint(i)}
                                disabled={loading}
                                className="text-muted-foreground hover:text-destructive disabled:opacity-40"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Submit */}
            <button
                onClick={handleAddBoundaries}
                disabled={loading || !name || area.length < 3}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
                {loading ? (
                    <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                    </>
                ) : (
                    <>
                        <CheckCircle className="w-4 h-4" />
                        Save Boundary
                    </>
                )}
            </button>
        </div>
    );
}

export default AddBoundaries;