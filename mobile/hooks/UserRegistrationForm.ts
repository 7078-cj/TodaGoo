import { useState } from 'react';
import type { ImagePickerAsset } from 'expo-image-picker';
import type {
    AccountFields,
    AccountErrors,
    AccountFormReturn,
    ProfileFields,
    ProfileErrors,
    ProfileFormReturn,
} from '../types';

// ─── Account Form ──────────────────────────────────────────────────────────────

export function useAccountForm(): AccountFormReturn {
    const [fields, setFields] = useState<AccountFields>({
        first_name: '',
        last_name: '',
        username: '',
        email: '',
        password: '',
        confirm_password: '',
    });
    const [errors, setErrors] = useState<AccountErrors>({});

    const setField = (key: keyof AccountFields, value: string): void => {
        setFields((prev) => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

    const validate = (): boolean => {
        const e: AccountErrors = {};

        if (!fields.first_name.trim()) e.first_name = 'Required';
        if (!fields.last_name.trim()) e.last_name = 'Required';

        if (!fields.username.trim()) e.username = 'Required';
        else if (fields.username.length < 3) e.username = 'Min. 3 characters';

        if (!fields.email.trim()) e.email = 'Required';
        else if (!/\S+@\S+\.\S+/.test(fields.email)) e.email = 'Invalid email';

        if (!fields.password) e.password = 'Required';
        else if (fields.password.length < 8) e.password = 'Min. 8 characters';

        if (!fields.confirm_password) e.confirm_password = 'Required';
        else if (fields.password !== fields.confirm_password) e.confirm_password = 'Passwords do not match';

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    return { fields, errors, setField, validate };
}

// ─── Profile Form ──────────────────────────────────────────────────────────────

export function useProfileForm(): ProfileFormReturn {
    const [fields, setFields] = useState<ProfileFields>({
        address: '',
        toda_number: '',
        franchise_permit_number: '',
        license_number: '',
        vehicle_plate: '',
        profile_picture: null,
        vehicle_front_picture: null,
        vehicle_back_picture: null,
    });
    const [errors, setErrors] = useState<ProfileErrors>({});

    const setField = (
        key: keyof ProfileFields,
        value: string | ImagePickerAsset | null,
    ): void => {
        setFields((prev) => ({ ...prev, [key]: value }));
        if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

    const validate = (): boolean => {
        const e: ProfileErrors = {};

        if (!fields.address.trim()) e.address = 'Required';
        if (!fields.toda_number.trim()) e.toda_number = 'Required';
        if (!fields.franchise_permit_number.trim()) e.franchise_permit_number = 'Required';
        if (!fields.license_number.trim()) e.license_number = 'Required';
        if (!fields.vehicle_plate.trim()) e.vehicle_plate = 'Required';
        if (!fields.profile_picture) e.profile_picture = 'Required';
        if (!fields.vehicle_front_picture) e.vehicle_front_picture = 'Required';
        if (!fields.vehicle_back_picture) e.vehicle_back_picture = 'Required';

        setErrors(e);
        return Object.keys(e).length === 0;
    };

    return { fields, errors, setField, validate };
}