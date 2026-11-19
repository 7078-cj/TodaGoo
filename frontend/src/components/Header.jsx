
import React from 'react'
import colors from '../constants/colors'
import TodaGooLogo from '../assets/TodaGoo_Logo.svg'

export default function Header() {
    return (
        <header
            className="w-full h-16 flex items-center justify-between px-8 border-b"
            style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
            }}
        >
            {/* Left: TodaGoo Logo */}
            <div className="flex items-center justify-center gap-2">
                <img
                    src={TodaGooLogo}
                    alt="TodaGoo Logo"
                    className="h-[50px] w-auto object-contain"
                />

                <span
                    className="text-[2rem] font-bold tracking-tight"
                    style={{ color: colors.secondary }}
                >
                    Toda<span style={{ color: colors.primary }}>Goo</span>
                </span>
            </div>

            {/* Right: Municipality */}
            <h1
                className="text-sm md:text-base font-semibold"
                style={{ color: colors.text }}
            >
                Municipal Office of Apalit
            </h1>
        </header>
    )
}
