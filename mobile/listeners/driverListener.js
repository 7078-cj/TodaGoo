import useWebSocket from "../hooks/useWebsocket";

export default function driverListener(userId, onRefresh){
    return useWebSocket(
        `ws/driver/${userId}`,
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