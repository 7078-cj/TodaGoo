import React, { useContext, useState } from "react";
import { View, ScrollView, RefreshControl, Alert } from "react-native";
import { router } from "expo-router";
import AuthContext from "../../contexts/AuthContext";
import { useProfile } from "../../contexts/ProfileContext";
import colors from "../../constants/colors";
import { mediaUrl } from "../../utils/person";
import PageHeader from "../../components/layouts/PageHeader";
import ProfileHero from "../../components/profile/ProfileHero";
import DetailsTab from "../../components/profile/DetailsTab";
import EarningsTab from "../../components/profile/EarningsTab";
import ReportsTab from "../../components/profile/ReportsTab";
import HotlinesTab from "../../components/profile/HotlinesTab";
import ChangePasswordModal from "../../components/profile/ChangePasswordModal";
import { useReportRequest } from "../../utils/reportRequestStore";

// Tabs per role, in order. Add / reorder here.
const PROFILE_TABS = {
    passenger: [
        { key: "details", label: "Details" },
        { key: "reports", label: "Reports" },
        { key: "hotlines", label: "Hotlines" },
    ],
    driver: [
        { key: "details", label: "Details" },
        { key: "earnings", label: "Earnings" },
        { key: "reports", label: "Reports" },
        { key: "hotlines", label: "Hotlines" },
    ],
};

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

export default function Profile() {
    const { logoutUser } = useContext(AuthContext);
    const { role, profile, details, loading, refresh } = useProfile();
    const tabs = PROFILE_TABS[role] ?? PROFILE_TABS.passenger;

    const [activeTab, setActiveTab] = useState("details");
    const [passwordVisible, setPasswordVisible] = useState(false);

    // a tapped report notification: switch to Reports once per request (ReportsTab opens the report)
    const reportRequest = useReportRequest();
    const [handledRequest, setHandledRequest] = useState(null);
    if (reportRequest && reportRequest !== handledRequest) {
        setHandledRequest(reportRequest);
        setActiveTab("reports");
    }

    const name =
        [profile?.first_name, profile?.last_name].filter(Boolean).map(cap).join(" ") || profile?.username || "";

    const handleLogout = () => {
        Alert.alert("Log out", "Do you want to log out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Log Out",
                style: "destructive",
                onPress: async () => {
                    await logoutUser();
                    router.replace("/(global)/login");
                },
            },
        ]);
    };

    return (
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
            <PageHeader title="Profile" />

            <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
                <ProfileHero
                    name={name}
                    photo={mediaUrl(details?.profile_picture)}
                    rating={details?.rating}
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    onEdit={() => router.push("/(protected)/edit_profile")}
                />

                {activeTab === "details" && (
                    <DetailsTab
                        role={role}
                        profile={profile}
                        details={details}
                        onChangePassword={() => setPasswordVisible(true)}
                        onLogout={handleLogout}
                    />
                )}
                {activeTab === "earnings" && <EarningsTab />}
                {activeTab === "reports" && <ReportsTab />}
                {activeTab === "hotlines" && <HotlinesTab />}
            </ScrollView>

            {passwordVisible && <ChangePasswordModal onClose={() => setPasswordVisible(false)} />}
        </View>
    );
}
