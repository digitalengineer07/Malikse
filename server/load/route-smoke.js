import http from 'k6/http';
import { check, sleep } from 'k6';

const base = __ENV.BASE_URL || 'http://127.0.0.1:5055';
const id = '000000000000000000000000';
const routes = [
  ['GET', '/health'], ['GET', '/ready'], ['GET', '/properties/search'], ['GET', `/properties/${id}`], ['GET', `/property-photos/${id}.jpg`],
  ['POST', '/auth/register'], ['POST', '/auth/login'], ['POST', '/auth/refresh'], ['POST', '/auth/logout'], ['POST', '/auth/kyc/demo'], ['GET', '/auth/me'],
  ['GET', '/properties/mine'], ['GET', `/properties/${id}/workspace`], ['POST', '/properties'], ['PATCH', `/properties/${id}`], ['POST', `/properties/${id}/submit`], ['POST', `/properties/${id}/photos`],
  ['POST', '/documents'], ['GET', '/documents'], ['GET', `/documents/${id}/file`],
  ['POST', `/deals/${id}/offer`], ['GET', `/deals/${id}`], ['PATCH', `/deals/${id}/status`],
  ['GET', '/verification/my-tasks'], ['POST', `/verification/${id}/claim`], ['POST', `/verification/${id}/report`],
  ['POST', `/admin/properties/${id}/assign`], ['GET', '/admin/staff'], ['POST', '/admin/staff'], ['GET', '/admin/dashboard/summary'], ['GET', '/admin/properties'], ['GET', '/admin/users'], ['GET', `/admin/users/${id}/properties`], ['PUT', `/admin/users/${id}/suspend`], ['PUT', `/admin/staff/${id}/status`], ['GET', `/admin/users/${id}/transactions`], ['GET', `/admin/staff/${id}/workload`], ['GET', `/admin/properties/${id}/audit`],
  ['GET', '/users/profile'], ['PUT', '/users/profile'], ['GET', '/users/my-properties'], ['GET', '/users/wishlist'], ['POST', `/users/wishlist/${id}`],
  ['GET', '/inquiries'], ['GET', `/inquiries/${id}/messages`], ['GET', `/users/wishlist/${id}`],
  ['POST', '/inquiries'], ['GET', '/inquiries/sent'], ['GET', '/inquiries/received'], ['PUT', `/inquiries/${id}/status`], ['POST', `/inquiries/${id}/message`], ['POST', `/inquiries/${id}/read`],
];

export const options = { vus: routes.length, duration: '10s', thresholds: { checks: ['rate==1'] } };

export default function () {
  const [method, path] = routes[(__VU - 1) % routes.length];
  const res = http.request(method, base + path, method === 'GET' ? null : '{}', { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: `${method} ${path}` } });
  check(res, { 'route handled without server error': r => r.status >= 200 && r.status < 500 });
  sleep(1);
}
