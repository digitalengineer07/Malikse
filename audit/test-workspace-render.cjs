const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('../server/node_modules/typescript');
const React = require('../website/node_modules/react');
const { renderToStaticMarkup } = require('../website/node_modules/react-dom/server');
const root = path.resolve(__dirname, '..');
const box = ({ children }) => React.createElement('div', null, children);
const base = { _id: 'fixture', title: 'Assigned fixture', type: 'land', status: 'pending', price: 100, totalArea: 10, sellableArea: 10, location: { district: 'Patna', state: 'Bihar', lat: 25, lng: 85 }, ownerId: { _id: 'owner', name: 'Owner', mobile: '123' }, assignedAdvisorId: 'staff', assignedVerifierId: 'staff' };
for (const project of ['app', 'website']) {
 for (const role of ['advisor', 'verifier']) {
  for (const patch of [{}, { ownerId: null }, { advisorReview: { role: 'advisor', notes: 'Legacy report' } }]) {
   let state = 0;
   const fixture = { ...base, ...patch };
   const hooks = { ...React, useState: initial => { const i = state++; return [i === 0 ? fixture : i === 5 ? false : initial, () => {}]; }, useCallback: fn => fn };
   const requireMock = id => {
    if (id === 'react') return hooks;
    if (id === 'react-native') return { ActivityIndicator: box, Linking: {}, Modal: box, ScrollView: box, Text: box, View: box };
    if (id === 'expo-router' || id === '@/web/navigation') return { useLocalSearchParams: () => ({ id: 'fixture' }), useRouter: () => ({}), useFocusEffect: () => {}, Redirect: box };
    if (id.endsWith('/authStore')) return { useAuthStore: () => ({ user: { id: 'staff', role }, authState: 'AUTHENTICATED', hydrated: true }) };
    if (id.endsWith('/workflowService')) return { actorId: a => typeof a === 'string' ? a : a?._id, statusLabels: { pending: 'Pending' } };
    if (id === './WorkflowUI') return { WorkflowScreen: box, Action: ({ title }) => React.createElement('button', null, title), Check: box, Field: box, ui: {} };
    if (id.endsWith('/theme')) return { AppTheme: { colors: {} } };
    if (id.startsWith('./')) return { __esModule: true, default: () => null };
    return {};
   };
   const file = path.join(root, project, 'components/PropertyWorkspaceScreen.tsx');
   const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
   const mod = { exports: {} };
   vm.runInNewContext(js, { require: requireMock, module: mod, exports: mod.exports, console, setTimeout, clearTimeout }, { filename: file });
   const html = renderToStaticMarkup(mod.exports.default({}));
   assert.match(html, /Assigned fixture/);
   assert.match(html, /Approve and publish/);
  }
 }
}
console.log('PASS: app and website assigned advisor/verifier workspace render with missing seller and legacy review');
