const ORIGINAL_URL = process.env.EXPO_PUBLIC_API_URL;

// person.js reads EXPO_PUBLIC_API_URL when it's imported
function loadPerson(apiUrl) {
    process.env.EXPO_PUBLIC_API_URL = apiUrl;
    let mod;
    jest.isolateModules(() => {
        mod = require("../../utils/person");
    });
    return mod;
}

afterAll(() => {
    process.env.EXPO_PUBLIC_API_URL = ORIGINAL_URL;
});

describe("mediaUrl", () => {
    it("prefixes relative media paths with the server origin (without /api)", () => {
        const { mediaUrl } = loadPerson("http://10.0.0.5:8000/api/");
        expect(mediaUrl("/media/a.png")).toBe("http://10.0.0.5:8000/media/a.png");
        expect(mediaUrl("media/a.png")).toBe("http://10.0.0.5:8000/media/a.png");
    });

    it("keeps absolute URLs and returns null for empty paths", () => {
        const { mediaUrl } = loadPerson("http://10.0.0.5:8000");
        expect(mediaUrl("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
        expect(mediaUrl("")).toBeNull();
        expect(mediaUrl(null)).toBeNull();
    });
});

describe("getPerson", () => {
    const { getPerson } = loadPerson("http://host:8000");
    const booking = {
        passenger: { first_name: "maria", last_name: "santos", contact_number: "0912", rating: "4.5" },
        driver: {
            first_name: "",
            last_name: "",
            username: "driver01",
            profile_picture: "/media/d.png",
            toda_number: "T-12",
            vehicle_plate: "ABC 123",
            vehicle_front_picture: "/media/f.png",
            vehicle_back_picture: null,
        },
    };

    it("a driver sees the passenger, with capitalised names", () => {
        expect(getPerson(booking, true)).toEqual({
            role: "passenger",
            name: "Maria Santos",
            phone: "0912",
            photo: null,
            rating: 4.5,
            address: null,
            todaNumber: null,
            plate: null,
            vehicleFront: null,
            vehicleBack: null,
        });
    });

    it("a passenger sees the driver; the username stands in for a missing name", () => {
        const person = getPerson(booking, false);
        expect(person.role).toBe("driver");
        expect(person.name).toBe("driver01");
        expect(person.photo).toBe("http://host:8000/media/d.png");
        expect(person.todaNumber).toBe("T-12");
        expect(person.plate).toBe("ABC 123");
        expect(person.vehicleFront).toBe("http://host:8000/media/f.png");
        expect(person.rating).toBeNull();
    });

    it("returns null when the other party isn't an object (e.g. just an id)", () => {
        expect(getPerson({ driver: 5 }, false)).toBeNull();
        expect(getPerson(null, true)).toBeNull();
    });
});
