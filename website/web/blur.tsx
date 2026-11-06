import React from "react";
import { View, StyleSheet } from "react-native";
export const BlurTargetView = View;
export function BlurView({children,style,intensity=50}:any) { return <div style={{...StyleSheet.flatten(style),backdropFilter:`blur(${intensity/5}px)`,background:"rgba(255,255,255,.3)"}}>{children}</div>; }
