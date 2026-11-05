import { router } from "expo-router";
import { goTo, isInStack } from "../../utils/navigation";

// root → (protected) → driver → [home, en_route]
const state = {
    routes: [
        {
            name: "(protected)",
            state: {
                routes: [
                    { name: "driver", state: { routes: [{ name: "home" }, { name: "en_route" }] } },
                    { name: "history" },
                ],
            },
        },
    ],
};

beforeEach(() => jest.clearAllMocks());

describe("isInStack", () => {
    it.each([
        ["/(protected)", true],
        ["/(protected)/driver", true],
        ["/(protected)/driver/en_route", true],
        ["/(protected)/history", true],
        ["/(protected)/passenger", false],
        ["/(protected)/driver/rate", false],
        ["/(global)/login", false],
    ])("%p → %p", (path, expected) => {
        expect(isInStack(state, path)).toBe(expected);
    });

    it("is false without a navigation state", () => {
        expect(isInStack(undefined, "/(protected)")).toBe(false);
    });
});

describe("goTo", () => {
    it("dismisses back to the existing layout instead of stacking a second one", () => {
        goTo("/(protected)/driver/en_route", state);
        expect(router.dismissTo).toHaveBeenCalledWith("/(protected)/driver/en_route");
        expect(router.push).not.toHaveBeenCalled();
    });

    it("pushes when the layout isn't open", () => {
        goTo("/(protected)/passenger/en_route", state);
        expect(router.push).toHaveBeenCalledWith("/(protected)/passenger/en_route");
        expect(router.dismissTo).not.toHaveBeenCalled();
    });

    it("pushes into an empty navigation state", () => {
        goTo("/(protected)/profile", { routes: [] });
        expect(router.push).toHaveBeenCalledWith("/(protected)/profile");
    });
});
