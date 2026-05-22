import React, { useEffect, useState } from 'react'
import AddBoundariesModal from './AddBoundariesModal';
import TodaList from './TodaList';
import { getTODAList } from '../../api/toda';
import MapComponent from '../MapComponent';

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

    const [todas , setTodas] = useState([])
    const [polygons, setPolygons] = useState([]);
    const [open, setOpen] = useState(false);


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
        }
    };

    useEffect(() => {
        fetchTodas();
    }, []);


    return (
        <>
            <div>
                <h1>Toda Page</h1>
                <p>Welcome to the Toda Page!</p>
            </div>
            <AddBoundariesModal open={open} setOpen={setOpen} fetchTodas={fetchTodas}/>
            <div>
                <TodaList todas={todas} fetchTodas={fetchTodas}/>
            </div>
            <div className='h-[600px]'>
                <MapComponent
                    areas={polygons}
                />
            </div>
        </>
    )
}

export default TodaPage