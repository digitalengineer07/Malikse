export interface IndiaStateInfo {
  code: string;
  name: string;
  capital: string;
  type: "state" | "ut";
  lat: number;
  lng: number;
  zoom: number;
  image?: string;
}

// Approximate navigation centers, not surveyed boundaries or property locations.
// Administrative reference: https://knowindia.india.gov.in/states-uts/
const states: [string, string, string, number, number, number][] = [
  ["AP", "Andhra Pradesh", "Amaravati", 15.9, 79.7, 7],
  ["AR", "Arunachal Pradesh", "Itanagar", 28.2, 94.7, 7],
  ["AS", "Assam", "Dispur", 26.2, 92.9, 7],
  ["BR", "Bihar", "Patna", 25.6, 85.1, 7],
  ["CG", "Chhattisgarh", "Raipur", 21.3, 81.9, 7],
  ["GA", "Goa", "Panaji", 15.3, 74.1, 9],
  ["GJ", "Gujarat", "Gandhinagar", 22.3, 71.2, 7],
  ["HR", "Haryana", "Chandigarh", 29.1, 76.1, 8],
  ["HP", "Himachal Pradesh", "Shimla Dharamshala", 31.8, 77.2, 8],
  ["JH", "Jharkhand", "Ranchi", 23.6, 85.3, 7],
  ["KA", "Karnataka", "Bengaluru", 15.3, 75.7, 7],
  ["KL", "Kerala", "Thiruvananthapuram", 10.9, 76.3, 7],
  ["MP", "Madhya Pradesh", "Bhopal", 23.5, 78.7, 6],
  ["MH", "Maharashtra", "Mumbai Nagpur", 19.8, 75.7, 7],
  ["MN", "Manipur", "Imphal", 24.7, 93.9, 8],
  ["ML", "Meghalaya", "Shillong", 25.5, 91.4, 8],
  ["MZ", "Mizoram", "Aizawl", 23.2, 92.9, 8],
  ["NL", "Nagaland", "Kohima", 26.2, 94.6, 8],
  ["OD", "Odisha", "Bhubaneswar", 20.9, 85.1, 7],
  ["PB", "Punjab", "Chandigarh", 31.1, 75.3, 8],
  ["RJ", "Rajasthan", "Jaipur", 27.0, 74.2, 6],
  ["SK", "Sikkim", "Gangtok", 27.5, 88.5, 9],
  ["TN", "Tamil Nadu", "Chennai", 11.1, 78.7, 7],
  ["TS", "Telangana", "Hyderabad", 18.1, 79.0, 7],
  ["TR", "Tripura", "Agartala", 23.9, 91.9, 8],
  ["UP", "Uttar Pradesh", "Lucknow", 26.8, 80.9, 7],
  ["UK", "Uttarakhand", "Dehradun Gairsain", 30.1, 79.0, 8],
  ["WB", "West Bengal", "Kolkata", 23.0, 87.9, 7],
];
const territories: typeof states = [
  ["AN", "Andaman and Nicobar Islands", "Sri Vijaya Puram Port Blair", 11.7, 92.7, 7],
  ["CH", "Chandigarh", "Chandigarh", 30.7, 76.8, 11],
  ["DN", "Dadra and Nagar Haveli and Daman and Diu", "Daman", 20.4, 72.8, 9],
  ["DL", "Delhi", "New Delhi", 28.6, 77.2, 10],
  ["JK", "Jammu and Kashmir", "Srinagar Jammu", 34.0, 74.8, 7],
  ["LA", "Ladakh", "Leh Kargil", 34.2, 77.6, 7],
  ["LD", "Lakshadweep", "Kavaratti", 10.6, 72.6, 8],
  ["PY", "Puducherry", "Puducherry", 11.9, 79.8, 10],
];
export const INDIA_STATES_DATA: IndiaStateInfo[] = [
  ...states.map(([code, name, capital, lat, lng, zoom]) => ({ code, name, capital, lat, lng, zoom, type: "state" as const })),
  ...territories.map(([code, name, capital, lat, lng, zoom]) => ({ code, name, capital, lat, lng, zoom, type: "ut" as const })),
].sort((a, b) => a.name.localeCompare(b.name));
