import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useProfile } from "../../contexts/ProfileContext";
import colors from "../../constants/colors";
import { mediaUrl } from "../../utils/person";
import { pickPhotoFromLibrary } from "../../utils/imagePicker";
import { updatePassengerProfile } from "../../api/passenger";
import { updateDriverProfile } from "../../api/driver";
import PageHeader from "../../components/layouts/PageHeader";
import { LoadingScreen } from "../../components/loading";
import { LOADING_MESSAGES } from "../../constants/loading";
import FormTextField from "../../components/inputs/FormTextField";
import Avatar from "../../components/Avatar";
import { HERO_GREEN } from "../../components/profile/ProfileHero";

// Form layout per role. `profile: true` = field lives in <role>_profile, otherwise on the user.
// TODA number / plate aren't editable here: changing them re-checks the TODA registration.
const SECTIONS = {
    passenger: [
        {
            title: "Basic Information",
            fields: [
                { name: "username", label: "Username", autoCapitalize: "none" },
                { name: "first_name", label: "First Name" },
                { name: "last_name", label: "Last Name" },
                { name: "contact_number", label: "Phone Number", profile: true, keyboardType: "phone-pad", maxLength: 11 },
                { name: "address", label: "Address", profile: true, multiline: true },
            ],
        },
        {
            title: "Emergency Contact",
            fields: [
                { name: "emergency_contact_name", label: "Contact Name", profile: true },
                { name: "emergency_contact_number", label: "Contact Number", profile: true, keyboardType: "phone-pad", maxLength: 11 },
            ],
        },
    ],
    driver: [
        {
            title: "Basic Information",
            fields: [
                { name: "username", label: "Username", autoCapitalize: "none" },
                { name: "first_name", label: "First Name" },
                { name: "last_name", label: "Last Name" },
                { name: "contact_number", label: "Phone Number", profile: true, keyboardType: "phone-pad", maxLength: 11 },
                { name: "address", label: "Address", profile: true, multiline: true },
            ],
        },
    ],
};

// Photos per role (all live in <role>_profile)
const PHOTOS = {
    passenger: [],
    driver: [
        { name: "vehicle_front_picture", label: "Vehicle Front" },
        { name: "vehicle_back_picture", label: "Vehicle Back" },
    ],
};

const UPDATE = { passenger: updatePassengerProfile, driver: updateDriverProfile };

// error keys the form can show next to a field (anything else is shown in an alert)
const FORM_ERROR_KEYS = new Set([
    ...Object.values(SECTIONS).flatMap((sections) => sections.flatMap((s) => s.fields.map((f) => f.name))),
    "profile_picture",
    ...Object.values(PHOTOS).flatMap((photos) => photos.map((p) => p.name)),
    "non_field_errors",
    "detail",
]);

const firstError = (value) => (Array.isArray(value) ? value[0] : value);

// Backend errors look like { username: [...], passenger_profile: { contact_number: [...] } }
function flattenErrors(data, profileKey) {
    const errors = {};
    Object.entries(data ?? {}).forEach(([key, value]) => {
        if (key === profileKey && value && typeof value === "object" && !Array.isArray(value)) {
            Object.entries(value).forEach(([k, v]) => (errors[k] = firstError(v)));
        } else {
            errors[key] = firstError(value);
        }
    });
    return errors;
}

function PhotoPicker({ label, value, onPick, square = false }) {
    const uri = typeof value === "string" ? mediaUrl(value) : value?.uri;
    return (
        <TouchableOpacity onPress={onPick} activeOpacity={0.8} style={{ alignItems: "center", flex: square ? 1 : undefined }}>
            {square ? (
                uri ? (
                    <Image source={{ uri }} style={{ width: "100%", height: 100, borderRadius: 10 }} />
                ) : (
                    <View style={{ width: "100%", height: 100, borderRadius: 10, backgroundColor: "#E5E7EB", alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="image-outline" size={26} color="#9CA3AF" />
                    </View>
                )
            ) : (
                <Avatar uri={uri} size={96} />
            )}
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
                <Ionicons name="camera-outline" size={14} color={colors.primary} />
                <Text style={{ marginLeft: 4, fontSize: 12, color: colors.primary, fontWeight: "600" }}>{label}</Text>
            </View>
        </TouchableOpacity>
    );
}

export default function EditProfile() {
    const { role, profile, details, setProfile } = useProfile();

    if (!profile) {
        return (
            <View className="flex-1" style={{ backgroundColor: colors.background }}>
                <PageHeader title="Edit Profile" />
                <LoadingScreen message={LOADING_MESSAGES.profile} />
            </View>
        );
    }

    // mounted only once the profile is loaded, so the form starts from real values
    return (
        <EditProfileForm
            role={role === "driver" ? "driver" : "passenger"}
            profile={profile}
            details={details}
            setProfile={setProfile}
        />
    );
}

function EditProfileForm({ role, profile, details, setProfile }) {
    const profileKey = `${role}_profile`;
    const sections = SECTIONS[role];
    const photos = PHOTOS[role];

    // starting values, used to send only what changed
    const initial = useMemo(() => {
        const values = {};
        sections.forEach((s) =>
            s.fields.forEach((f) => (values[f.name] = (f.profile ? details?.[f.name] : profile?.[f.name]) ?? ""))
        );
        ["profile_picture", ...photos.map((p) => p.name)].forEach((name) => (values[name] = details?.[name] ?? null));
        return values;
    }, [profile, details, sections, photos]);

    const [form, setForm] = useState(initial);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const set = (name) => (value) => setForm((prev) => ({ ...prev, [name]: value }));

    const pick = (name) => async () => {
        const asset = await pickPhotoFromLibrary();
        if (asset) set(name)(asset);
    };

    const handleSave = async () => {
        const body = {};
        const profileBody = {};

        sections.forEach((s) =>
            s.fields.forEach((f) => {
                const value = typeof form[f.name] === "string" ? form[f.name].trim() : form[f.name];
                if (value === initial[f.name]) return;
                if (f.profile) profileBody[f.name] = value;
                else body[f.name] = value;
            })
        );
        // a photo is only sent when a new one was picked (an asset object, not the saved URL)
        ["profile_picture", ...photos.map((p) => p.name)].forEach((name) => {
            if (form[name] && typeof form[name] === "object") profileBody[name] = form[name];
        });

        if (Object.keys(profileBody).length) body[profileKey] = profileBody;
        if (!Object.keys(body).length) {
            router.back();
            return;
        }

        setSaving(true);
        setErrors({});
        try {
            const res = await UPDATE[role](profile.id, body);
            if (!res.success) {
                console.log("Profile update failed:", res.status, JSON.stringify(res.data ?? res.error));
                const fieldErrors = flattenErrors(res.data, profileKey);
                const shownOnForm = Object.keys(fieldErrors).some((key) => FORM_ERROR_KEYS.has(key));
                setErrors(fieldErrors);
                // network error, 401/413/500, or an error for a field the form doesn't show:
                // never fail silently
                if (!shownOnForm) {
                    Alert.alert(
                        "Couldn't save changes",
                        res.status ? `${res.error} (HTTP ${res.status})` : res.error || "Please check your connection and try again."
                    );
                }
                return;
            }
            setProfile(res.data);
            router.back();
        } catch (err) {
            console.log("Profile update crashed:", err);
            Alert.alert("Couldn't save changes", err?.message ?? "Something went wrong.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
            <PageHeader title="Edit Profile" />

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                    <View style={{ alignItems: "center", marginBottom: 12 }}>
                        <PhotoPicker label="Change Photo" value={form.profile_picture} onPick={pick("profile_picture")} />
                        {errors.profile_picture ? <Text style={{ color: colors.error, fontSize: 12 }}>{errors.profile_picture}</Text> : null}
                    </View>

                    {sections.map((section) => (
                        <View key={section.title} style={{ marginBottom: 8 }}>
                            <Text style={{ fontSize: 17, fontWeight: "600", color: colors.dark, marginBottom: 8 }}>{section.title}</Text>
                            {section.fields.map((f) => (
                                <FormTextField
                                    key={f.name}
                                    label={f.label}
                                    value={form[f.name]}
                                    onChangeText={set(f.name)}
                                    error={errors[f.name]}
                                    keyboardType={f.keyboardType ?? "default"}
                                    maxLength={f.maxLength}
                                    autoCapitalize={f.autoCapitalize ?? "sentences"}
                                    multiline={!!f.multiline}
                                />
                            ))}
                        </View>
                    ))}

                    {photos.length > 0 && (
                        <View style={{ marginBottom: 8 }}>
                            <Text style={{ fontSize: 17, fontWeight: "600", color: colors.dark, marginBottom: 8 }}>Vehicle Photos</Text>
                            <View style={{ flexDirection: "row", gap: 12 }}>
                                {photos.map((p) => (
                                    <PhotoPicker key={p.name} square label={p.label} value={form[p.name]} onPick={pick(p.name)} />
                                ))}
                            </View>
                            {photos.map((p) =>
                                errors[p.name] ? <Text key={p.name} style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{errors[p.name]}</Text> : null
                            )}
                        </View>
                    )}

                    {errors.non_field_errors || errors.detail ? (
                        <Text style={{ color: colors.error, fontSize: 12, marginBottom: 8 }}>{errors.non_field_errors ?? errors.detail}</Text>
                    ) : null}

                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        style={{ backgroundColor: HERO_GREEN, borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: 12, opacity: saving ? 0.7 : 1 }}
                    >
                        {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={{ color: colors.onPrimary, fontWeight: "600" }}>Save Changes</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => router.back()}
                        disabled={saving}
                        style={{ borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: 12, borderWidth: 1, borderColor: "#9CA3AF", backgroundColor: colors.surface }}
                    >
                        <Text style={{ color: "#6B7280" }}>Cancel</Text>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}
