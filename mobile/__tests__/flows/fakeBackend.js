// An in-memory stand-in for the TodaGoo backend, for the end-to-end flow tests.
// It answers the app's fetch() calls and WebSocket connections with the same paths, status codes,
// bodies and error messages as the Django backend (see the comments for where each one comes from),
// so the app's real api/*.js, utils/requests.js, AuthContext and socket listeners run unchanged.
//
//   const backend = createFakeBackend();   // installs global fetch + WebSocket
//   backend.users / backend.bookings / backend.sockets   state, to check or set up
//   backend.approveDriver(username)        what a TODA admin does in the dashboard
//   backend.offlineNext()                  the next request fails like a lost connection

const PICKUP_RADIUS_M = 150; // backend/api/features/booking/helpers/pickup_proximity.py
const OTP_MAX_ATTEMPTS = 5;

// ---- tokens: real JWT layout (header.payload.signature) so jwt-decode reads them ----
const b64url = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

function distanceM(a, b) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

const json = (status, body) => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => (body === undefined ? Promise.reject(new SyntaxError("no body")) : body),
});

// Request bodies arrive as a JSON string, or FormData when the data had a picked photo
function readBody(body) {
    if (!body) return {};
    if (typeof body === "string") return JSON.parse(body);
    if (typeof FormData !== "undefined" && body instanceof FormData) {
        // flatten "driver_profile.contact_number" keys back into objects
        const out = {};
        for (const [key, value] of body.entries()) {
            const path = key.split(".");
            let node = out;
            path.slice(0, -1).forEach((p) => (node = node[p] ??= {}));
            node[path.at(-1)] = value;
        }
        out.__multipart = true;
        return out;
    }
    return body;
}

function createFakeBackend() {
    let nextId = 1;
    const users = []; // { id, username, password, role, profile: {...}, verified, status, otp, otpAttempts }
    const bookings = [];
    const ratings = [];
    const queue = new Map(); // driver user id → { lat, lng }
    const sockets = new Map(); // "ws/driver/3" → the latest FakeSocket opened on that path
    const lastDriverLocation = new Map(); // "ws/booking/7" → { latitude, longitude }
    const idempotent = new Map(); // "user:key" → response
    const tokens = new Map(); // access / refresh string → user id
    const requests = []; // every request: { method, path, auth, body }
    let offline = 0;

    // ---------- helpers ----------
    function issueTokens(user) {
        const claims = { user_id: user.id, username: user.username, role: user.role, verified: user.verified };
        const access = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ ...claims, token_type: "access", jti: nextId++ })}.sig`;
        const refresh = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({ ...claims, token_type: "refresh", jti: nextId++ })}.sig`;
        tokens.set(access, user.id);
        tokens.set(refresh, user.id);
        return { access, refresh };
    }

    const userById = (id) => users.find((u) => u.id === id);
    const publicUser = (u) =>
        u && {
            id: u.id,
            username: u.username,
            first_name: u.first_name ?? "",
            last_name: u.last_name ?? "",
            contact_number: u.profile?.contact_number ?? "",
            profile_picture: u.profile?.profile_picture ? `/media/${u.role}_profiles/${u.username}.jpg` : null,
            rating: u.rating ?? null,
            ...(u.role === "driver" && {
                toda_number: u.profile?.toda_number ?? null,
                vehicle_plate: u.profile?.vehicle_plate ?? null,
            }),
        };
    const serializeBooking = (b) => ({
        id: b.id,
        status: b.status,
        start: b.start,
        start_address: b.start_address,
        end: b.end,
        end_address: b.end_address,
        stops: b.stops,
        routes: b.routes,
        price: b.price,
        type: b.type,
        passenger: publicUser(userById(b.passengerId)),
        driver: b.driverId ? publicUser(userById(b.driverId)) : null,
        created_at: b.created_at,
        updated_at: b.updated_at,
    });

    // Fare: ₱20 base + ₱10 / km over the first km (stands in for utils/distance.py calculate_price)
    function price(start, end, stops = []) {
        const points = [start, ...stops, end];
        let m = 0;
        for (let i = 1; i < points.length; i++) m += distanceM(points[i - 1], points[i]);
        return Math.round(20 + Math.max(0, m / 1000 - 1) * 10);
    }

    // every open socket on a path (both sides of a ride share ws/booking/<id>)
    const groups = new Map(); // path → Set<FakeSocket>
    function push(path, message) {
        for (const socket of groups.get(path) ?? []) {
            if (socket.readyState === 1) socket.receive(message);
        }
    }

    // backend/api/features/booking/signals.py booking_updated: passenger gets "booking_accepted",
    // driver gets "booking_update", for accepted / in_progress / completed
    function broadcastBooking(b) {
        const data = serializeBooking(b);
        push(`ws/passenger/${b.passengerId}`, { type: "booking_accepted", data });
        if (b.driverId) push(`ws/driver/${b.driverId}`, { type: "booking_update", data });
    }

    function touch(b) {
        b.updated_at = new Date(Date.now() + (b.__clock = (b.__clock ?? 0) + 60000 * 7)).toISOString();
    }

    // booking/signals.py → assignment: offer the new booking to the first queued driver, or tell the
    // passenger nobody is available (websocket/features/passenger.py booking_unavailable)
    function assign(b) {
        const [driverId] = [...queue.keys()].filter((id) => !b.declinedBy.includes(id));
        if (driverId == null) {
            push(`ws/passenger/${b.passengerId}`, {
                type: "booking_unavailable",
                data: { booking_id: b.id, message: "No drivers are available right now. Please try again later." },
            });
            return;
        }
        queue.delete(driverId); // an offer takes the driver out of the queue
        b.offeredTo = driverId;
        push(`ws/driver/${driverId}`, { type: "new_booking", data: serializeBooking(b) });
    }

    // ---------- HTTP ----------
    const routes = [];
    const route = (method, pattern, auth, handler) => routes.push({ method, pattern, auth, handler });

    // user/urls.py token/user (simplejwt + MyTokenObtainPairSerializer claims)
    route("POST", /^user\/token\/user$/, false, (_, body) => {
        const user = users.find((u) => u.username === body.username && u.password === body.password);
        if (!user) return json(401, { detail: "No active account found with the given credentials" });
        return json(200, issueTokens(user));
    });

    route("POST", /^user\/token\/refresh\/$/, false, (_, body) => {
        const user = userById(tokens.get(body.refresh));
        if (!user) return json(401, { detail: "Token is invalid or expired", code: "token_not_valid" });
        return json(200, issueTokens(user));
    });

    // passenger/ and driver/ registration (PassengerSerializer / DriverSerializer)
    function register(role) {
        return (_, body) => {
            const profileKey = `${role}_profile`;
            const errors = {};
            if (!body.username) errors.username = ["This field is required."];
            else if (users.some((u) => u.username === body.username))
                errors.username = ["A user with that username already exists."];
            if (!body.password) errors.password = ["This field is required."];
            else if (String(body.password).length < 8)
                errors.password = ["This password is too short. It must contain at least 8 characters."];
            if (Object.keys(errors).length) return json(400, errors);
            const profile = body[profileKey];
            if (!profile || typeof profile !== "object") return json(400, [`${profileKey} is required`]);
            if (!/^09\d{9}$/.test(String(profile.contact_number ?? "")))
                return json(400, { [profileKey]: { contact_number: ["Enter a valid mobile number (09XXXXXXXXX)."] } });
            if (role === "driver") {
                for (const photo of ["profile_picture", "vehicle_front_picture", "vehicle_back_picture"]) {
                    if (!profile[photo]) return json(400, { [profileKey]: { [photo]: ["No file was submitted."] } });
                }
                if (!body.__multipart) return json(400, { detail: "Photos must be uploaded as multipart/form-data." });
            }
            const user = {
                id: nextId++,
                username: body.username,
                password: body.password,
                first_name: body.first_name,
                last_name: body.last_name,
                role,
                profile,
                verified: false,
                // [SEC-H6] self-registered drivers wait for a TODA admin
                status: role === "driver" ? "PENDING" : "ACTIVE",
                otp: "123456",
                otpAttempts: 0,
            };
            users.push(user);
            return json(201, { ...publicUser(user), [profileKey]: { ...profile, verified: false } });
        };
    }
    route("POST", /^passenger\/$/, false, register("passenger"));
    route("POST", /^driver\/$/, false, register("driver"));

    // utils/otp.py _verify_otp / _resend_otp
    function verifyOtp(role) {
        return (user, body) => {
            if (user.role !== role) {
                const model = role === "driver" ? "Driver" : "Passenger";
                return json(404, { error: `${model} profile not found.` });
            }
            const model = role === "driver" ? "Driver" : "Passenger";
            if (user.verified) return json(200, { message: `${model} is already verified.`, ...issueTokens(user) });
            const otp = String(body.otp ?? "").trim();
            if (!/^\d{6}$/.test(otp)) return json(400, { error: "OTP must be 6 digits." });
            if (user.otpAttempts >= OTP_MAX_ATTEMPTS)
                return json(429, { error: "Too many wrong attempts. Request a new OTP." });
            if (!user.otp) return json(400, { error: "OTP expired or not found. Request a new OTP." });
            if (otp !== user.otp) {
                user.otpAttempts += 1;
                return json(400, { error: "Invalid OTP." });
            }
            user.verified = true;
            user.otp = null;
            return json(200, { message: `${model} verified.`, ...issueTokens(user) });
        };
    }
    function resendOtp(role) {
        return (user) => {
            if (user.role !== role) return json(404, { error: "profile not found." });
            user.otp = "654321";
            user.otpAttempts = 0;
            return json(200, { message: "A new OTP was sent." });
        };
    }
    route("POST", /^passenger\/verify-otp\/$/, true, verifyOtp("passenger"));
    route("POST", /^driver\/verify-otp\/$/, true, verifyOtp("driver"));
    route("POST", /^passenger\/resend-otp\/$/, true, resendOtp("passenger"));
    route("POST", /^driver\/resend-otp\/$/, true, resendOtp("driver"));

    // booking/views.py get_fare_price
    route("POST", /^booking\/fare\/$/, true, (_, __, query) => {
        const start = query.get("start");
        const end = query.get("end");
        if (!start || !end) return json(400, { error: "Start and end locations are required" });
        const parse = (s) => s.split(",").map(Number);
        const [s, e] = [parse(start), parse(end)];
        if (![...s, ...e].every(Number.isFinite)) return json(400, { error: "Invalid coordinates format" });
        const stops = query.getAll("stops").map(parse).map(([lat, lng]) => ({ lat, lng }));
        return json(200, { price: price({ lat: s[0], lng: s[1] }, { lat: e[0], lng: e[1] }, stops) });
    });

    // booking/views.py BookingView.post
    route("POST", /^booking\/$/, true, (user, body) => {
        if (user.role !== "passenger") return json(400, { error: "User is not a passenger" });
        if (bookings.some((b) => b.passengerId === user.id && ["pending", "accepted", "in_progress"].includes(b.status)))
            return json(400, { error: "You already have an ongoing or pending booking." });
        if (!body.start || !body.end) return json(400, { error: "Start and end locations are required" });
        if (![body.start.lat, body.start.lng, body.end.lat, body.end.lng].every((v) => Number.isFinite(Number(v))))
            return json(400, { error: "Invalid start or end location" });
        const now = new Date().toISOString();
        const b = {
            id: nextId++,
            status: "pending",
            passengerId: user.id,
            driverId: null,
            start: body.start,
            start_address: body.start_address,
            end: body.end,
            end_address: body.end_address,
            stops: body.stops ?? [],
            routes: body.routes ?? [],
            type: body.type,
            price: price(body.start, body.end, (body.stops ?? []).map((s) => s.location)),
            declinedBy: [],
            created_at: now,
            updated_at: now,
        };
        bookings.push(b);
        // the backend assigns on commit, after the response
        setTimeout(() => assign(b), 0);
        return json(201, serializeBooking(b));
    });

    route("DELETE", /^booking\/(\d+)\/$/, true, (user, _, __, [id]) => {
        const b = bookings.find((x) => x.id === Number(id) && x.passengerId === user.id);
        if (!b) return json(404, { error: "Booking not found" });
        if (b.status !== "pending") return json(400, { error: "Only pending bookings can be deleted." });
        bookings.splice(bookings.indexOf(b), 1);
        return json(204);
    });

    route("GET", /^booking\/(\d+)\/$/, true, (user, _, __, [id]) => {
        const b = bookings.find((x) => x.id === Number(id) && [x.passengerId, x.driverId].includes(user.id));
        return b ? json(200, serializeBooking(b)) : json(404, { error: "Booking not found" });
    });

    // booking/views.py BookingView.put (driver moves the ride on)
    route("PUT", /^booking\/(\d+)\/$/, true, (user, body, _, [id]) => {
        if (user.role !== "driver") return json(400, { error: "User is not a driver" });
        const b = bookings.find((x) => x.id === Number(id) && x.driverId === user.id);
        if (!b) return json(404, { error: "Booking not found" });
        if (body.status == null) return json(400, { error: "Status is required" });
        const next = { accepted: "in_progress", in_progress: "completed" }[b.status];
        if (body.status !== next)
            return json(400, { error: `Cannot transition booking from '${b.status}' to '${body.status}'` });
        if (body.status === "in_progress") {
            // booking/views.py get_driver_coords: the location sent, else the last one from the booking socket
            const loc = body.location ?? lastDriverLocation.get(`ws/booking/${b.id}`);
            if (loc?.latitude == null || loc?.longitude == null)
                return json(400, { error: "Your location is not available yet. Please try again." });
            const m = distanceM(b.start, { lat: loc.latitude, lng: loc.longitude });
            if (m > PICKUP_RADIUS_M)
                return json(400, {
                    error: `You are ${Math.round(m)} m from the pickup point. Get within ${PICKUP_RADIUS_M} m to pick up the passenger.`,
                });
        }
        b.status = body.status;
        touch(b);
        broadcastBooking(b);
        return json(200, serializeBooking(b));
    });

    // booking/views.py driver_queue / driver_queue_status / driver_dequeue
    route("POST", /^booking\/driver\/queue$/, true, (user, body) => {
        if (user.role !== "driver") return json(403, { error: "no driver profile for this user" });
        if (user.status === "BLACKLISTED") return json(403, { error: "driver is blacklisted" });
        if (user.status === "PENDING") return json(403, { error: "driver is awaiting TODA admin approval" });
        if (!user.verified) return json(403, { error: "driver is not verified" });
        if (body.lat == null || body.lng == null) return json(400, { error: "lat and lng are required" });
        if (queue.has(user.id)) return json(400, { error: "user already in queue" });
        queue.set(user.id, { lat: Number(body.lat), lng: Number(body.lng) });
        return json(200, { driver_id: user.id, location: { lat: body.lat, lng: body.lng } });
    });

    route("GET", /^booking\/driver\/queue\/status$/, true, (user) => {
        const active = bookings.find((b) => b.driverId === user.id && ["accepted", "in_progress"].includes(b.status));
        return json(200, {
            ready: queue.has(user.id),
            driver_id: user.id,
            en_route: !!active,
            booking_id: active?.id ?? null,
            booking_status: active?.status ?? null,
        });
    });

    route("DELETE", /^booking\/driver\/dequeue$/, true, (user) => {
        if (!queue.delete(user.id)) return json(404, { error: "driver was not in queue" });
        return json(204);
    });

    // booking/serializers.py RateCreateSerializer
    route("POST", /^booking\/rate\/$/, true, (user, body) => {
        const score = Number(body.score);
        if (!Number.isInteger(score) || score < 1 || score > 5)
            return json(400, { score: ["Ensure this value is between 1 and 5."] });
        const b = bookings.find((x) => x.id === body.booking_id);
        if (!b) return json(400, { booking_id: ["Booking not found"] });
        if (![b.driverId, b.passengerId].includes(body.user_id))
            return json(400, { user_id: ["user_id is not a participant in this booking"] });
        if (user.id === body.user_id) return json(400, { user_id: ["You cannot rate yourself"] });
        if (![b.driverId, b.passengerId].includes(user.id))
            return json(403, { detail: "You are not a participant in this booking" });
        if (b.status !== "completed") return json(400, { non_field_errors: ["You can only rate a completed ride."] });
        if (ratings.some((r) => r.raterId === user.id && r.bookingId === b.id))
            return json(400, ["You have already rated this booking"]);
        const rate = { id: nextId++, bookingId: b.id, raterId: user.id, userId: body.user_id, score, feedback: body.feedback ?? null };
        ratings.push(rate);
        const rated = userById(body.user_id);
        const theirs = ratings.filter((r) => r.userId === rated.id);
        rated.rating = theirs.reduce((s, r) => s + r.score, 0) / theirs.length;
        return json(201, { id: rate.id, booking: b.id, user: rated.id, score, feedback: rate.feedback });
    });

    route("GET", /^booking\/history\/$/, true, (user) =>
        json(
            200,
            bookings
                .filter((b) => [b.passengerId, b.driverId].includes(user.id) && ["completed", "cancelled"].includes(b.status))
                .map((b) => ({
                    ...serializeBooking(b),
                    ratings: ratings.filter((r) => r.bookingId === b.id).map(({ raterId, userId, score }) => ({ rater: raterId, user: userId, score })),
                }))
                .reverse()
        )
    );

    // admin/views.py get_toda_stations_with_prefix (public: the driver sign-up form uses it)
    const TODA_STATIONS = {
        "07": [
            { id: 71, name: "Malolos Crossing", location: { lat: 14.8433, lng: 120.8114 } },
            { id: 72, name: "Capitol Terminal", location: { lat: 14.848, lng: 120.813 } },
        ],
    };
    route("GET", /^admin\/toda-station-prefix\/$/, false, (_, __, query) => {
        const prefix = query.get("prefix");
        if (!prefix) return json(400, { error: "prefix query parameter is required." });
        if (!TODA_STATIONS[prefix]) return json(400, { error: "Invalid TODA prefix." });
        return json(200, TODA_STATIONS[prefix]);
    });

    // passenger/views.py get_profile, driver/views.py (ProfileProvider loads these)
    function me(role) {
        return (user) => {
            if (user.role !== role) return json(404, { detail: `${role === "driver" ? "Driver" : "Passenger"} profile not found.` });
            return json(200, {
                ...publicUser(user),
                email: user.email ?? "",
                [`${role}_profile`]: { ...user.profile, verified: user.verified, status: user.status },
            });
        };
    }
    route("GET", /^passenger\/me\/$/, true, me("passenger"));
    // NotificationProvider (the bell); the flows don't test notifications, so the list stays empty
    route("GET", /^user\/notifications\/$/, true, () => json(200, []));
    route("GET", /^driver\/me\/$/, true, me("driver"));

    route("GET", /^driver\/earnings\/$/, true, (user) => {
        if (user.role !== "driver") return json(404, { detail: "Driver profile not found." });
        const done = bookings.filter((b) => b.driverId === user.id && b.status === "completed");
        const sum = { total: done.reduce((s, b) => s + b.price, 0), trips: done.length };
        return json(200, { today: sum, week: sum, month: sum });
    });

    async function fetchImpl(url, options = {}) {
        if (offline > 0) {
            offline -= 1;
            throw new TypeError("Network request failed");
        }
        const [rawPath, rawQuery = ""] = String(url).split("?");
        const path = rawPath.replace(/^https?:\/\/[^/]+\//, "").replace(/^\//, "").replace(/^api\//, "");
        const method = options.method ?? "GET";
        const auth = options.headers?.Authorization;
        const body = readBody(options.body);
        requests.push({ method, path, auth: auth ?? null, body, idempotencyKey: options.headers?.["Idempotency-Key"] ?? null });

        const match = routes.find((r) => r.method === method && r.pattern.test(path));
        if (!match) return json(404, { detail: "Not found." });

        let user = null;
        if (match.auth) {
            const token = auth?.replace(/^Bearer /, "");
            if (!token) return json(401, { detail: "Authentication credentials were not provided." });
            user = userById(tokens.get(token));
            if (!user) return json(401, { detail: "Given token not valid for any token type", code: "token_not_valid" });
        }

        // [SEC] Idempotency-Key: a repeated key from the same user gets the first response again
        const key = options.headers?.["Idempotency-Key"];
        const cacheKey = key && user ? `${user.id}:${method}:${key}` : null;
        if (cacheKey && idempotent.has(cacheKey)) return idempotent.get(cacheKey);

        const res = match.handler(user, body, new URLSearchParams(rawQuery), path.match(match.pattern).slice(1));
        if (cacheKey && res.ok) idempotent.set(cacheKey, res);
        return res;
    }

    // ---------- WebSocket ----------
    class FakeSocket {
        // readyState values, as on the real WebSocket (hooks/useWebsocket.js checks WebSocket.OPEN)
        static CONNECTING = 0;
        static OPEN = 1;
        static CLOSING = 2;
        static CLOSED = 3;

        constructor(url, protocols) {
            this.url = url;
            this.path = url.replace(/^wss?:\/\/[^/]+\//, "");
            this.protocols = protocols;
            this.readyState = 0;
            this.sent = [];
            const [, token] = protocols ?? [];
            this.user = userById(tokens.get(token));
            sockets.set(this.path, this);
            if (!groups.has(this.path)) groups.set(this.path, new Set());
            groups.get(this.path).add(this);
            setTimeout(() => this.open(), 0);
        }

        open() {
            // websocket/auth.py: the token comes in the subprotocol list; a bad one is refused
            // ws/driver/<user id>, ws/passenger/<user id>, ws/notifications/<user id>: only your own;
            // ws/booking/<booking id>: only the ride's passenger and driver
            const bookingMatch = this.path.match(/^ws\/booking\/(\d+)$/);
            const ride = bookingMatch && bookings.find((b) => b.id === Number(bookingMatch[1]));
            const allowed = bookingMatch
                ? !!ride && [ride.passengerId, ride.driverId].includes(this.user?.id)
                : this.path.endsWith(`/${this.user?.id}`);
            if (!this.user || !allowed) {
                this.readyState = 3;
                this.onclose?.({ code: 4001, reason: "unauthorized" });
                return;
            }
            this.readyState = 1;
            this.onopen?.();
        }

        receive(message) {
            this.onmessage?.({ data: JSON.stringify(message) });
        }

        // driver actions (websocket/features/driver.py receive)
        send(text) {
            const message = JSON.parse(text);
            this.sent.push(message);
            // websocket/features/booking.py: the driver's position goes to everyone on the ride
            if (this.path.startsWith("ws/booking/")) {
                const coords = message.location?.coords;
                if (message.action === "driver_location" && coords?.latitude != null) {
                    lastDriverLocation.set(this.path, { latitude: coords.latitude, longitude: coords.longitude });
                    push(this.path, { type: "driver_location", data: { coords: { latitude: coords.latitude, longitude: coords.longitude } } });
                }
                return;
            }
            if (!this.path.startsWith("ws/driver/")) return;
            const b = bookings.find((x) => x.id === message.booking_id);
            if (message.action === "accept_booking") {
                if (!b || b.status !== "pending" || b.offeredTo !== this.user.id) {
                    this.receive({ type: "accept_booking", data: { success: false, message: "This booking is no longer available." } });
                    return;
                }
                b.status = "accepted";
                b.driverId = this.user.id;
                b.offeredTo = null;
                touch(b);
                this.receive({ type: "accept_booking", data: serializeBooking(b) });
                push(`ws/passenger/${b.passengerId}`, { type: "booking_accepted", data: serializeBooking(b) });
            } else if (message.action === "decline_booking") {
                const ok = !!b && b.offeredTo === this.user.id;
                if (ok) {
                    b.offeredTo = null;
                    b.declinedBy.push(this.user.id);
                    queue.set(this.user.id, { lat: message.location.latitude, lng: message.location.longitude });
                    setTimeout(() => assign(b), 0);
                }
                this.receive({ type: "decline_booking", success: ok });
            }
        }

        close() {
            this.readyState = 3;
            groups.get(this.path)?.delete(this);
            if (sockets.get(this.path) === this) sockets.delete(this.path);
        }
    }

    const backend = {
        users,
        bookings,
        ratings,
        queue,
        sockets,
        requests,
        fetch: jest.fn(fetchImpl),
        WebSocket: FakeSocket,
        user: (username) => users.find((u) => u.username === username),
        approveDriver(username) {
            backend.user(username).status = "ACTIVE";
        },
        offlineNext(count = 1) {
            offline = count;
        },
        // the server's 30 s offer timeout (websocket/features/driver.py booking_timeout)
        expireOffer(bookingId) {
            const b = bookings.find((x) => x.id === bookingId);
            const driverId = b.offeredTo;
            b.offeredTo = null;
            push(`ws/driver/${driverId}`, { type: "offer_expired", data: { booking_id: bookingId } });
        },
        // the driver's phone reports a new position (background/driverLocationTask.js → ws/booking/<id>);
        // the server passes it to everyone on the ride (websocket/features/booking.py)
        driverMoved(bookingId, { latitude, longitude }) {
            const path = `ws/booking/${bookingId}`;
            lastDriverLocation.set(path, { latitude, longitude });
            push(path, { type: "driver_location", data: { coords: { latitude, longitude } } });
        },
        // set up someone on the other side of the ride, straight in the "database"
        seedUser({ username, role, verified = true, status = "ACTIVE", ...rest }) {
            const user = { id: nextId++, username, password: "password123", role, verified, status, profile: { contact_number: "09170000000" }, otpAttempts: 0, ...rest };
            users.push(user);
            return { user, tokens: issueTokens(user) };
        },
        tokensFor(user) {
            return issueTokens(user);
        },
        install() {
            global.fetch = backend.fetch;
            global.WebSocket = FakeSocket;
        },
    };
    backend.install();
    return backend;
}

module.exports = { createFakeBackend, PICKUP_RADIUS_M };
