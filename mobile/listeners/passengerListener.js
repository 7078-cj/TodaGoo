import useWebSocket from "../hooks/useWebsocket";

export default function passengerListener(userId, onRefresh){
    return useWebSocket(
        `ws/passenger/${userId}`,
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