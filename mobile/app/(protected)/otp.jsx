import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Text,
    TextInput,
    View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AuthHeader from "@/components/AuthHeader"; // adjust paths
import ButtonComponent from "@/components/ButtonComponent";
import colors from "@/constants/colors";
import {
    verifyDriverOtp,
    resendDriverOtp,
} from '../../api/driver'

import {
    verifyPassengerOtp,
    resendPassengerOtp,
} from '../../api/passenger'

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

// Everything that differs between roles lives here.
// Adjust the routes to match your app.
const ROLE_CONFIG = {
    driver: {
        verify: verifyDriverOtp,
        resend: resendDriverOtp,
        redirect: "/(driver)/home",
    },
    passenger: {
        verify: verifyPassengerOtp,
        resend: resendPassengerOtp,
        redirect: "/(passenger)/home",
    },
};

export default function otp() {
    const insets = useSafeAreaInsets();
    const inputRef = useRef(null);

    const [user, setUser] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [code, setCode] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [cooldown, setCooldown] = useState(RESEND_SECONDS);

    // AsyncStorage is async, so it has to be read inside an effect
    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem("user");
                if (mounted) setUser(raw ? JSON.parse(raw) : null);
            } catch {
                if (mounted) setUser(null);
            } finally {
                if (mounted) setLoadingUser(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // Resend countdown
    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const role = user?.role?.toLowerCase();
    const config = ROLE_CONFIG[role];

    const getMessage = (e, fallback) =>
        e?.response?.data?.message ||
        e?.response?.data?.detail ||
        e?.response?.data?.error ||
        fallback;

    const submit = useCallback(
        async (value) => {
            if (!config || verifying || value.length !== OTP_LENGTH) return;
            setError("");
            setInfo("");
            setVerifying(true);
            try {
                await config.verify({ otp: value });
                router.replace(config.redirect);
            } catch (e) {
                setError(getMessage(e, "That code is wrong or expired. Try again."));
                setCode("");
                inputRef.current?.focus();
            } finally {
                setVerifying(false);
            }
        },
        [config, verifying]
    );

    const onChange = (text) => {
        const digits = text.replace(/\D/g, "").slice(0, OTP_LENGTH);
        setCode(digits);
        setError("");
        if (digits.length === OTP_LENGTH) submit(digits);
    };

    const onResend = async () => {
        if (!config || cooldown > 0 || resending) return;
        setError("");
        setInfo("");
        setResending(true);
        try {
            await config.resend();
            setCode("");
            setCooldown(RESEND_SECONDS);
            setInfo("We sent you a new code.");
            inputRef.current?.focus();
        } catch (e) {
            setError(getMessage(e, "Could not resend the code. Try again in a moment."));
        } finally {
            setResending(false);
        }
    };

    if (loadingUser) {
        return (
            <View className="flex-1 items-center justify-center bg-background">
                <ActivityIndicator color={colors.primary} />
            </View>
        );
    }

    if (!config) {
        return (
            <View className="flex-1 bg-background">
                <AuthHeader tagline="Session not found" />
                <View className="flex-1 justify-center px-8">
                    <Text className="text-center text-base text-dark">
                        Sign in again to get a new code.
                    </Text>
                </View>
                <View className="px-8" style={{ paddingBottom: insets.bottom + 24 }}>
                    <ButtonComponent
                        label="Back to sign in"
                        onPress={() => router.replace("/")}
                    />
                </View>
            </View>
        );
    }

    const destination = user?.phone || user?.phone_number || user?.email;
    const resendDisabled = cooldown > 0 || resending;

    return (
        <KeyboardAvoidingView
            className="flex-1 bg-background"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <AuthHeader tagline="Verify your account" />

            <View className="flex-1 px-8 pt-8">
                <Text className="text-2xl font-bold text-dark">Enter your code</Text>
                <Text className="mt-2 text-[15px] leading-[22px] text-dark/70">
                    {destination
                        ? `We sent a ${OTP_LENGTH}-digit code to ${destination}.`
                        : `We sent you a ${OTP_LENGTH}-digit code.`}
                </Text>

                <Pressable
                    className="mt-8 flex-row justify-between"
                    onPress={() => inputRef.current?.focus()}
                >
                    {Array.from({ length: OTP_LENGTH }).map((_, i) => {
                        const active = i === code.length && !verifying;
                        const border = error
                            ? "border-2 border-error"
                            : active
                            ? "border-2 border-active"
                            : "border border-border";
                        return (
                            <View
                                key={i}
                                className={`h-[58px] w-12 items-center justify-center rounded-xl bg-surface ${border}`}
                            >
                                <Text className="text-2xl font-semibold text-dark">
                                    {code[i] ?? ""}
                                </Text>
                            </View>
                        );
                    })}
                    {/* Real input stays invisible; the boxes above just display it.
                        This keeps paste and the SMS autofill suggestion working. */}
                    <TextInput
                        ref={inputRef}
                        value={code}
                        onChangeText={onChange}
                        keyboardType="number-pad"
                        textContentType="oneTimeCode"
                        autoComplete="sms-otp"
                        maxLength={OTP_LENGTH}
                        autoFocus
                        editable={!verifying}
                        caretHidden
                        className="absolute h-full w-full opacity-0"
                    />
                </Pressable>

                {!!error && <Text className="mt-4 text-sm text-error">{error}</Text>}
                {!!info && !error && (
                    <Text className="mt-4 text-sm text-success">{info}</Text>
                )}

                <Pressable
                    className="mt-5 items-center self-center p-2"
                    disabled={resendDisabled}
                    onPress={onResend}
                >
                    <Text
                        className={`text-[15px] font-semibold ${
                            resendDisabled ? "text-dark/50" : "text-primary"
                        }`}
                    >
                        {resending
                            ? "Sending…"
                            : cooldown > 0
                            ? `Resend code in ${cooldown}s`
                            : "Resend code"}
                    </Text>
                </Pressable>
            </View>

            <View className="px-8" style={{ paddingBottom: insets.bottom + 24 }}>
                <ButtonComponent
                    label={verifying ? "Verifying…" : "Verify"}
                    disabled={code.length !== OTP_LENGTH || verifying}
                    onPress={() => submit(code)}
                />
            </View>
        </KeyboardAvoidingView>
    );
}