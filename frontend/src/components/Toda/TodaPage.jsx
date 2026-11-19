import React, { useEffect, useState } from 'react'
import AddBoundariesModal from './AddBoundariesModal';
import TodaList from './TodaList';
import { getTODAList } from '../../api/toda';
import MapComponent from '../MapComponent';
import colors from '../../constants/colors'; // adjust path to where your colors file lives

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

function TodaPage() {
    const [todas, setTodas] = useState([]);
    const [polygons, setPolygons] = useState([]);
    const [open, setOpen] = useState(false);

    const fetchTodas = async () => {
        try {
            const response = await getTODAList();
            const data = response?.data ?? response;

            setTodas(data);
            setPolygons(
                data.map((toda) => addPolygonToMap(toda.name, toda.color, toda.area))
            );
        } catch (error) {
            console.error("Error fetching TODAs:", error);
        }
    };

    useEffect(() => {
        fetchTodas();
    }, []);

    return (
        <div
            className="flex flex-col gap-6 w-full p-6 h-full overflow-y-auto"
            style={{ backgroundColor: colors.background }}
        >
            <AddBoundariesModal open={open} setOpen={setOpen} fetchTodas={fetchTodas} />

            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold" style={{ color: colors.text }}>
                    Boundaries
                </h1>
                <button
                    onClick={() => setOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-opacity hover:opacity-80"
                    style={{
                        backgroundColor: colors.surface,
                        color: colors.dark,
                        borderColor: colors.dark,
                    }}
                >
                    <span className="text-lg leading-none">+</span>
                    Add TODA Station
                </button>
            </div>

            {/* Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* TODA Stations card */}
                <div
                    className="rounded-2xl border overflow-hidden min-h-[400px]"
                    style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                    }}
                >
                    <h2
                        className="px-6 py-4 text-base font-medium"
                        style={{ color: colors.dark }}
                    >
                        TODA Stations
                    </h2>
                    <TodaList todas={todas} fetchTodas={fetchTodas} />
                </div>

                {/* Zone Map Overview card */}
                <div
                    className="rounded-2xl border overflow-hidden"
                    style={{
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                    }}
                >
                    <h2
                        className="px-6 py-4 text-base font-medium border-b"
                        style={{ color: colors.dark, borderColor: colors.border }}
                    >
                        Zone Map Overview
                    </h2>

                    <div className="p-4 flex flex-col gap-4">
                        <div
                            className="h-[380px] rounded-lg overflow-hidden border"
                            style={{ borderColor: colors.dark }}
                        >
                            <MapComponent areas={polygons} />
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-2">
                            {todas.map((toda) => (
                                <span
                                    key={toda.id ?? toda.name}
                                    className="flex items-center gap-2 px-3 py-1 rounded-full text-xs"
                                    style={{
                                        backgroundColor: colors.background,
                                        color: colors.dark,
                                    }}
                                >
                                    <span
                                        className="w-2.5 h-2.5 rounded-full"
                                        style={{ backgroundColor: toda.color }}
                                    />
                                    {toda.name}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TodaPage