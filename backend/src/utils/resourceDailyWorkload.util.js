import { expandDateRangeToWeekdays } from './weekdayRange.util.js'

export function normalizeUtcDate(dateInput) {
  const date = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput)

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date input.')
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

export function getDailyWorkloadStatus(hoursInput) {
  const hours = Number(hoursInput)

  if (!Number.isFinite(hours) || hours <= 0) {
    return 'empty'
  }

  if (hours < 8) {
    return 'partial'
  }

  if (hours === 8) {
    return 'full'
  }

  return 'overallocated'
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

function getProjectBreakdownEntry(allocation) {
  if (!allocation?.project_id) {
    return null
  }

  const projectId = typeof allocation.project_id === 'string'
    ? allocation.project_id
    : typeof allocation.project_id.toString === 'function'
      ? allocation.project_id.toString()
      : null

  if (!projectId) {
    return null
  }

  const projectName = typeof allocation.project_id === 'object' && allocation.project_id !== null
    ? allocation.project_id.name ?? null
    : null

  return { projectId, projectName }
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

    const projectEntry = getProjectBreakdownEntry(allocation)

    if (!projectEntry) {
      continue
    }

    if (!groupedDailyHours.has(resourceId)) {
      groupedDailyHours.set(resourceId, new Map())
    }

    const resourceWorkloadByDate = groupedDailyHours.get(resourceId)

    for (const date of weekdays) {
      if (!resourceWorkloadByDate.has(date)) {
        resourceWorkloadByDate.set(date, {
          plannedHours: 0,
          projectHours: new Map()
        })
      }

      const entry = resourceWorkloadByDate.get(date)
      entry.plannedHours += hoursPerDay

      if (!entry.projectHours.has(projectEntry.projectId)) {
        entry.projectHours.set(projectEntry.projectId, {
          project_id: projectEntry.projectId,
          project_name: projectEntry.projectName,
          hours: 0
        })
      }

      const breakdownEntry = entry.projectHours.get(projectEntry.projectId)
      breakdownEntry.hours += hoursPerDay

      if (!breakdownEntry.project_name && projectEntry.projectName) {
        breakdownEntry.project_name = projectEntry.projectName
      }
    }
  }

  return Array.from(groupedDailyHours.entries())
    .sort(([resourceIdA], [resourceIdB]) => resourceIdA.localeCompare(resourceIdB))
    .map(([resource_id, workloadByDate]) => ({
      resource_id,
      daily_workload: Array.from(workloadByDate.entries())
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([date, workload]) => ({
          date,
          planned_hours: workload.plannedHours,
          workload_status: getDailyWorkloadStatus(workload.plannedHours),
          project_breakdown: Array.from(workload.projectHours.values())
            .sort((projectA, projectB) => projectA.project_id.localeCompare(projectB.project_id))
        }))
    }))
}
