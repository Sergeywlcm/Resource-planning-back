import { expandDateRangeToWeekdays } from './weekdayRange.util.js'

export function getDailyWorkloadStatus(plannedHours) {
  if (plannedHours === 0) {
    return 'empty'
  }

  if (plannedHours > 8) {
    return 'overallocated'
  }

  if (plannedHours === 8) {
    return 'full'
  }

  return 'partial'
}

export function normalizeUtcDate(dateInput) {
  const date = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput)

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date input.')
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function getResourceId(allocation) {
  if (!allocation?.resource_id) {
    return null
  }

  if (typeof allocation.resource_id === 'string') {
    return allocation.resource_id
  }

  if (typeof allocation.resource_id.toString === 'function') {
    return allocation.resource_id.toString()
  }

  return null
}

export function aggregateResourceDailyWorkload(allocations, selectedStartDateInput, selectedEndDateInput) {
  const selectedStartDate = normalizeUtcDate(selectedStartDateInput)
  const selectedEndDate = normalizeUtcDate(selectedEndDateInput)

  if (selectedStartDate > selectedEndDate) {
    throw new Error('start_date must be on or before end_date.')
  }

  const groupedDailyHours = new Map()

  for (const allocation of allocations) {
    const resourceId = getResourceId(allocation)

    if (!resourceId) {
      continue
    }

    const allocationStartDate = normalizeUtcDate(allocation.start_date)
    const allocationEndDate = normalizeUtcDate(allocation.end_date)

    if (allocationEndDate < selectedStartDate || allocationStartDate > selectedEndDate) {
      continue
    }

    const effectiveStartDate = allocationStartDate > selectedStartDate ? allocationStartDate : selectedStartDate
    const effectiveEndDate = allocationEndDate < selectedEndDate ? allocationEndDate : selectedEndDate
    const weekdays = expandDateRangeToWeekdays(effectiveStartDate, effectiveEndDate)
    const hoursPerDay = Number(allocation.hours_per_day)

    if (!Number.isFinite(hoursPerDay)) {
      continue
    }

    if (!groupedDailyHours.has(resourceId)) {
      groupedDailyHours.set(resourceId, new Map())
    }

    const resourceWorkloadByDate = groupedDailyHours.get(resourceId)

    for (const date of weekdays) {
      const totalHours = (resourceWorkloadByDate.get(date) ?? 0) + hoursPerDay
      resourceWorkloadByDate.set(date, totalHours)
    }
  }

  return Array.from(groupedDailyHours.entries())
    .sort(([resourceIdA], [resourceIdB]) => resourceIdA.localeCompare(resourceIdB))
    .map(([resource_id, workloadByDate]) => ({
      resource_id,
      daily_workload: Array.from(workloadByDate.entries())
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([date, planned_hours]) => ({ date, planned_hours, status: getDailyWorkloadStatus(planned_hours) }))
    }))
}
