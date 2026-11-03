// How the user proves it's them before changing their password.
// Must match the backend's PASSWORD_CHANGE_VERIFIER (api/features/utils/password_change.py).
//
// To add OTP later:
//   1. backend: add an "otp" verifier and set PASSWORD_CHANGE_VERIFIER = "otp"
//   2. here: add an `otp` entry (fields: [{ name: "otp", ... }], plus `requestCode` if a code
//      has to be sent first) and set PASSWORD_CHANGE_METHOD = "otp"
// ChangePasswordModal renders whatever fields the active method lists and sends them as-is.
export const PASSWORD_CHANGE_METHOD = "current_password";

export const PASSWORD_CHANGE_METHODS = {
    current_password: {
        title: "Confirm it's you",
        description: "Enter your current password.",
        fields: [{ name: "current_password", label: "Current Password", secure: true }],
        // optional: async () => {...} to send a code before the user types it (e.g. OTP)
        requestCode: null,
    },
};

export const getPasswordChangeMethod = () => PASSWORD_CHANGE_METHODS[PASSWORD_CHANGE_METHOD];
