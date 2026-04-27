import test from 'node:test'
import assert from 'node:assert/strict'

import { aggregateResourceDailyWorkload, getDailyWorkloadStatus } from '../resourceDailyWorkload.util.js'

test('maps workload status thresholds correctly', () => {
  assert.equal(getDailyWorkloadStatus(0), 'empty')
  assert.equal(getDailyWorkloadStatus(1), 'partial')
  assert.equal(getDailyWorkloadStatus(7), 'partial')
  assert.equal(getDailyWorkloadStatus(8), 'full')
  assert.equal(getDailyWorkloadStatus(8.5), 'overallocated')
})

test('sums multiple allocations for the same resource on the same weekday with per-project breakdown', () => {
  const workload = aggregateResourceDailyWorkload(
    [
      {
        resource_id: 'resource-1',
        project_id: { toString: () => 'project-1', name: 'Atlas' },
        start_date: '2026-04-20',
        end_date: '2026-04-22',
        hours_per_day: 4
      },
      {
        resource_id: 'resource-1',
        project_id: { toString: () => 'project-2', name: 'Beacon' },
        start_date: '2026-04-21',
        end_date: '2026-04-23',
        hours_per_day: 3
      }
    ],
    '2026-04-20',
    '2026-04-23'
  )

  assert.deepEqual(workload, [
    {
      resource_id: 'resource-1',
      daily_workload: [
        {
          date: '2026-04-20',
          planned_hours: 4,
          workload_status: 'partial',
          project_breakdown: [{ project_id: 'project-1', project_name: 'Atlas', hours: 4 }]
        },
        {
          date: '2026-04-21',
          planned_hours: 7,
          workload_status: 'partial',
          project_breakdown: [
            { project_id: 'project-1', project_name: 'Atlas', hours: 4 },
            { project_id: 'project-2', project_name: 'Beacon', hours: 3 }
          ]
        },
        {
          date: '2026-04-22',
          planned_hours: 7,
          workload_status: 'partial',
          project_breakdown: [
            { project_id: 'project-1', project_name: 'Atlas', hours: 4 },
            { project_id: 'project-2', project_name: 'Beacon', hours: 3 }
          ]
        },
        {
          date: '2026-04-23',
          planned_hours: 3,
          workload_status: 'partial',
          project_breakdown: [{ project_id: 'project-2', project_name: 'Beacon', hours: 3 }]
        }
      ]
    }
  ])
})

test('excludes weekends and dates outside selected range', () => {
  const workload = aggregateResourceDailyWorkload(
    [
      {
        resource_id: 'resource-1',
        project_id: { toString: () => 'project-1', name: 'Atlas' },
        start_date: '2026-04-24',
        end_date: '2026-04-28',
        hours_per_day: 5
      }
    ],
    '2026-04-25',
    '2026-04-27'
  )

  assert.deepEqual(workload, [
    {
      resource_id: 'resource-1',
      daily_workload: [
        {
          date: '2026-04-27',
          planned_hours: 5,
          workload_status: 'partial',
          project_breakdown: [{ project_id: 'project-1', project_name: 'Atlas', hours: 5 }]
        }
      ]
    }
  ])
})

test('groups output by resource and date with accurate totals', () => {
  const workload = aggregateResourceDailyWorkload(
    [
      {
        resource_id: 'resource-b',
        project_id: { toString: () => 'project-b', name: 'Build' },
        start_date: '2026-04-20',
        end_date: '2026-04-21',
        hours_per_day: 6
      },
      {
        resource_id: 'resource-a',
        project_id: { toString: () => 'project-a', name: 'Analyze' },
        start_date: '2026-04-21',
        end_date: '2026-04-22',
        hours_per_day: 2.5
      },
      {
        resource_id: 'resource-a',
        project_id: { toString: () => 'project-a', name: 'Analyze' },
        start_date: '2026-04-22',
        end_date: '2026-04-22',
        hours_per_day: 1.5
      }
    ],
    '2026-04-20',
    '2026-04-22'
  )

  assert.deepEqual(workload, [
    {
      resource_id: 'resource-a',
      daily_workload: [
        {
          date: '2026-04-21',
          planned_hours: 2.5,
          workload_status: 'partial',
          project_breakdown: [{ project_id: 'project-a', project_name: 'Analyze', hours: 2.5 }]
        },
        {
          date: '2026-04-22',
          planned_hours: 4,
          workload_status: 'partial',
          project_breakdown: [{ project_id: 'project-a', project_name: 'Analyze', hours: 4 }]
        }
      ]
    },
    {
      resource_id: 'resource-b',
      daily_workload: [
        {
          date: '2026-04-20',
          planned_hours: 6,
          workload_status: 'partial',
          project_breakdown: [{ project_id: 'project-b', project_name: 'Build', hours: 6 }]
        },
        {
          date: '2026-04-21',
          planned_hours: 6,
          workload_status: 'partial',
          project_breakdown: [{ project_id: 'project-b', project_name: 'Build', hours: 6 }]
        }
      ]
    }
  ])
})


test('project breakdown totals match each resource-day total', () => {
  const workload = aggregateResourceDailyWorkload(
    [
      {
        resource_id: 'resource-1',
        project_id: { toString: () => 'project-1', name: 'Atlas' },
        start_date: '2026-04-21',
        end_date: '2026-04-21',
        hours_per_day: 4
      },
      {
        resource_id: 'resource-1',
        project_id: { toString: () => 'project-2', name: 'Beacon' },
        start_date: '2026-04-21',
        end_date: '2026-04-21',
        hours_per_day: 2
      }
    ],
    '2026-04-21',
    '2026-04-21'
  )

  const [resource] = workload
  const [day] = resource.daily_workload
  const breakdownTotal = day.project_breakdown.reduce((sum, project) => sum + project.hours, 0)

  assert.equal(day.planned_hours, breakdownTotal)
})
