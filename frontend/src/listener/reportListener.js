import useWebSocket from "../hooks/useWebsocket";

function handleReportMessage(data, setReports) {
    switch (data.type) {
        case "incident_report_update":
            setReports((prev) => {
                const incoming = data.data;
                const exists = prev.some((r) => r.id === incoming.id);
                return exists
                    ? prev.map((r) => (r.id === incoming.id ? incoming : r))
                    : [...prev, incoming];
            });
            break;

        default:
            console.log("Unhandled report message:", data);
    }
}

export default function reportListener(department, onRefresh, setReports) {
    const { sendMessage, connected, connectionStatus } = useWebSocket(
        `ws/reports/${department}`,
        {
            onOpen: () => console.log("Connected"),
            onRefresh,
            onClose: () => console.log("Disconnected"),
            onMessage: (data) => {
                handleReportMessage(data, setReports);
            },
        }
    );

    return { sendMessage, connected, connectionStatus };
}