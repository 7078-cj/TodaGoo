import React, { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import AddBoundaries from './AddBoundaries'
import { createTODA } from '../../api/toda';

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

function AddBoundariesModal() {
    const [location, setLocation] = useState(null);
    const [name, setName] = useState("");
    const [color, setColor] = useState("blue");
    const [area, setArea] = useState([]);

    const selectedColor = TODA_COLORS[color].hex;

    const handleSubmit = async () => {
        if (!name) { alert("Please provide a name."); return; }
        if (area.length < 3) { alert("At least 3 points are needed to define an area."); return; }

        await createTODA({ name, color: selectedColor, area });
        console.log("Submitting TODA Boundary:", { name, color: selectedColor, area });
        // Reset form after submission
        setName("");
        setColor("blue");
        setArea([]);
    }
        
    return (
        <Dialog>
            <DialogTrigger>Add TODA Stations</DialogTrigger>
            <DialogContent className="bg-amber-50">
                <DialogHeader>
                    <DialogTitle>Add Boundaries</DialogTitle>
                    <DialogDescription>
                        Define the boundaries for your area.
                    </DialogDescription>
                </DialogHeader>
                    <AddBoundaries
                        name={name}
                        setName={setName}
                        selectedColor={selectedColor}
                        setColor={setColor}
                        area={area}
                        setArea={setArea}
                        TODA_COLORS={TODA_COLORS}
                        handleSubmit={handleSubmit}
                    />

            </DialogContent>
        </Dialog>
    )
}

export default AddBoundariesModal