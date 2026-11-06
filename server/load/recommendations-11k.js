import http from 'k6/http';
import { check } from 'k6';

export const options = {
  scenarios: {
    recommendations_11k: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RPS || 11000),
      timeUnit: '1s',
      duration: __ENV.DURATION || '10s',
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 150),
      maxVUs: Number(__ENV.MAX_VUS || 600),
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const url = __ENV.TARGET_URL || 'http://localhost:5000/recommendations?mode=new';
  const res = http.get(url, {
    headers: {
      'Accept-Encoding': 'gzip',
    },
    timeout: '5s',
  });
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
}
