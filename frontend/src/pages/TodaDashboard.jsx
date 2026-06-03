import React, { useMemo, useState } from "react";
import OverviewCard from "../components/OverviewCard";
import { MapPin, DollarSign, User, AlertTriangle } from "lucide-react";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from "chart.js";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);
import { Line } from "react-chartjs-2";

function TodaDashboard() {
    const [filter, setFilter] = useState("today");

    //mock data
    const mockData = useMemo(() => ({
        today: {
            overview: [
                { title: "Trips", value: 12, icon: <MapPin className="w-4 h-4" />, color: "blue" },
                { title: "Earnings", value: 2400, icon: <DollarSign className="w-4 h-4" />, color: "green" },
                { title: "Active Drivers", value: 18, icon: <User className="w-4 h-4" />, color: "amber" },
                { title: "Incidents Today", value: 1, icon: <AlertTriangle className="w-4 h-4" />, color: "red" },
            ],
            labels: ["6AM", "9AM", "12PM", "3PM", "6PM", "9PM", "12AM"],
            trips: [5, 8, 6, 10, 12, 9, 14],
            earnings: [200, 350, 300, 500, 700, 600, 900]
        },

        week: {
            overview: [
                { title: "Trips", value: 84, icon: <MapPin className="w-4 h-4" />, color: "blue" },
                { title: "Earnings", value: 16800, icon: <DollarSign className="w-4 h-4" />, color: "green" },
                { title: "Active Drivers", value: 25, icon: <User className="w-4 h-4" />, color: "amber" },
                { title: "Incidents Today", value: 5, icon: <AlertTriangle className="w-4 h-4" />, color: "red" },
            ],
            labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            trips: [40, 55, 60, 70, 80, 90, 84],
            earnings: [1200, 1400, 1500, 1600, 1700, 1800, 1680]
        },

        month: {
            overview: [
                { title: "Trips", value: 340, icon: <MapPin className="w-4 h-4" />, color: "blue" },
                { title: "Earnings", value: 68000, icon: <DollarSign className="w-4 h-4" />, color: "green" },
                { title: "Active Drivers", value: 42, icon: <User className="w-4 h-4" />, color: "amber" },
                { title: "Incidents Today", value: 18, icon: <AlertTriangle className="w-4 h-4" />, color: "red" },
            ],
            labels: ["W1", "W2", "W3", "W4", "W5", "W6", "W7"],
            trips: [200, 240, 260, 300, 320, 330, 340],
            earnings: [8000, 9000, 10000, 12000, 13000, 14000, 16000]
        }
    }), []);

    const activeData = useMemo(() => {
        return mockData[filter];
    }, [filter, mockData]);

    //render data
    const chartData = useMemo(() => ({
        labels: activeData.labels,
        datasets: [
            {
                label: "Trips",
                data: activeData.trips,
                borderColor: "#22c55e",
                backgroundColor: "rgba(34,197,94,0.2)",
                tension: 0.4,
            },
            {
                label: "Earnings",
                data: activeData.earnings,
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59,130,246,0.2)",
                tension: 0.4,
            }
        ]
    }), [activeData]);

    return (
        <div className="p-4 h-full bg-green-200 overflow-y-auto flex flex-col gap-4 ">

            
            <div className="flex w-full h-[5%] justify-between items-center ">
                <span className="text-2xl font-semibold text-gray-700">
                    Dashboard Overview
                </span>

                <div className="flex gap-2">
                    {["today", "week", "month"].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1 rounded ${
                                filter === f ? "bg-green-600 text-white" : "bg-white"
                            }`}
                        >
                            {f.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            
            <div className="flex flex-row w-full h-[15%] gap-4">
                {activeData.overview.map((item) => (
                    <OverviewCard
                        key={item.title}
                        title={item.title}
                        value={item.value}
                        icon={item.icon}
                        color={item.color}
                    />
                ))}
            </div>

            
            <div className="bg-white p-4 rounded-md h-[70%] w-[55%] flex justify-center items-center">
                <Line data={chartData} />
            </div>

        </div>
    );
}

export default TodaDashboard;