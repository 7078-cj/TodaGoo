import { postRequest } from "../utils/requests";

// Forgot password by SMS code (backend: api/features/user/sms_reset_views.py).
// Each returns the request result ({ success, status, kind, error, data }); the screen shows
// `error`, and reads data.retry_after (seconds until a new code can be sent) and data.reset_token.

// phone: as typed; the backend normalizes it. The reply is the same whether or not the number has an account.
export const requestResetCode = (phone) => postRequest("user/sms-reset/request/", { phone });

// -> data.reset_token on success
export const verifyResetCode = (phone, otp) => postRequest("user/sms-reset/verify/", { phone, otp });

// -> data.password: the password rules it breaks, when it's too weak
export const setNewPassword = (resetToken, password) =>
    postRequest("user/sms-reset/confirm/", { reset_token: resetToken, password });
