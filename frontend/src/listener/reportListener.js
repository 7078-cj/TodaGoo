import useWebSocket from "../hooks/useWebsocket";

function handleReportMessage(data, setReports) {
    switch (data.type) {
        case "incident_report_update": {
            const incoming = data.report

            if (!incoming || incoming.id == null) {
                console.warn("incident_report_update without a report:", data)
                break
            }

            setReports((prev) => {
                // Remove it if the server says it was deleted
                if (data.action === "deleted") {
                    return prev.filter((r) => r.id !== incoming.id)
                }

                const exists = prev.some((r) => r.id === incoming.id)

                return exists
                    ? prev.map((r) => (r.id === incoming.id ? { ...r, ...incoming } : r))
                    : [incoming, ...prev]
            })
            break
        }

        default:
            console.log("Unhandled report message:", data)
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