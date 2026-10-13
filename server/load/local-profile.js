import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import execution from 'k6/execution';
const f = new SharedArray('fixtures', () => [JSON.parse(open(__ENV.FIXTURE_PATH))])[0];
export const options = {
  scenarios: { load: { executor: 'constant-arrival-rate', rate: Number(__ENV.RPS), timeUnit: '1s', duration: __ENV.DURATION || '20s', preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 30), maxVUs: 80, gracefulStop: '15s' } },
  thresholds: { http_req_failed: ['rate<0.01'], checks: ['rate==1'], dropped_iterations: ['count==0'], http_req_duration: ['p(95)<500'] },
};
export default function () {
  const i = execution.scenario.iterationInTest;
  const mode = __ENV.MODE;
  let route, token, name;
  if (mode === 'home') { route = '/properties/search?limit=50&view=cards'; name = 'search'; }
  else if (mode === 'cold') { route = `/properties/search?limit=50&minPrice=${100000 + i}`; name = 'cold-search'; }
  else if (mode === 'admin') { route = '/admin/properties'; token = f.adminToken; name = 'admin-list'; }
  else if (mode === 'inbox') { route = '/inquiries/received'; token = f.tokens[0]; name = 'inbox'; }
  else {
    const c = i % 20;
    [name, route, token] = c < 10 ? ['search', '/properties/search?limit=50', null]
      : c < 14 ? ['detail', `/properties/${f.propertyIds[i % f.propertyIds.length]}`, null]
      : c < 17 ? ['profile', '/users/profile', f.tokens[i % f.tokens.length]]
      : c < 19 ? ['mine', '/properties/mine', f.tokens[i % f.tokens.length]]
      : ['summary', '/admin/dashboard/summary', f.adminToken];
  }
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  if (__ENV.LOAD_ENCODING) headers['Accept-Encoding'] = __ENV.LOAD_ENCODING;
  const r = http.get(__ENV.BASE_URL + route, { headers, tags: { endpoint: name }, timeout: '10s' });
  check(r, { 'successful populated response': r => {
    if (r.status !== 200) return false;
    const data = r.json();
    return ['search', 'cold-search', 'mine', 'admin-list', 'inbox'].includes(name) ? Array.isArray(data) && data.length > 0
      : name === 'summary' ? data.properties.total === f.propertyCount : !!(data._id || data.id);
  } });
}
