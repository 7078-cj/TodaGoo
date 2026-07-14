import useWebSocket from "../hooks/useWebsocket";

export default function bookingListener(bookingId, onRefresh){
    return useWebSocket(
        `ws/booking/${bookingId}`,
        {
            onOpen: () => console.log("Connected"),
            onRefresh,
            onClose: () => console.log("Disconnected"),
            onMessage: (data) => {
                console.log(data)
            }
        }
    )
}