import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

// Default per platform. Android needs one too: the app draws edge-to-edge, so the window
// no longer shrinks for the keyboard and an input near the bottom would end up under it.
const DEFAULT_BEHAVIOR = Platform.OS === "ios" ? "padding" : "height";

/**
 * Keeps inputs above the keyboard. Use it around any screen or modal with text inputs.
 *
 *   <KeyboardAvoider>...</KeyboardAvoider>                       full screen (flex: 1)
 *   <KeyboardAvoider scroll contentContainerStyle={...}>         also scrolls, so long forms reach every field
 *   <KeyboardAvoider sheet>...</KeyboardAvoider>                 bottom sheet: lifts the sheet, keeps its own height
 *
 * Props:
 *   scroll                 wrap children in a ScrollView (taps on buttons still work while the keyboard is up)
 *   contentContainerStyle  the ScrollView's content style (with `scroll`)
 *   sheet                  for a bottom sheet in a Modal: "padding" on both platforms, no flex
 *   offset                 keyboardVerticalOffset, e.g. the height of a header drawn above this view
 *   style, className       for the outer view
 */
export default function KeyboardAvoider({
    children,
    scroll = false,
    contentContainerStyle,
    sheet = false,
    offset = 0,
    style,
    className,
    scrollProps,
}) {
    return (
        <KeyboardAvoidingView
            behavior={sheet ? "padding" : DEFAULT_BEHAVIOR}
            keyboardVerticalOffset={offset}
            style={[sheet ? null : { flex: 1 }, style]}
            className={className}
        >
            {scroll ? (
                <ScrollView
                    contentContainerStyle={contentContainerStyle}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    {...scrollProps}
                >
                    {children}
                </ScrollView>
            ) : (
                children
            )}
        </KeyboardAvoidingView>
    );
}
