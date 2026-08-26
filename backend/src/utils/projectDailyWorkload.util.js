import { expandDateRangeToWeekdays } from './weekdayRange.util.js'
import { normalizeUtcDate } from './resourceDailyWorkload.util.js'

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

function getProjectId(allocation) {
  if (!allocation?.project_id) {
    return null
  }

  if (typeof allocation.project_id === 'string') {
    return allocation.project_id
  }

  if (typeof allocation.project_id.toString === 'function') {
    return allocation.project_id.toString()
  }

  return null
}

export function aggregateProjectDailyWorkload(
  allocations,
  selectedProjectId,
  selectedStartDateInput,
  selectedEndDateInput
) {
  const selectedStartDate = normalizeUtcDate(selectedStartDateInput)
  const selectedEndDate = normalizeUtcDate(selectedEndDateInput)
  const normalizedSelectedProjectId = String(selectedProjectId).toLowerCase()

  if (selectedStartDate > selectedEndDate) {
    throw new Error('start_date must be on or before end_date.')
  }

  const resourceDailyHours = new Map()
  const projectDailyTotals = new Map()

  for (const allocation of allocations) {
    const projectId = getProjectId(allocation)

    if (!projectId || projectId.toLowerCase() !== normalizedSelectedProjectId) {
      continue
    }

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

    if (!resourceDailyHours.has(resourceId)) {
      resourceDailyHours.set(resourceId, new Map())
    }

    const workloadByDate = resourceDailyHours.get(resourceId)

    for (const date of weekdays) {
      workloadByDate.set(date, (workloadByDate.get(date) ?? 0) + hoursPerDay)
      projectDailyTotals.set(date, (projectDailyTotals.get(date) ?? 0) + hoursPerDay)
    }
  }

  const resources = Array.from(resourceDailyHours.entries())
    .sort(([resourceIdA], [resourceIdB]) => resourceIdA.localeCompare(resourceIdB))
    .map(([resource_id, workloadByDate]) => {
      const daily_workload = Array.from(workloadByDate.entries())
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([date, planned_hours]) => ({ date, planned_hours }))

      const total_planned_hours = daily_workload.reduce((totalHours, entry) => totalHours + entry.planned_hours, 0)

      return { resource_id, daily_workload, total_planned_hours }
    })

  const daily_totals = Array.from(projectDailyTotals.entries())
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, planned_hours]) => ({ date, planned_hours }))

  const total_planned_hours = daily_totals.reduce((totalHours, entry) => totalHours + entry.planned_hours, 0)

  return {
    project_id: selectedProjectId,
    resources,
    daily_totals,
    total_planned_hours
  }
}
