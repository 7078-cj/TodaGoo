import React, { useRef, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { createRegisteredTODA } from '../api/registered_toda'
import colors from '../constants/colors'

export default function UploadExcel({ onSuccess }) {
    const inputRef = useRef(null)
    const [loading, setLoading] = useState(false)

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return

        try {
            setLoading(true)

            const formData = new FormData()
            formData.append('file', file)

            await createRegisteredTODA(formData, true)

            if (onSuccess) onSuccess()
        } catch (err) {
            console.error(err)
            alert('Upload failed.')
        } finally {
            setLoading(false)
            e.target.value = '' // allow re-selecting the same file
        }
    }

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={loading}
                className="hidden"
            />

            <button
                onClick={() => inputRef.current?.click()}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border hover:opacity-80 disabled:opacity-50 transition"
                style={{
                    backgroundColor: colors.surface,
                    borderColor: colors.dark,
                    color: colors.dark,
                }}
            >
                {loading ? (
                    <>
                        <span
                            className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                            style={{ borderColor: colors.dark, borderTopColor: 'transparent' }}
                        />
                        Uploading...
                    </>
                ) : (
                    <>
                        <UploadCloud className="w-4 h-4" />
                        Upload Excel File
                    </>
                )}
            </button>
        </>
    )
}