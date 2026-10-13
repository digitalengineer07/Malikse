import React from "react";
import { Redirect } from "expo-router";

export default function PostRoute() {
  return <Redirect href="/listing/create" />;
}
