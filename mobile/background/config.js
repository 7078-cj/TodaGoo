// Background work: what keeps running while TodaGoo is minimized or closed.
// Task names must stay the same across app versions (the OS remembers them).
import * as Location from "expo-location";

export const DRIVER_LOCATION_TASK = "todagoo-driver-location";
export const NOTIFICATION_SYNC_TASK = "todagoo-notification-sync";

// AsyncStorage keys shared by the app and the background tasks (tasks can't read React state)
export const BG_KEYS = {
    driverBookingId: "bg:driverBookingId", // ride the location task reports for
    locationAskedFor: "bg:locationAskedFor", // booking we last asked "Allow all the time" for
    lastNotifiedId: "bg:lastNotifiedId", // newest notification already shown / seen
};

// Driver location during an active ride
export const DRIVER_LOCATION_OPTIONS = {
    accuracy: Location.Accuracy.High,
    timeInterval: 10000, // Android: at most every 10 s (same as the on-screen interval)
    distanceInterval: 15, // metres
    pausesUpdatesAutomatically: false,
    activityType: Location.ActivityType.AutomotiveNavigation,
    showsBackgroundLocationIndicator: true, // iOS blue pill
    // Android keeps the app alive with this ongoing notification while the ride is active
    foregroundService: {
        notificationTitle: "TodaGoo ride in progress",
        notificationBody: "Sharing your location with your passenger.",
        notificationColor: "#DF6D26",
        killServiceOnDestroy: false,
    },
};

// Notification check while the app is closed. The OS decides the exact time; 15 min is the minimum.
export const NOTIFICATION_SYNC_MINUTES = 15;
// More new ones than this in one check are shown as a single summary
export const MAX_INDIVIDUAL_NOTIFICATIONS = 3;

// Android notification channels (users can mute each in system settings)
export const CHANNELS = {
    notifications: { id: "notifications", name: "Notifications" },
    bookingOffers: { id: "booking-offers", name: "Booking offers" },
};
