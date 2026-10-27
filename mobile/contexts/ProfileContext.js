import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { getDriverProfile } from "@/api/driver";       // adjust path
import { getPassengerProfile } from "@/api/passenger"; // adjust path

// role -> fetcher. Add more roles here later.
const FETCHERS = {
    driver: getDriverProfile,
    passenger: getPassengerProfile,
};

const ProfileContext = createContext(null);

export function ProfileProvider({ role, children }) {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const requestId = useRef(0);

    const normalisedRole = typeof role === "string" ? role.toLowerCase() : null;

    const refresh = useCallback(async () => {
        const fetcher = FETCHERS[normalisedRole];

        // Bump the id so any in-flight request from a previous role is ignored.
        const id = ++requestId.current;

        if (!fetcher) {
            setProfile(null);
            setError(null);
            setLoading(false);
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const data = await fetcher();
            if (id === requestId.current) setProfile(data);
            return data;
        } catch (err) {
            if (id === requestId.current) setError(err);
            return null;
        } finally {
            if (id === requestId.current) setLoading(false);
        }
    }, [normalisedRole]);

    // Fetch on mount and whenever the role changes (login / logout / switch).
    useEffect(() => {
        setProfile(null);
        refresh();
    }, [refresh]);

    const value = useMemo(
        () => ({
            role: normalisedRole,
            profile,                                   // full response: id, username, names...
            details: profile?.[`${normalisedRole}_profile`] ?? null, // nested driver_/passenger_profile
            loading,
            error,
            refresh,                                   // call after editing the profile
            setProfile,                                // for optimistic updates
        }),
        [normalisedRole, profile, loading, error, refresh]
    );

    return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
    const ctx = useContext(ProfileContext);
    if (!ctx) throw new Error("useProfile must be used inside <ProfileProvider>");
    return ctx;
}