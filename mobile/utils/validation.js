export const normalizeUsername = (value) => {
    return value.trim().replace(/\s+/g, "_")
}