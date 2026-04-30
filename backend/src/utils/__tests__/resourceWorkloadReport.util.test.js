import assert from 'node:assert/strict'
import test from 'node:test'

import { buildResourceWorkloadReport } from '../resourceWorkloadReport.util.js'

test('returns weekdays only and includes every resource in output', () => {
  const report = buildResourceWorkloadReport(
    [
      { _id: { toString: () => 'resource-1' }, name: 'Alice', capacity_hours: 8 },
      { _id: { toString: () => 'resource-2' }, name: 'Bob', capacity_hours: 6 }
    ],
    [],
    '2026-04-24',
    '2026-04-27'
  )

  assert.deepEqual(report.weekdays, ['2026-04-24', '2026-04-27'])
  assert.equal(report.resources.length, 2)
  assert.equal(report.resources[0].resource_name, 'Alice')
  assert.equal(report.resources[1].resource_name, 'Bob')

  for (const resource of report.resources) {
    assert.deepEqual(resource.daily_workload, [
      {
        date: '2026-04-24',
        planned_hours: 0,
        workload_status: 'empty',
        project_breakdown: []
      },
      {
        date: '2026-04-27',
        planned_hours: 0,
        workload_status: 'empty',
        project_breakdown: []
      }
    ])
  }
})

test('aggregates overlapping allocations with statuses and project breakdown', () => {
  const report = buildResourceWorkloadReport(
    [{ _id: { toString: () => 'resource-1' }, name: 'Alice', capacity_hours: 8 }],
    [
      {
        resource_id: 'resource-1',
        project_id: { toString: () => 'project-1', name: 'Atlas' },
        start_date: '2026-04-20',
        end_date: '2026-04-21',
        hours_per_day: 5
      },
      {
        resource_id: 'resource-1',
        project_id: { toString: () => 'project-2', name: 'Beacon' },
        start_date: '2026-04-21',
        end_date: '2026-04-22',
        hours_per_day: 4
      }
    ],
    '2026-04-20',
    '2026-04-22'
  )

  assert.deepEqual(report.resources[0].daily_workload, [
    {
      date: '2026-04-20',
      planned_hours: 5,
      workload_status: 'partial',
      project_breakdown: [{ project_id: 'project-1', project_name: 'Atlas', hours: 5 }]
    },
    {
      date: '2026-04-21',
      planned_hours: 9,
      workload_status: 'overallocated',
      project_breakdown: [
        { project_id: 'project-1', project_name: 'Atlas', hours: 5 },
        { project_id: 'project-2', project_name: 'Beacon', hours: 4 }
      ]
    },
    {
      date: '2026-04-22',
      planned_hours: 4,
      workload_status: 'partial',
      project_breakdown: [{ project_id: 'project-2', project_name: 'Beacon', hours: 4 }]
    }
  ])
})
