import React, { useState } from 'react'
import MapComponent from '../MapComponent';

function AddToda() {
    const [location, setLocation] = useState(null);
    const ring = [
        [120.75, 14.94],
        [120.76, 14.94],
        [120.76, 14.95],
        [120.75, 14.95],
        ];
    return (
        <>
            
            <div className="h-full rounded-xl overflow-hidden border">
                <MapComponent areas={{
                            type: "Feature",
                            properties: { name: "Zone A", color: "#EA4335", fillOpacity: 0.3 },
                            geometry: { type: "Polygon", coordinates: [ring] }
                            }} />
            </div>
        </>
    )
}

export default AddToda