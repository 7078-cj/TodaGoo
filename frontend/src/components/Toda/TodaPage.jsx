import React, { useState } from 'react'
import AddBoundariesModal from './AddBoundariesModal';

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
            coordinates: [area],
        },
    };
}

function TodaPage() {

    const [todas , setTodas] = useState([])
    const [polygons, setPolygons] = useState([]);

    

    return (
        <>
            <div>
                <h1>Toda Page</h1>
                <p>Welcome to the Toda Page!</p>
            </div>
            <AddBoundariesModal/>
        </>
    )
}

export default TodaPage