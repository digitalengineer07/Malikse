import React, { forwardRef, useState } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { AppTheme } from "../constants/theme";

export default forwardRef<TextInput, TextInputProps>(function FormInput({ style, onFocus, onBlur, ...props }, ref) {
  const [focused, setFocused] = useState(false);
  return <TextInput ref={ref} placeholderTextColor={AppTheme.colors.textMuted} selectionColor={AppTheme.colors.primary}
    {...props} onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={[{ minWidth: 0, minHeight: 52, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16,
      color: AppTheme.colors.text, backgroundColor: AppTheme.colors.card, borderColor: AppTheme.colors.border }, style,
      focused && { borderColor: AppTheme.colors.primary, borderWidth: 2 }, props.editable === false && { opacity: 0.65 }]} />;
});
