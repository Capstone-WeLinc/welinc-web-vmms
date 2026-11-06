const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  buildBackendWorkOrderProgress,
  mergeUploadedWorkOrderAttachments,
  mapWorkOrderProgress,
} = require('../src/lib/utils/workOrderProgress.ts');

test('maps mobile execution and inspection progress into the web work order model', () => {
  const mapped = mapWorkOrderProgress({
    workflowStatus: 'In Progress',
    executionItems: [
      { id: 'oil', label: 'Oil level', status: 'checked', note: 'Normal' },
      { id: 'brakes', label: 'Brakes', status: 'changed', note: '' },
    ],
    partDetails: {
      brakes: {
        partsUsed: 'Brake pads',
        quantity: '2',
        materialCost: '1200',
        attachments: [{ id: 'photo-1', name: 'brakes.jpg', sizeMb: 1.2 }],
      },
    },
    inspectionItems: [{ id: 'oil', label: 'Oil level', status: 'pending', note: '' }],
  });

  assert.deepEqual(mapped.execution.items.map(({ id, status, partsUsed, partsCost, attachments }) => ({
    id, status, partsUsed, partsCost, attachments,
  })), [
    { id: 'oil', status: 'checked', partsUsed: '', partsCost: '', attachments: [] },
    { id: 'brakes', status: 'changed', partsUsed: 'Brake pads', partsCost: '1200', attachments: [{ id: 'photo-1', name: 'brakes.jpg', sizeMb: 1.2 }] },
  ]);
  assert.equal(mapped.checklist[0].status, 'pending');
});

test('web progress saves use the canonical format and preserve mobile part quantities', () => {
  const payload = buildBackendWorkOrderProgress(
    [{ id: 'oil', text: 'Oil level', status: 'pass', note: 'Good' }],
    {
      done: false,
      items: [{
        id: 'brakes', text: 'Brakes', status: 'changed', note: '',
        partsUsed: 'Brake pads', partsCost: '1200', attachments: [{ id: 'photo-1', name: 'brakes.jpg', sizeMb: 1.2, storageName: 'photo-1.jpg' }],
      }],
    },
    { partDetails: { brakes: { quantity: '2', attachments: [] } } },
  );

  assert.equal(payload.action, 'SAVE');
  assert.equal(payload.executionItems[0].label, 'Brakes');
  assert.equal(payload.inspectionItems[0].status, 'pass');
  assert.equal(payload.partDetails.brakes.quantity, '2');
  assert.equal(payload.partDetails.brakes.attachments[0].name, 'brakes.jpg');
  assert.equal(payload.partDetails.brakes.attachments[0].storageName, 'photo-1.jpg');
});

test('keeps mechanic maintenance remarks separate from chief mechanic review remarks', () => {
  const mapped = mapWorkOrderProgress({
    workflowStatus: 'Rejected',
    executionItems: [{ id: 'oil', label: 'Oil service', status: 'checked', note: '' }],
    maintenanceRemarks: 'Replaced the leaking hose and tested the cooling system.',
    inspectorRemarks: 'Recheck for leaks after a road test.',
    rejectionRemarks: 'Recheck for leaks after a road test.',
  });
  assert.equal(mapped.execution.maintenanceRemarks, 'Replaced the leaking hose and tested the cooling system.');
  assert.equal(mapped.execution.remarks, 'Recheck for leaks after a road test.');

  const payload = buildBackendWorkOrderProgress([], { done: false, items: [] }, {
    maintenanceRemarks: mapped.execution.maintenanceRemarks,
    inspectorRemarks: mapped.execution.remarks,
    rejectionRemarks: 'Recheck for leaks after a road test.',
  });
  assert.equal(payload.maintenanceRemarks, mapped.execution.maintenanceRemarks);
  assert.equal(payload.inspectorRemarks, mapped.execution.remarks);
  assert.equal(payload.rejectionRemarks, 'Recheck for leaks after a road test.');
});

test('continues to read the older web progress shape', () => {
  const mapped = mapWorkOrderProgress({
    checklist: [{ id: 'oil', text: 'Oil level', status: 'pass', note: '' }],
    execution: { done: true, items: [{ id: 'oil', text: 'Oil level', status: 'checked', note: '' }] },
  });
  assert.equal(mapped.checklist[0].status, 'pass');
  assert.equal(mapped.execution.done, true);
});

test('does not restore a deleted attachment from stale saved progress', () => {
  const payload = buildBackendWorkOrderProgress(
    [],
    {
      done: false,
      items: [{
        id: 'brakes', text: 'Brakes', status: 'changed', note: '', attachments: [],
      }],
    },
    { partDetails: { brakes: { attachments: [{ id: 'old', name: 'old.jpg', storageName: 'old.jpg' }] } } },
  );
  assert.deepEqual(payload.partDetails.brakes.attachments, []);
});

test('re-uploading a legacy filename replaces its non-viewable placeholder', () => {
  const merged = mergeUploadedWorkOrderAttachments(
    [
      { id: '', name: '1000013845.jpg', sizeMb: 0 },
      { id: 'other', name: 'other.jpg', sizeMb: 0 },
    ],
    [{ id: 'stored', name: '1000013845.jpg', sizeMb: 1, storageName: 'stored.jpg' }],
  );
  assert.deepEqual(merged.map(({ name }) => name), ['other.jpg', '1000013845.jpg']);
  assert.equal(merged[1].storageName, 'stored.jpg');
});
