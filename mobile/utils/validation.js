export const normalizeUsername = (value) => {
    return value.trim().replace(/\s+/g, "_")
}

// Philippine mobile number as sign-up stores it ("09XXXXXXXXX"), or null when it isn't one.
// Accepts "0912 345 6789", "+63 912-345-6789", "639123456789", "9123456789".
// Same rules as the backend's normalize_ph_mobile (api/features/utils/validation.py).
export const normalizePhone = (value) => {
    let digits = String(value ?? "").replace(/\D/g, "")
    if (digits.startsWith("63") && digits.length === 12) digits = "0" + digits.slice(2)
    else if (digits.startsWith("9") && digits.length === 10) digits = "0" + digits
    return /^09\d{9}$/.test(digits) ? digits : null
}

// The app's password rules (the backend's AUTH_PASSWORD_VALIDATORS check them too):
// the first rule broken, or null when the password is fine.
export const passwordProblem = (password) => {
    if (!password) return "Password is required"
    if (password.length < 8) return "Minimum 8 characters"
    if (!/[A-Z]/.test(password)) return "Must contain at least 1 uppercase letter"
    if (!/[0-9]/.test(password)) return "Must contain at least 1 number"
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\];'`~/\\]/.test(password)) return "Must contain at least 1 special character"
    return null
}
