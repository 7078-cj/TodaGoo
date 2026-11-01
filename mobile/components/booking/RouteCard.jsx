import { View } from 'react-native'
import React from 'react'
import { Ionicons } from '@expo/vector-icons'
import colors from '../../constants/colors'
import TimelineRow from './TimelineRow'
import SquareButton from './SquareButton'

export default function RouteCard({
    startAddress,
    endAddress,
    stops,
    onPressStart,
    onPressEnd,
    onPressStop,
    onRemoveStop,
    onAddStop,
}) {
    return (
        <View
            className="rounded-2xl px-3"
            style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: "#EEE" }}
        >
            <TimelineRow
                isFirst
                icon={<Ionicons name="ellipse-outline" size={14} color={colors.dark} />}
                label="Pickup Location"
                value={startAddress}
                placeholder="Select pickup location"
                onPress={onPressStart}
            />

            {stops.map((stop, index) => (
                <TimelineRow
                    key={index}
                    icon={<Ionicons name="add-circle-outline" size={16} color={colors.dark} />}
                    label="Additional Stop"
                    value={stop.address}
                    placeholder={`Select stop ${index + 1}`}
                    onPress={() => onPressStop(index)}
                    action={
                        <SquareButton
                            name="minus"
                            color={colors.error}
                            onPress={() => onRemoveStop(index)}
                        />
                    }
                />
            ))}

            <TimelineRow
                isLast
                icon={<Ionicons name="location-outline" size={16} color={colors.dark} />}
                label="Drop-off Location"
                value={endAddress}
                placeholder="Select drop-off location"
                onPress={onPressEnd}
                action={<SquareButton name="plus" color={colors.secondary} onPress={onAddStop} />}
            />
        </View>
    );
}