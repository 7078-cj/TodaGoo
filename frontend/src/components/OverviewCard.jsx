import React from 'react'

export default function OverviewCard({ title, value, icon: Icon, color }) {
    return (
        <div className="flex-1 bg-white rounded-lg shadow-lg p-4 hover:shadow-xl transition-shadow">
            <div className="flex justify-between items-center gap-2">
                <span className="text-lg font-medium text-gray-600 mb-2">{title}</span>
                <div className={`bg-${color}-500 opacity-75 p-4 rounded-2xl`}>{Icon}</div>
            </div>
            <p className="text-3xl font-bold text-green-500">{value}</p>
        </div>
    )
}
