import { View, Text } from 'react-native'
import React, { useCallback, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { getDriverEarnings } from '../../api/driver'
import colors from '../../constants/colors'
import { HERO_GREEN } from './ProfileHero'
import { ErrorState } from '../feedback'
import { LoadingScreen } from '../../components/loading';
import { LOADING_MESSAGES } from '../../constants/loading';

const peso = (amount) => `₱${Number(amount || 0).toLocaleString("en-PH")}`

function EarningsCard({ title, amount, subtitle, accent, big = false }) {
    return (
        <View
            style={{
                flex: 1,
                backgroundColor: colors.surface,
                borderRadius: 12,
                borderTopWidth: 4,
                borderTopColor: accent,
                paddingVertical: big ? 18 : 14,
                alignItems: "center",
                shadowColor: "#000",
                shadowOpacity: 0.12,
                shadowRadius: 4,
                shadowOffset: { width: 2, height: 3 },
                elevation: 3,
            }}
        >
            <Text style={{ fontSize: big ? 16 : 14, color: colors.dark }}>{title}</Text>
            <Text style={{ fontSize: big ? 22 : 18, fontWeight: "700", color: accent, marginTop: 6 }}>{peso(amount)}</Text>
            {subtitle ? <Text style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>{subtitle}</Text> : null}
        </View>
    )
}

const trips = (n) => `${n} completed trip${n === 1 ? "" : "s"}`

// Driver only. Ride-by-ride list lives in the History tab, so this shows the totals.
export default function EarningsTab() {
    const [earnings, setEarnings] = useState(null)
    const [error, setError] = useState(null)

    const load = useCallback(async () => {
        try {
            setEarnings(await getDriverEarnings())
            setError(null)
        } catch (err) {
            setError(err.message)
        }
    }, [])

    useFocusEffect(
        useCallback(() => {
            load()
        }, [load])
    )

    if (error && !earnings) {
        return <ErrorState fill={false} message={error} onRetry={load} />
    }

    if (!earnings) return <LoadingScreen fill={false} message={LOADING_MESSAGES.earnings} style={{ marginTop: 16 }} />

    return (
        <View style={{ padding: 16 }}>
            <EarningsCard big title="Today" amount={earnings.today.total} subtitle={trips(earnings.today.trips)} accent={HERO_GREEN} />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 14 }}>
                <EarningsCard title="Weekly" amount={earnings.week.total} subtitle={trips(earnings.week.trips)} accent={colors.primary} />
                <EarningsCard title="Monthly" amount={earnings.month.total} subtitle={trips(earnings.month.trips)} accent={colors.primary} />
            </View>
        </View>
    )
}
