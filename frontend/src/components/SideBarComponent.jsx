import React from 'react'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"

export default function SideBarComponent({ header, menuItems = [], footer }) {

    const menuButtonStyle = "flex items-center gap-2 text-sm";

    return (
        <Sidebar  className="top-16 h-[calc(100vh-4rem)] w-64 border-r">

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {menuItems.map((item) => (
                                <SidebarMenuItem key={item.label}>
                                    <SidebarMenuButton isActive={item.active} className={menuButtonStyle}>
                                        <a href={item.href} className={menuButtonStyle}>
                                            {item.icon && <item.icon className="w-4 h-4" />}
                                            {item.label}
                                        </a>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="px-4 py-3 border-t">
                {footer ?? (
                    <div className="text-xs text-muted-foreground">
                        © {new Date().getFullYear()} TODA System
                    </div>
                )}
            </SidebarFooter>

        </Sidebar>
    )
}