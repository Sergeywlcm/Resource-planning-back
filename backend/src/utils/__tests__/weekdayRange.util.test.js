import test from 'node:test'
import assert from 'node:assert/strict'

import { expandDateRangeToWeekdays } from '../weekdayRange.util.js'

test('includes Monday through Friday for a single weekday range', () => {
  const weekdays = expandDateRangeToWeekdays('2026-04-20', '2026-04-24')

  assert.deepEqual(weekdays, ['2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24'])
})

test('excludes Saturday and Sunday for a single-day weekend range', () => {
  const saturday = expandDateRangeToWeekdays('2026-04-25', '2026-04-25')
  const sunday = expandDateRangeToWeekdays('2026-04-26', '2026-04-26')

  assert.deepEqual(saturday, [])
  assert.deepEqual(sunday, [])
})

test('works for multi-week ranges and returns no weekend dates', () => {
  const weekdays = expandDateRangeToWeekdays('2026-04-20', '2026-05-03')

  assert.equal(weekdays.length, 10)
  assert.deepEqual(weekdays, [
    '2026-04-20',
    '2026-04-21',
    '2026-04-22',
    '2026-04-23',
    '2026-04-24',
    '2026-04-27',
    '2026-04-28',
    '2026-04-29',
    '2026-04-30',
    '2026-05-01'
  ])
})

test('throws when start date is after end date', () => {
  assert.throws(
    () => expandDateRangeToWeekdays('2026-04-24', '2026-04-20'),
    /Start date must be on or before end date/
  )
})
