import React from "react";
import { View } from "react-native";
const insets={top:0,right:0,bottom:0,left:0};
export function useSafeAreaInsets() { return insets; }
export function SafeAreaProvider({children,style}:any) { return <View style={style}>{children}</View>; }
