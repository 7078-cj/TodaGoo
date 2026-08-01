import React, { useState } from 'react'
import MapComponent from '../MapComponent';
import { MapPin, Plus, Trash2, CheckCircle, Pencil, X } from 'lucide-react';

function AddBoundaries({
    name,
    setName,
    selectedColor,
    setColor,
    area,
    setArea,
    TODA_COLORS,
    handleSubmit,
    loading,
    prefix,
    setPrefix
}) {
    const [pendingPoint, setPendingPoint] = useState({ lat: null, lng: null });
    const [editingIndex, setEditingIndex] = useState(null); // index of point being edited, or null

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

        if (editingIndex !== null) {
            // Commit edit to the existing point instead of adding a new one
            setArea((prev) =>
                prev.map((coord, i) =>
                    i === editingIndex ? [pendingPoint.lng, pendingPoint.lat] : coord
                )
            );
            setEditingIndex(null);
        } else {
            setArea((prev) => [...prev, [pendingPoint.lng, pendingPoint.lat]]);
        }

        setPendingPoint({ lat: null, lng: null });
    };

    const handleRemovePoint = (index) => {
        if (loading) return;
        setArea((prev) => prev.filter((_, i) => i !== index));
        if (editingIndex === index) {
            setEditingIndex(null);
            setPendingPoint({ lat: null, lng: null });
        }
    };

    const handleStartEditPoint = (index) => {
        if (loading) return;
        const [lng, lat] = area[index];
        setEditingIndex(index);
        setPendingPoint({ lat, lng });
    };

    const handleCancelEdit = () => {
        setEditingIndex(null);
        setPendingPoint({ lat: null, lng: null });
    };

    const handleEditCoordChange = (axis, value) => {
        const num = value === '' ? null : parseFloat(value);
        setPendingPoint((prev) => ({ ...prev, [axis]: num }));
    };

    const handleAddBoundaries = async (e) => {
        e.preventDefault();

        if (loading) return;
        if (!name.trim()) return alert("Please provide a name.");
        if (!prefix.trim()) return alert("Please provide a prefix.");
        if (!/^\d+$/.test(prefix))
            return alert("Prefix must contain numbers only.");
        if (area.length < 4)
            return alert("At least 4 points are needed to define an area.");

        await handleSubmit();
    };

    return (
        <div className="flex flex-col gap-4 h-full w-full">

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5 flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground px-0.5">
                        Boundary name
                    </label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Boundary name…"
                        disabled={loading}
                        className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />
                </div>

                <div className="sm:col-span-4 flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground px-0.5">
                        Color
                    </label>
                    <div className="flex gap-2">
                        <select
                            value={Object.keys(TODA_COLORS).find(k => TODA_COLORS[k].hex === selectedColor) ?? selectedColor}
                            onChange={(e) => setColor(e.target.value)}
                            disabled={loading}
                            className="flex-1 min-w-0 px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
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
                </div>

                <div className="sm:col-span-3 flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground px-0.5">
                        Prefix
                    </label>
                    <input
                        type="text"
                        value={prefix}
                        onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, "");
                            setPrefix(value);
                        }}
                        placeholder="Numbers only"
                        disabled={loading}
                        maxLength={2}
                        className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                    />
                </div>
            </div>

            <div className="flex-1 rounded-xl overflow-hidden border min-h-[260px]">
                <MapComponent
                    location={{ lat: pendingPoint.lat, lng: pendingPoint.lng }}
                    areas={previewAreas}
                    setLocation={setPendingPoint}
                    editMode={true}
                    Markers={markers}
                />
            </div>

            {editingIndex !== null && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/5 text-xs">
                    <Pencil className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="flex-1">
                        Editing Point {editingIndex + 1} — click the map or edit values, then confirm.
                    </span>
                    <button
                        onClick={handleCancelEdit}
                        disabled={loading}
                        className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {pendingPoint.lat != null && pendingPoint.lng != null ? (
                <div className="flex flex-col gap-2 px-3 py-2 rounded-lg border bg-muted text-sm">
                    <div className="flex items-center gap-3">
                        <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0" />
                        <div className="flex-1 grid grid-cols-2 gap-2">
                            <input
                                type="number"
                                step="any"
                                value={pendingPoint.lat ?? ''}
                                onChange={(e) => handleEditCoordChange('lat', e.target.value)}
                                placeholder="Latitude"
                                disabled={loading}
                                className="w-full px-2 py-1 text-xs font-mono rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                            />
                            <input
                                type="number"
                                step="any"
                                value={pendingPoint.lng ?? ''}
                                onChange={(e) => handleEditCoordChange('lng', e.target.value)}
                                placeholder="Longitude"
                                disabled={loading}
                                className="w-full px-2 py-1 text-xs font-mono rounded-md border bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                            />
                        </div>
                        <button
                            onClick={handleAddPoint}
                            disabled={loading}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50 flex-shrink-0"
                        >
                            {editingIndex !== null ? (
                                <>Update point</>
                            ) : (
                                <><Plus className="w-3 h-3" /> Add point</>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
                <p className="text-xs text-muted-foreground text-center py-1.5">
                    Click anywhere on the map to select a point
                </p>
            )}

            {markers.length > 0 && (
                <div className="rounded-lg border overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
                        <span className="text-xs font-medium text-muted-foreground">
                            Points
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                            {markers.length}
                        </span>
                    </div>
                    <div className="divide-y max-h-36 overflow-y-auto text-sm">
                        {markers.map((m, i) => (
                            <div
                                key={i}
                                className={`flex items-center gap-2 px-3 py-1.5 ${
                                    editingIndex === i ? 'bg-primary/5' : ''
                                }`}
                            >
                                <span className="w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                                    {i + 1}
                                </span>
                                <span className="flex-1 font-mono text-xs text-muted-foreground truncate">
                                    {m.latitude.toFixed(5)}, {m.longitude.toFixed(5)}
                                </span>
                                <button
                                    onClick={() => handleStartEditPoint(i)}
                                    disabled={loading}
                                    className="text-muted-foreground hover:text-primary disabled:opacity-40 flex-shrink-0"
                                    title="Edit point"
                                >
                                    <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => handleRemovePoint(i)}
                                    disabled={loading}
                                    className="text-muted-foreground hover:text-destructive disabled:opacity-40 flex-shrink-0"
                                    title="Remove point"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <button
                onClick={handleAddBoundaries}
                disabled={
                    loading ||
                    !name.trim() ||
                    !/^\d+$/.test(prefix) ||
                    area.length < 4
                }
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
                        Save boundary
                    </>
                )}
            </button>
        </div>
    );
}

export default AddBoundaries;