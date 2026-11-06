import React from "react";
import { Text } from "react-native";
import material from "../assets/icons/MaterialIcons.json";
import awesome from "../assets/icons/FontAwesome5Free.json";
function Icon({name,size=24,color,style,...props}:any, glyphs:Record<string,number>, family:string) {
 return <Text {...props} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{fontFamily:family,fontSize:size,color,lineHeight:size+2,fontWeight:"normal",fontStyle:"normal"},style]}>{String.fromCodePoint(glyphs[name] || glyphs["help-outline"] || 63)}</Text>;
}
export function MaterialIcons(props:any) { return Icon(props,material,"MaterialIcons"); }
export function FontAwesome5(props:any) { return Icon(props,awesome,"FontAwesome5"); }
MaterialIcons.glyphMap = material;
FontAwesome5.glyphMap = awesome;
export default MaterialIcons;
