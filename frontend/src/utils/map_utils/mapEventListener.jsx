import {useMap } from "@/components/ui/map";
import { useEffect } from "react";
import MapClickHandler from "./map";

export function MapEventListener({ editMode, setLocation }) {
    const { map, isLoaded } = useMap();

    useEffect(() => {
    if (!map || !isLoaded) return;

    // Make the click handler async
    const handleClick = async (e) => {
        const lat = e.lngLat.lat;
        const lng = e.lngLat.lng;
        await MapClickHandler({ lat, lng, setLocation, editMode });
    };

    map.on("click", handleClick);
    return () => map.off("click", handleClick);
    }, [map, isLoaded, setLocation, editMode]);

    return null;
}