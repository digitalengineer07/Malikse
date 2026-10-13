import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const base = __ENV.BASE_URL || 'http://127.0.0.1:5055';
const password = 'LoadTestOnly123!';
const endpointLatency = new Trend('endpoint_latency', true);
const endpointErrors = new Rate('endpoint_errors');
const levels = (__ENV.LEVELS || '10,25,50,100').split(',').map(Number);

export const options = {
  stages: [...levels.map(target => ({ duration: '15s', target })), { duration: '10s', target: 0 }],
  thresholds: { endpoint_errors: ['rate<0.01'] },
};

function request(name, method, path, body, token, expected = 200) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = http.request(method, `${base}${path}`, body === undefined ? null : JSON.stringify(body), { headers, tags: { endpoint: name }, timeout: '10s' });
  endpointLatency.add(res.timings.duration, { endpoint: name });
  endpointErrors.add(res.status !== expected, { endpoint: name });
  check(res, { [`${name}: ${expected}`]: r => r.status === expected });
  return res;
}

export function setup() {
  const mobile = String(7000000000 + (Date.now() % 2000000000));
  const registered = request('register', 'POST', '/auth/register', { name: 'Load Test User', mobile, password }, null, 201);
  if (registered.status !== 201) throw new Error(`Fixture registration failed: ${registered.status}`);
  const token = registered.json('accessToken');
  request('kyc', 'POST', '/auth/kyc/demo', {}, token);
  const created = request('create property', 'POST', '/properties', {
    title: 'Load test fixture', type: 'land', location: { state: 'Bihar', district: 'Patna', block: '', mauza: '', policeStation: '', lat: 25.6, lng: 85.1 },
    totalArea: 1000, sellableArea: 1000, price: 1000000, negotiable: true,
  }, token, 201);
  if (created.status !== 201) throw new Error(`Fixture property failed: ${created.status} ${created.body}`);
  return { token, mobile, propertyId: created.json('_id') };
}

export default function (fixture) {
  if (__ENV.WORKLOAD === 'search') {
    request('property search', 'GET', '/properties/search?page=1&limit=50');
    sleep(1);
    return;
  }
  const routes = [
    () => request('health', 'GET', '/health'),
    () => request('property search', 'GET', '/properties/search?page=1&limit=50'),
    () => request('filtered search', 'GET', '/properties/search?type=land&limit=50'),
    () => request('my properties', 'GET', '/properties/mine', undefined, fixture.token),
    () => request('user profile', 'GET', '/users/profile', undefined, fixture.token),
    () => request('auth me', 'GET', '/auth/me', undefined, fixture.token),
    () => request('wishlist', 'GET', '/users/wishlist', undefined, fixture.token),
    () => request('property workspace', 'GET', `/properties/${fixture.propertyId}/workspace`, undefined, fixture.token),
    () => request('documents list', 'GET', `/documents?propertyId=${fixture.propertyId}`, undefined, fixture.token),
    () => request('sent inquiries', 'GET', '/inquiries/sent', undefined, fixture.token),
    () => request('received inquiries', 'GET', '/inquiries/received', undefined, fixture.token),
    () => request('login', 'POST', '/auth/login', { mobile: fixture.mobile, password }),
  ];
  routes[Math.floor(Math.random() * routes.length)]();
  sleep(1);
}
