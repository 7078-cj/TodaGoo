import React, { useState } from 'react'
import { UploadCloud, CheckCircle } from 'lucide-react'
import { createRegisteredTODA } from '../api/registered_toda'

export default function UploadExcel({ onSuccess }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setSuccess(false);
    };

    const handleUpload = async () => {
        if (!file) return alert("Please select an Excel file.");

        try {
            setLoading(true);

            const formData = new FormData();
            formData.append("file", file);

            await createRegisteredTODA(formData,true);

            setSuccess(true);
            setFile(null);

            if (onSuccess) onSuccess();

        } catch (err) {
            console.error(err);
            alert("Upload failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="border rounded-lg p-4 flex flex-col gap-3 bg-background">

            <div className="flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Upload Excel File</span>
            </div>

            <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={loading}
                className="text-sm"
            />

            {file && (
                <div className="text-xs text-muted-foreground">
                    Selected: <span className="font-medium">{file.name}</span>
                </div>
            )}

            <button
                onClick={handleUpload}
                disabled={loading}
                className="flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
                {loading ? (
                    <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Uploading...
                    </>
                ) : (
                    <>
                        <UploadCloud className="w-4 h-4" />
                        Upload
                    </>
                )}
            </button>

            {success && (
                <div className="flex items-center gap-2 text-green-600 text-xs">
                    <CheckCircle className="w-4 h-4" />
                    Upload successful
                </div>
            )}
        </div>
    );
}