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
    return (
        <Sidebar  className="w-64">

            <SidebarHeader className="px-4 py-3 border-b">
                {header ?? (
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                            T
                        </div>
                        <span className="font-semibold text-sm">TODA Admin</span>
                    </div>
                )}
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {menuItems.map((item) => (
                                <SidebarMenuItem key={item.label}>
                                    <SidebarMenuButton isActive={item.active}>
                                        <a href={item.href} className="flex items-center gap-2 text-sm">
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