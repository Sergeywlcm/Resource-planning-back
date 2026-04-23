import test from 'node:test'
import assert from 'node:assert/strict'

import { aggregateResourceDailyWorkload, getDailyWorkloadStatus, WORKLOAD_STATUS } from '../resourceDailyWorkload.util.js'

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
        { date: '2026-04-20', planned_hours: 4, status: 'partial' },
        { date: '2026-04-21', planned_hours: 7, status: 'partial' },
        { date: '2026-04-22', planned_hours: 7, status: 'partial' },
        { date: '2026-04-23', planned_hours: 3, status: 'partial' }
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
      daily_workload: [{ date: '2026-04-27', planned_hours: 5, status: 'partial' }]
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
        { date: '2026-04-21', planned_hours: 2.5, status: 'partial' },
        { date: '2026-04-22', planned_hours: 4, status: 'partial' }
      ]
    },
    {
      resource_id: 'resource-b',
      daily_workload: [
        { date: '2026-04-20', planned_hours: 6, status: 'partial' },
        { date: '2026-04-21', planned_hours: 6, status: 'partial' }
      ]
    }
  ])
})

test('calculates workload status thresholds correctly', () => {
  assert.equal(getDailyWorkloadStatus(0), WORKLOAD_STATUS.EMPTY)
  assert.equal(getDailyWorkloadStatus(1), WORKLOAD_STATUS.PARTIAL)
  assert.equal(getDailyWorkloadStatus(7), WORKLOAD_STATUS.PARTIAL)
  assert.equal(getDailyWorkloadStatus(8), WORKLOAD_STATUS.FULL)
  assert.equal(getDailyWorkloadStatus(8.01), WORKLOAD_STATUS.OVERALLOCATED)
})

test('adds full and overallocated status to resource-day output', () => {
  const workload = aggregateResourceDailyWorkload(
    [
      {
        resource_id: 'resource-1',
        start_date: '2026-04-20',
        end_date: '2026-04-20',
        hours_per_day: 8
      },
      {
        resource_id: 'resource-1',
        start_date: '2026-04-21',
        end_date: '2026-04-21',
        hours_per_day: 9
      }
    ],
    '2026-04-20',
    '2026-04-21'
  )

  assert.deepEqual(workload, [
    {
      resource_id: 'resource-1',
      daily_workload: [
        { date: '2026-04-20', planned_hours: 8, status: 'full' },
        { date: '2026-04-21', planned_hours: 9, status: 'overallocated' }
      ]
    }
  ])
})
