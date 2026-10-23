import React, { useState, useEffect } from 'react';
import { getBookingSettings, updateBookingSettings } from '../api/toda';

function getErrorMessage(err) {
    const messages = Object.values(err).map((v) => (Array.isArray(v) ? v.join(' ') : String(v)));
    return messages.join(' ') || err.message || 'Something went wrong.';
}

const inputClass =
    'mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 ' +
    'focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 ' +
    'disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400';

export default function BookingSettings() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // State names map to the BookingSettings model fields
    const [nightFare, setNightFare] = useState(false);
    const [nightFareStart, setNightFareStart] = useState('');
    const [nightFareEnd, setNightFareEnd] = useState('');
    const [nightFareMultiplier, setNightFareMultiplier] = useState('1.5');

    const applySettings = (data) => {
        setNightFare(data.is_night_fare_enabled);
        setNightFareStart(data.night_fare_start_time?.slice(0, 5) ?? '');
        setNightFareEnd(data.night_fare_multiplier_end_time?.slice(0, 5) ?? '');
        setNightFareMultiplier(String(data.night_fare_multiplier));
    };

    const fetchBookingSettings = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await getBookingSettings();
            applySettings(data);
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchBookingSettings();
    }, []);

    // Toggle saves immediately. Takes the new value so we never send stale state.
    const handleUpdateNightFare = async (enabled) => {
        setIsLoading(true);
        setError(null);
        setSuccess(null);
        setNightFare(enabled); // optimistic
        try {
            // PATCH returns the full updated settings, so no refetch needed
            const data = await updateBookingSettings({ is_night_fare_enabled: enabled });
            applySettings(data);
            setSuccess(`Night fare ${enabled ? 'enabled' : 'disabled'}.`);
        } catch (err) {
            setError(getErrorMessage(err));
            setNightFare(!enabled); // roll back
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateNightFareDetails = async () => {
        setError(null);
        setSuccess(null);

        const multiplier = parseFloat(nightFareMultiplier);
        if (Number.isNaN(multiplier) || multiplier < 1) {
            setError('Multiplier must be at least 1.0.');
            return;
        }
        if (!nightFareStart || !nightFareEnd) {
            setError('Set both a start and end time.');
            return;
        }
        if (nightFareStart === nightFareEnd) {
            setError('Night fare start time and end time cannot be the same.');
            return;
        }

        setIsLoading(true);
        try {
            const data = await updateBookingSettings({
                night_fare_start_time: nightFareStart,
                night_fare_multiplier_end_time: nightFareEnd,
                night_fare_multiplier: multiplier,
            });
            applySettings(data);
            setSuccess('Night fare details saved.');
        } catch (err) {
            setError(getErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    const multiplierValue = parseFloat(nightFareMultiplier);
    const previewValid = !Number.isNaN(multiplierValue) && multiplierValue >= 1;

    return (
        <div className="mx-auto w-full max-w-xl p-4 sm:p-6">
            <h2 className="text-xl font-semibold text-gray-900">Booking settings</h2>

            {error && (
                <div
                    role="alert"
                    className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                    {error}
                </div>
            )}
            {success && (
                <div
                    role="status"
                    className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700"
                >
                    {success}
                </div>
            )}

            <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 id="night-fare-label" className="text-base font-medium text-gray-900">
                            Night fare
                        </h3>
                        <p className="mt-0.5 text-sm text-gray-500">
                            Charge a higher fare during the hours below.
                        </p>
                    </div>

                    <button
                        type="button"
                        role="switch"
                        aria-checked={nightFare}
                        aria-labelledby="night-fare-label"
                        disabled={isLoading}
                        onClick={() => handleUpdateNightFare(!nightFare)}
                        className={
                            'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ' +
                            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ' +
                            'disabled:cursor-not-allowed disabled:opacity-60 ' +
                            (nightFare ? 'bg-indigo-600' : 'bg-gray-300')
                        }
                    >
                        <span
                            className={
                                'inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ' +
                                (nightFare ? 'translate-x-5' : 'translate-x-0.5')
                            }
                        />
                    </button>
                </div>

                <fieldset disabled={isLoading || !nightFare} className="mt-5 border-t border-gray-100 pt-5">
                    <legend className="sr-only">Night fare details</legend>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <label className="block text-sm font-medium text-gray-700">
                            Starts at
                            <input
                                type="time"
                                value={nightFareStart}
                                onChange={(e) => setNightFareStart(e.target.value)}
                                className={inputClass}
                            />
                        </label>
                        <label className="block text-sm font-medium text-gray-700">
                            Ends at
                            <input
                                type="time"
                                value={nightFareEnd}
                                onChange={(e) => setNightFareEnd(e.target.value)}
                                className={inputClass}
                            />
                        </label>
                        <label className="block text-sm font-medium text-gray-700">
                            Fare multiplier
                            <input
                                type="number"
                                min="1"
                                step="0.1"
                                value={nightFareMultiplier}
                                onChange={(e) => setNightFareMultiplier(e.target.value)}
                                className={inputClass}
                            />
                        </label>
                    </div>

                    {previewValid && (
                        <p className="mt-4 text-sm text-gray-600">
                            A ₱100 fare becomes{' '}
                            <span className="font-semibold text-gray-900">
                                ₱{(100 * multiplierValue).toFixed(2)}
                            </span>{' '}
                            between these times.
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={handleUpdateNightFareDetails}
                        className={
                            'mt-5 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 ' +
                            'text-sm font-medium text-white transition-colors hover:bg-indigo-700 ' +
                            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ' +
                            'disabled:cursor-not-allowed disabled:bg-gray-300'
                        }
                    >
                        {isLoading ? 'Saving…' : 'Save night fare details'}
                    </button>
                </fieldset>

                {!nightFare && (
                    <p className="mt-4 text-sm text-gray-500">
                        Turn on night fare to edit its hours and multiplier.
                    </p>
                )}
            </section>
        </div>
    );
}