import test from 'node:test'
import assert from 'node:assert/strict'

import { aggregateResourceDailyWorkload } from '../resourceDailyWorkload.util.js'

test('sums multiple allocations for the same resource on the same weekday', () => {
  const workload = aggregateResourceDailyWorkload(
    [
      {
        resource_id: 'resource-1',
        start_date: '2026-04-20',
        end_date: '2026-04-22',
        hours_per_day: 4
      },
      {
        resource_id: 'resource-1',
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
        { date: '2026-04-20', planned_hours: 4 },
        { date: '2026-04-21', planned_hours: 7 },
        { date: '2026-04-22', planned_hours: 7 },
        { date: '2026-04-23', planned_hours: 3 }
      ]
    }
  ])
})

test('excludes weekends and dates outside selected range', () => {
  const workload = aggregateResourceDailyWorkload(
    [
      {
        resource_id: 'resource-1',
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
      daily_workload: [{ date: '2026-04-27', planned_hours: 5 }]
    }
  ])
})

test('groups output by resource and date with accurate totals', () => {
  const workload = aggregateResourceDailyWorkload(
    [
      {
        resource_id: 'resource-b',
        start_date: '2026-04-20',
        end_date: '2026-04-21',
        hours_per_day: 6
      },
      {
        resource_id: 'resource-a',
        start_date: '2026-04-21',
        end_date: '2026-04-22',
        hours_per_day: 2.5
      },
      {
        resource_id: 'resource-a',
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
        { date: '2026-04-21', planned_hours: 2.5 },
        { date: '2026-04-22', planned_hours: 4 }
      ]
    },
    {
      resource_id: 'resource-b',
      daily_workload: [
        { date: '2026-04-20', planned_hours: 6 },
        { date: '2026-04-21', planned_hours: 6 }
      ]
    }
  ])
})
