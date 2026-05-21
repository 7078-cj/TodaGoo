import React, { useState } from 'react'
import MapComponent from '../MapComponent';
import AddBoudaries from './AddBoudaries';

const TODA_COLORS = {
    red: { label: "Red", value: "red", hex: "#EF4444", number: 1 },
    blue: { label: "Blue", value: "blue", hex: "#3B82F6", number: 2 },
    pink: { label: "Pink", value: "pink", hex: "#EC4899", number: 3 },
    beige: { label: "Beige", value: "beige", hex: "#D4B896", number: 4 },
    green: { label: "Green", value: "green", hex: "#22C55E", number: 5 },
    orange: { label: "Orange", value: "orange", hex: "#F97316", number: 6 },
    violet: { label: "Violet", value: "violet", hex: "#7C3AED", number: 7 },
    black: { label: "Black", value: "black", hex: "#111827", number: 8 },
    yellow: { label: "Yellow", value: "yellow", hex: "#EAB308", number: 9 },
    white: { label: "White", value: "white", hex: "#F9FAFB", number: 10 },
    brown: { label: "Brown", value: "brown", hex: "#92400E", number: 11 },
};

function AddToda() {
    const [location, setLocation] = useState(null);
    const [name, setName] = useState("");
    const [color, setColor] = useState("blue");
    const [area, setArea] = useState([]);
    const [polygons, setPolygons] = useState([]);

    const selectedColor = TODA_COLORS[color].hex;
    

    return (
        <>
            
            <AddBoudaries
                name={name}
                setName={setName}
                selectedColor={selectedColor}
                setColor={setColor}
                area={area}
                setArea={setArea}
                setPolygons={setPolygons}
                TODA_COLORS={TODA_COLORS}
            />
            
            <div className="h-[50%] rounded-xl overflow-hidden border">

                <MapComponent areas={polygons} />
            </div>
        </>
    )
}

export default AddToda