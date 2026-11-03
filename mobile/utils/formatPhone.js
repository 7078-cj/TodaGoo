// "09123456745" → "+63 912 345 6745" for display; anything else is returned unchanged
export default function formatPhone(number) {
    const digits = String(number ?? "").replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("0")) {
        return `+63 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }
    return number ?? "";
}
