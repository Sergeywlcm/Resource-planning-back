import test from 'node:test'
import assert from 'node:assert/strict'

import { aggregateProjectDailyWorkload } from '../projectDailyWorkload.util.js'

test('includes all allocated resources for selected project with weekday daily hours', () => {
  const workload = aggregateProjectDailyWorkload(
    [
      {
        project_id: 'project-1',
        resource_id: 'resource-a',
        start_date: '2026-04-20',
        end_date: '2026-04-22',
        hours_per_day: 4
      },
      {
        project_id: 'project-1',
        resource_id: 'resource-b',
        start_date: '2026-04-21',
        end_date: '2026-04-23',
        hours_per_day: 3
      },
      {
        project_id: 'project-2',
        resource_id: 'resource-z',
        start_date: '2026-04-20',
        end_date: '2026-04-22',
        hours_per_day: 10
      }
    ],
    'project-1',
    '2026-04-20',
    '2026-04-23'
  )

  assert.deepEqual(workload.resources, [
    {
      resource_id: 'resource-a',
      daily_workload: [
        { date: '2026-04-20', planned_hours: 4, workload_status: 'partial' },
        { date: '2026-04-21', planned_hours: 4, workload_status: 'partial' },
        { date: '2026-04-22', planned_hours: 4, workload_status: 'partial' }
      ],
      total_planned_hours: 12
    },
    {
      resource_id: 'resource-b',
      daily_workload: [
        { date: '2026-04-21', planned_hours: 3, workload_status: 'partial' },
        { date: '2026-04-22', planned_hours: 3, workload_status: 'partial' },
        { date: '2026-04-23', planned_hours: 3, workload_status: 'partial' }
      ],
      total_planned_hours: 9
    }
  ])
})

test('includes project daily totals and excludes weekend days', () => {
  const workload = aggregateProjectDailyWorkload(
    [
      {
        project_id: 'project-1',
        resource_id: 'resource-a',
        start_date: '2026-04-24',
        end_date: '2026-04-28',
        hours_per_day: 5
      },
      {
        project_id: 'project-1',
        resource_id: 'resource-b',
        start_date: '2026-04-24',
        end_date: '2026-04-27',
        hours_per_day: 2
      }
    ],
    'project-1',
    '2026-04-24',
    '2026-04-28'
  )

  assert.deepEqual(workload.daily_totals, [
    { date: '2026-04-24', planned_hours: 7 },
    { date: '2026-04-27', planned_hours: 7 },
    { date: '2026-04-28', planned_hours: 5 }
  ])
  assert.equal(workload.total_planned_hours, 19)
})

test('aggregated values are accurate for overlapping allocations by same resource', () => {
  const workload = aggregateProjectDailyWorkload(
    [
      {
        project_id: 'project-1',
        resource_id: 'resource-a',
        start_date: '2026-04-20',
        end_date: '2026-04-22',
        hours_per_day: 4
      },
      {
        project_id: 'project-1',
        resource_id: 'resource-a',
        start_date: '2026-04-21',
        end_date: '2026-04-21',
        hours_per_day: 1.5
      }
    ],
    'project-1',
    '2026-04-20',
    '2026-04-22'
  )

  assert.deepEqual(workload.resources, [
    {
      resource_id: 'resource-a',
      daily_workload: [
        { date: '2026-04-20', planned_hours: 4, workload_status: 'partial' },
        { date: '2026-04-21', planned_hours: 5.5, workload_status: 'partial' },
        { date: '2026-04-22', planned_hours: 4, workload_status: 'partial' }
      ],
      total_planned_hours: 13.5
    }
  ])
  assert.deepEqual(workload.daily_totals, [
    { date: '2026-04-20', planned_hours: 4 },
    { date: '2026-04-21', planned_hours: 5.5 },
    { date: '2026-04-22', planned_hours: 4 }
  ])
  assert.equal(workload.total_planned_hours, 13.5)
})

test('marks 8h as full and above 8h as overallocated per resource-day', () => {
  const workload = aggregateProjectDailyWorkload(
    [
      {
        project_id: 'project-1',
        resource_id: 'resource-a',
        start_date: '2026-04-20',
        end_date: '2026-04-20',
        hours_per_day: 8
      },
      {
        project_id: 'project-1',
        resource_id: 'resource-b',
        start_date: '2026-04-20',
        end_date: '2026-04-20',
        hours_per_day: 9
      }
    ],
    'project-1',
    '2026-04-20',
    '2026-04-20'
  )

  assert.deepEqual(workload.resources, [
    {
      resource_id: 'resource-a',
      daily_workload: [{ date: '2026-04-20', planned_hours: 8, workload_status: 'full' }],
      total_planned_hours: 8
    },
    {
      resource_id: 'resource-b',
      daily_workload: [{ date: '2026-04-20', planned_hours: 9, workload_status: 'overallocated' }],
      total_planned_hours: 9
    }
  ])
})

test('reads resource ids from lean populated resource objects', () => {
  const workload = aggregateProjectDailyWorkload(
    [
      {
        project_id: 'project-1',
        resource_id: { _id: { toString: () => 'resource-a' }, name: 'Alice' },
        start_date: '2026-04-20',
        end_date: '2026-04-20',
        hours_per_day: 6
      }
    ],
    'project-1',
    '2026-04-20',
    '2026-04-20'
  )

  assert.deepEqual(workload.resources, [
    {
      resource_id: 'resource-a',
      daily_workload: [{ date: '2026-04-20', planned_hours: 6, workload_status: 'partial' }],
      total_planned_hours: 6
    }
  ])
})
