
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { getDriverProfile } from "../api/driver";
import { getPassengerProfile } from "../api/passenger";

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

    const normalisedRole =
        typeof role === "string" ? role.trim().toLowerCase() : null;

    const refresh = useCallback(async () => {
        const id = ++requestId.current;
        const fetcher = FETCHERS[normalisedRole];


        if (!fetcher) {
            console.warn(
                "[ProfileContext] No fetcher for role:",
                normalisedRole
            );

            setProfile(null);
            setError(null);
            setLoading(false);
            return null;
        }

        setLoading(true);
        setError(null);

        try {

            const response = await fetcher();


            if (id !== requestId.current) return null;

            // Support either a direct object or an Axios response.
            const data = response?.data ?? response;

            setProfile(data);

            return data;
        } catch (err) {
            console.error(
                "[ProfileContext] Request failed:",
                err?.response?.status,
                err?.response?.data ?? err.message
            );

            if (id === requestId.current) {
                setError(err);
                setProfile(null);
            }

            return null;
        } finally {
            if (id === requestId.current) {
                setLoading(false);
            }
        }
    }, [normalisedRole]);

    useEffect(() => {
        // Invalidate requests started for a previous role.
        const id = ++requestId.current;

        setProfile(null);
        setError(null);

        if (!normalisedRole || !FETCHERS[normalisedRole]) {
            setLoading(false);
            console.warn("[ProfileContext] Invalid role:", role);
            return;
        }

        refresh();

        return () => {
            // Ignore results after unmount or role change.
            if (requestId.current === id + 1) {
                requestId.current++;
            }
        };
    }, [normalisedRole, refresh]);

    const value = useMemo(
        () => ({
            role: normalisedRole,
            profile,
            details:
                profile?.[`${normalisedRole}_profile`] ?? null,
            loading,
            error,
            refresh,
            setProfile,
        }),
        [normalisedRole, profile, loading, error, refresh]
    );

    return (
        <ProfileContext.Provider value={value}>
            {children}
        </ProfileContext.Provider>
    );
}

export function useProfile() {
    const context = useContext(ProfileContext);

    if (!context) {
        throw new Error(
            "useProfile must be used inside ProfileProvider"
        );
    }

    return context;
}
