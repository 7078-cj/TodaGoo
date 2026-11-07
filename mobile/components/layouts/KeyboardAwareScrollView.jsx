import React, { createContext, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Keyboard, Platform, ScrollView } from "react-native";
import { measureInWindow } from "../../utils/measure";

// FormTextField (and any input) tells the scroll view around it when it gets focus
export const KeyboardScrollContext = createContext(null);

const SHOW = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
const HIDE = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
// iOS reports the keyboard before it slides in; wait for the layout to settle before measuring
const SETTLE_MS = Platform.OS === "ios" ? 250 : 60;

// true while the software keyboard is open (e.g. to shrink a header and make room)
export function useKeyboardVisible() {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const show = Keyboard.addListener(SHOW, () => setVisible(true));
        const hide = Keyboard.addListener(HIDE, () => setVisible(false));
        return () => {
            show.remove();
            hide.remove();
        };
    }, []);
    return visible;
}

/**
 * A ScrollView that keeps the focused input above the keyboard: when an input inside it gets
 * focus (or the keyboard opens while one has it), it scrolls just enough that the input, plus
 * `extraSpace` below it, clears the keyboard. Inputs report focus through KeyboardScrollContext
 * (FormTextField does this). Use it inside a KeyboardAvoidingView / KeyboardAvoider, so the scroll
 * area ends where the keyboard begins and there's room to scroll.
 *
 * Props: ScrollView's, plus `extraSpace` (px kept free under the input; default 80, enough to show
 * the next field's label or a button).
 */
const KeyboardAwareScrollView = forwardRef(function KeyboardAwareScrollView(
    { children, extraSpace = 80, onScroll, ...props },
    ref
) {
    const scrollRef = useRef(null);
    const scrollY = useRef(0);
    const focusedNode = useRef(null);
    const keyboardTop = useRef(null);
    const timer = useRef(null);

    useImperativeHandle(ref, () => scrollRef.current);

    const revealFocused = useCallback(async () => {
        const node = focusedNode.current;
        const top = keyboardTop.current;
        if (!node || top == null || !scrollRef.current) return;
        const rect = await measureInWindow(node);
        if (!rect) return;
        const hiddenBy = rect.y + rect.height + extraSpace - top;
        if (hiddenBy > 0) scrollRef.current.scrollTo({ y: scrollY.current + hiddenBy, animated: true });
    }, [extraSpace]);

    const revealSoon = useCallback(() => {
        clearTimeout(timer.current);
        timer.current = setTimeout(revealFocused, SETTLE_MS);
    }, [revealFocused]);

    useEffect(() => {
        const show = Keyboard.addListener(SHOW, (e) => {
            keyboardTop.current = e?.endCoordinates?.screenY ?? null;
            revealSoon();
        });
        const hide = Keyboard.addListener(HIDE, () => {
            keyboardTop.current = null;
        });
        return () => {
            clearTimeout(timer.current);
            show.remove();
            hide.remove();
        };
    }, [revealSoon]);

    const context = useMemo(
        () => ({
            // node: the view to keep visible (the whole field: label, input, error)
            inputFocused: (node) => {
                focusedNode.current = node;
                revealSoon(); // the keyboard may already be open (moving from one field to the next)
            },
        }),
        [revealSoon]
    );

    return (
        <KeyboardScrollContext.Provider value={context}>
            <ScrollView
                ref={scrollRef}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
                scrollEventThrottle={16}
                onScroll={(e) => {
                    scrollY.current = e.nativeEvent.contentOffset.y;
                    onScroll?.(e);
                }}
                {...props}
            >
                {children}
            </ScrollView>
        </KeyboardScrollContext.Provider>
    );
});

export default KeyboardAwareScrollView;
