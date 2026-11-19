import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import colors from '../constants/colors' 
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuItem,
} from "@/components/ui/sidebar"

export default function SideBarComponent({
    menuItems = [],
    footer,
    activePage,
    onNavigate,
}) {
    const [hovered, setHovered] = useState(null)

    return (
        <Sidebar
            className="top-16 h-[calc(100vh-4rem)] w-64 border-r"
            style={{ borderColor: colors.border }}
        >

            <SidebarContent
                className="px-3 pt-4"
            >
                <SidebarGroup className="p-0">
                    <SidebarGroupContent>
                        <SidebarMenu className="gap-1">
                            {menuItems.map((item) => {
                                const isActive = activePage === item.href
                                const isHovered = hovered === item.href

                                return (
                                    <SidebarMenuItem key={item.label}>
                                        <Link
                                            to={item.href}
                                            onClick={() => onNavigate?.(item.href)}
                                            onMouseEnter={() => setHovered(item.href)}
                                            onMouseLeave={() => setHovered(null)}
                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                                            style={{
                                                backgroundColor: isActive
                                                    ? colors.secondary
                                                    : isHovered
                                                        ? `${colors.secondary}1A` // 10% tint
                                                        : 'transparent',
                                                color: isActive
                                                    ? colors.onPrimary
                                                    : colors.secondary,
                                            }}
                                        >
                                            {item.icon && <item.icon className="h-4 w-4 shrink-0" />}
                                            <span>{item.label}</span>
                                        </Link>
                                    </SidebarMenuItem>
                                )
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter
                className="border-t px-4 py-4"
                style={{
                    borderColor: colors.border,
                }}
            >
                {footer ?? (
                    <div className="text-center">
                        <p className="text-sm font-bold" style={{ color: colors.secondary }}>Admin</p>
                        <p className="text-xs" style={{ color: colors.secondary }}>TODA</p>
                    </div>
                )}
            </SidebarFooter>

        </Sidebar>
    )
}