import { useState, useEffect } from 'react'
import { getFarePrice } from '../api/book' 

/**
 * Fetches the fare estimate whenever start / end / stops change.
 * Debounced, and stale responses are discarded.
 */
export default function useFareEstimate(startLocation, endLocation, stops) {
    const [price, setPrice] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Only changes when a stop's coordinates change, not when its address text does
    const stopsKey = stops
        .filter((s) => s.location)
        .map((s) => `${s.location.lat},${s.location.lng}`)
        .join("|");

    useEffect(() => {
        if (!startLocation || !endLocation) {
            setPrice(null);
            setError(null);
            return;
        }

        let cancelled = false;

        // Debounce: onLocationChange can fire repeatedly while the pin is moved
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(null);

            try {
                const validStops = stops.filter((s) => s.location).map((s) => s.location);
                const fare = await getFarePrice(startLocation, endLocation, validStops);
                if (!cancelled) setPrice(fare);
                if(fare.error) setError(fare.error);
            } catch (err) {
                if (!cancelled) {
                    setPrice(null);
                    setError(err.message || "Couldn't get fare estimate.");
                }
            }finally {
                if (!cancelled) setLoading(false);
            }
        }, 500);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [
        startLocation?.lat,
        startLocation?.lng,
        endLocation?.lat,
        endLocation?.lng,
        stopsKey,
    ]);

    return { price, loading, error };
}