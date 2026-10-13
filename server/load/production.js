import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import execution from 'k6/execution';

const fixture = new SharedArray('production fixtures', () => [JSON.parse(open(__ENV.FIXTURE_PATH))])[0];
const base = __ENV.BASE_URL;
export const options = {
  scenarios: { browse: { executor: 'constant-arrival-rate', rate: Number(__ENV.RPS || 50), timeUnit: '1s', duration: __ENV.DURATION || '30s', preAllocatedVUs: 50, maxVUs: 200 } },
  thresholds: {
    http_req_failed: ['rate<0.01'], checks: ['rate==1'], dropped_iterations: ['count==0'],
    http_req_duration: ['p(95)<500'],
    'http_req_duration{endpoint:search}': ['p(95)<500'],
    'http_req_duration{endpoint:detail}': ['p(95)<500'],
    'http_req_duration{endpoint:profile}': ['p(95)<500'],
    'http_req_duration{endpoint:mine}': ['p(95)<500'],
    'http_req_duration{endpoint:summary}': ['p(95)<1000'],
  },
};

export default function () {
  const iteration = execution.scenario.iterationInTest;
  const account = iteration % fixture.tokens.length;
  const choice = iteration % 20;
  const propertyId = fixture.propertyIds[account % fixture.propertyIds.length];
  const [name, path, token] = choice < 10 ? ['search', '/properties/search?limit=50', null]
    : choice < 14 ? ['detail', `/properties/${propertyId}`, null]
    : choice < 17 ? ['profile', '/users/profile', fixture.tokens[account]]
    : choice < 19 ? ['mine', '/properties/mine', fixture.tokens[account]]
    : ['summary', '/admin/dashboard/summary', fixture.adminToken];
  const response = http.get(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {}, tags: { endpoint: name }, timeout: '10s' });
  check(response, { [`${name} returns successful data`]: r => {
    if (r.status !== 200) return false;
    const data = r.json();
    return name === 'search' ? Array.isArray(data) && data.length === 50
      : name === 'detail' ? data._id === propertyId
      : name === 'profile' ? !!data.id
      : name === 'mine' ? Array.isArray(data) && data.length > 0
      : data.properties.total === fixture.propertyCount;
  } });
}
