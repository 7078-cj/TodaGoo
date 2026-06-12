import type { ImagePickerAsset } from 'expo-image-picker';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// ─── Navigation ────────────────────────────────────────────────────────────────

export type RootStackParamList = {
    DriverRegistration: undefined;
    Login: undefined;
};

export type DriverRegistrationNavigationProp = NativeStackNavigationProp<
    RootStackParamList,
    'DriverRegistration'
>;

// ─── Form Field Values ─────────────────────────────────────────────────────────

export interface AccountFields {
    first_name: string;
    last_name: string;
    username: string;
    email: string;
    password: string;
    confirm_password: string;
}

export interface ProfileFields {
    address: string;
    toda_number: string;
    franchise_permit_number: string;
    license_number: string;
    vehicle_plate: string;
    profile_picture: ImagePickerAsset | null;
    vehicle_front_picture: ImagePickerAsset | null;
    vehicle_back_picture: ImagePickerAsset | null;
}

// ─── Form Errors ───────────────────────────────────────────────────────────────

export type AccountErrors = Partial<Record<keyof AccountFields, string>>;
export type ProfileErrors = Partial<Record<keyof ProfileFields, string>>;

// ─── Hook Return Types ─────────────────────────────────────────────────────────

export interface AccountFormReturn {
    fields: AccountFields;
    errors: AccountErrors;
    setField: (key: keyof AccountFields, value: string) => void;
    validate: () => boolean;
}

export interface ProfileFormReturn {
    fields: ProfileFields;
    errors: ProfileErrors;
    setField: (key: keyof ProfileFields, value: string | ImagePickerAsset | null) => void;
    validate: () => boolean;
}

// ─── Component Props ───────────────────────────────────────────────────────────

export interface FormFieldProps {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    error?: string;
    secureTextEntry?: boolean;
    placeholder?: string;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad';
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export interface ImagePickerFieldProps {
    label: string;
    value: ImagePickerAsset | null;
    onPick: (asset: ImagePickerAsset) => void;
    error?: string;
}

export interface StepIndicatorProps {
    currentStep: number;
}

export interface AccountStepProps {
    fields: AccountFields;
    errors: AccountErrors;
    setField: AccountFormReturn['setField'];
    onNext: () => void;
}

export interface ProfileStepProps {
    fields: ProfileFields;
    errors: ProfileErrors;
    setField: ProfileFormReturn['setField'];
    onBack: () => void;
    onSubmit: () => void;
    loading: boolean;
}