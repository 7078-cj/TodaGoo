import React, { useEffect, useState } from 'react';
import { MapPin, DollarSign, User, AlertTriangle } from 'lucide-react';
import { Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    ArcElement,
    Tooltip,
    Legend,
} from 'chart.js';
import { getDashboardOverview } from '../api/toda';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend);

const RANGES = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
];

const INCIDENT_LABELS = {
    today: 'Incidents Today',
    week: 'Incidents (7 days)',
    month: 'Incidents (30 days)',
};

const STATUS_COLORS = {
    pending: '#f59e0b',
    accepted: '#3b82f6',
    in_progress: '#6366f1',
    completed: '#22c55e',
    cancelled: '#ef4444',
};

const peso = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
});

// The request helpers throw an Error with the DRF body copied onto it.
function getErrorMessage(err) {
    const messages = Object.values(err).map((v) => (Array.isArray(v) ? v.join(' ') : String(v)));
    return messages.join(' ') || err.message || 'Something went wrong.';
}

function StatCard({ title, value, icon: Icon, chipClass }) {
    return (
        <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
                <h3 className="text-base font-medium text-gray-700">{title}</h3>
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-white ${chipClass}`}>
                    <Icon size={20} />
                </div>
            </div>
            <p className="mt-2 text-3xl font-bold text-green-600">{value}</p>
        </div>
    );
}

function DonutCard({ title, labels, values, colors, format = (v) => v }) {
    const total = values.reduce((sum, v) => sum + v, 0);

    const data = {
        labels,
        datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } },
            tooltip: {
                callbacks: { label: (ctx) => ` ${ctx.label}: ${format(ctx.parsed)}` },
            },
        },
    };

    return (
        <div className="rounded-xl bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-base font-medium text-gray-700">{title}</h3>
            <div className="h-64">
                {total > 0 ? (
                    <Doughnut data={data} options={options} />
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-gray-400">
                        No data for this period
                    </div>
                )}
            </div>
        </div>
    );
}

export default function DashboardOverview() {
    const [range, setRange] = useState('today');
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false; // ignore responses from a range the user already left

        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await getDashboardOverview(range);
                if (!cancelled) setData(res);
            } catch (err) {
                if (!cancelled) setError(getErrorMessage(err));
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [range]);

    const lineData = data && {
        labels: data.chart.labels,
        datasets: [
            {
                label: 'Trips',
                data: data.chart.trips,
                borderColor: '#22c55e',
                backgroundColor: '#22c55e',
                yAxisID: 'y',
                tension: 0.4,
                pointRadius: 4,
            },
            {
                label: 'Earnings',
                data: data.chart.earnings,
                borderColor: '#f97316',
                backgroundColor: '#f97316',
                yAxisID: 'y1',
                tension: 0.4,
                pointRadius: 4,
            },
        ],
    };

    // Trips and earnings differ by orders of magnitude, so each gets its own axis.
    const lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { labels: { usePointStyle: true } },
            tooltip: {
                callbacks: {
                    label: (ctx) =>
                        ctx.dataset.label === 'Earnings'
                            ? ` Earnings: ${peso.format(ctx.parsed.y)}`
                            : ` Trips: ${ctx.parsed.y}`,
                },
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                position: 'left',
                ticks: { precision: 0 },
                title: { display: true, text: 'Trips' },
            },
            y1: {
                beginAtZero: true,
                position: 'right',
                grid: { drawOnChartArea: false },
                title: { display: true, text: 'Earnings (₱)' },
            },
        },
    };

    return (
        <div className="min-h-full bg-green-50 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-semibold text-gray-800">Dashboard Overview</h1>

                <div className="flex gap-2" role="group" aria-label="Date range">
                    {RANGES.map((r) => (
                        <button
                            key={r.key}
                            type="button"
                            aria-pressed={range === r.key}
                            onClick={() => setRange(r.key)}
                            className={
                                'rounded-md px-4 py-2 text-sm font-medium uppercase transition-colors ' +
                                'focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2 ' +
                                (range === r.key
                                    ? 'bg-green-600 text-white'
                                    : 'bg-white text-gray-700 hover:bg-green-100')
                            }
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div
                    role="alert"
                    className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                    {error}
                </div>
            )}

            {!data && isLoading && <p className="mt-6 text-sm text-gray-500">Loading dashboard…</p>}

            {data && (
                <div className={`mt-6 transition-opacity ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <StatCard
                            title="Trips"
                            value={data.stats.trips}
                            icon={MapPin}
                            chipClass="bg-blue-500"
                        />
                        <StatCard
                            title="Earnings"
                            value={peso.format(data.stats.earnings)}
                            icon={DollarSign}
                            chipClass="bg-green-500"
                        />
                        <StatCard
                            title="Active Drivers"
                            value={data.stats.active_drivers}
                            icon={User}
                            chipClass="bg-slate-500"
                        />
                        <StatCard
                            title={INCIDENT_LABELS[range]}
                            value={data.stats.incidents}
                            icon={AlertTriangle}
                            chipClass="bg-red-500"
                        />
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <div className="rounded-xl bg-white p-5 shadow-sm lg:col-span-2">
                            <h3 className="mb-3 text-base font-medium text-gray-700">
                                Completed trips and earnings
                            </h3>
                            <div className="h-80 lg:h-[34rem]">
                                <Line data={lineData} options={lineOptions} />
                            </div>
                        </div>

                        <div className="flex flex-col gap-4">
                            <DonutCard
                                title="Bookings by status"
                                labels={data.trips_by_status.map((s) => s.label)}
                                values={data.trips_by_status.map((s) => s.count)}
                                colors={data.trips_by_status.map((s) => STATUS_COLORS[s.key])}
                            />
                            <DonutCard
                                title="Earnings by TODA"
                                labels={data.earnings_by_toda.map((t) => t.name)}
                                values={data.earnings_by_toda.map((t) => t.earnings)}
                                colors={data.earnings_by_toda.map((t) => t.color)}
                                format={(v) => peso.format(v)}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}