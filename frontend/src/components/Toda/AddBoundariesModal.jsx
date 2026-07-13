import React, { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import AddBoundaries from './AddBoundaries'
import { createTODA, updateTODA } from '../../api/toda';

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

const getColorKeyByHex = (hex) => {
    return Object.keys(TODA_COLORS).find(
        (key) => TODA_COLORS[key].hex === hex
    );
};

function AddBoundariesModal({ fetchTodas, open, setOpen, toda }) {
    const [location, setLocation] = useState(null);
    const [name, setName] = useState("");
    const [color, setColor] = useState("blue");
    const [area, setArea] = useState();
    const [loading, setLoading] = useState(false);
    const [prefix, setPrefix] = useState();

    const selectedColor = TODA_COLORS[color]?.hex ?? toda?.color

    useEffect(() => {
        if (toda) {
            setName(toda.name);
            setColor(getColorKeyByHex(toda.color));
            var data = toda.area[0];

            
            const first = data[0];
            const last = data[data.length - 1];
            const isClosed = first[0] === last[0] && first[1] === last[1];
            setArea(isClosed ? data.slice(0, -1) : data);
            setPrefix(toda.prefix)
        } else {
            setName("");
            setColor("blue");
            setArea([]);
        }
    }, [open]);

    const handleSubmit = async () => {
        if (loading) return;

        if (!name) { alert("Please provide a name."); return; }
        if (area.length < 3) { alert("At least 3 points are needed to define an area."); return; }

        try {
            setLoading(true);

            if(toda){
                await updateTODA({ name, color: selectedColor, area, prefix }, toda.id);
            } else {
                await createTODA({ name, color: selectedColor, area, prefix });
            }

            setName("");
            setColor("blue");
            setArea([]);

            
            await fetchTodas();
            setOpen(false);
        } catch (err) {
            console.error(err);
            alert("Failed to create TODA");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger disabled={loading}>
                {loading ? "Processing..." : "Add TODA Stations"}
            </DialogTrigger>

            <DialogContent className="bg-amber-50">
                <DialogHeader>
                    <DialogTitle>{toda ? "Update" : "Add"} Boundaries</DialogTitle>
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
                    loading={loading}   
                    prefix={prefix}
                    setPrefix={setPrefix}
                />
            </DialogContent>
        </Dialog>
    )
}

export default AddBoundariesModal