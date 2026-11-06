import { check } from 'k6';
import http from 'k6/http';

export const options = {
  scenarios: {
    recommendations_11k: {
      executor: 'ramping-arrival-rate',
      startRate: 2000,
      timeUnit: '1s',
      preAllocatedVUs: Number(__ENV.PREALLOCATED_VUS || 400),
      maxVUs: Number(__ENV.MAX_VUS || 1200),
      stages: [
        { target: 6000, duration: '3s' },
        { target: 11000, duration: '5s' },
        { target: 11000, duration: '5s' },
      ],
      gracefulStop: '5s',
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
