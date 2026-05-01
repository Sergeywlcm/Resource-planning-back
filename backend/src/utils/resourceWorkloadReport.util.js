import { expandDateRangeToWeekdays } from './weekdayRange.util.js'
import { getDailyWorkloadStatus, normalizeUtcDate } from './resourceDailyWorkload.util.js'

function getResourceId(resource) {
  if (!resource) {
    return null
  }

  if (typeof resource === 'string') {
    return resource
  }

  if (typeof resource._id?.toString === 'function') {
    return resource._id.toString()
  }

  if (typeof resource.id === 'string') {
    return resource.id
  }

  return null
}

function getAllocationResourceId(allocation) {
  if (!allocation?.resource_id) {
    return null
  }

  if (typeof allocation.resource_id === 'string') {
    return allocation.resource_id
  }

  if (typeof allocation.resource_id._id?.toString === 'function') {
    return allocation.resource_id._id.toString()
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
    : typeof allocation.project_id._id?.toString === 'function'
      ? allocation.project_id._id.toString()
    : typeof allocation.project_id.toString === 'function'
      ? allocation.project_id.toString()
      : null

  if (!projectId) {
    return null
  }

  const projectName = typeof allocation.project_id === 'object' && allocation.project_id !== null
    ? allocation.project_id.name ?? null
    : null
  const projectColor = typeof allocation.project_id === 'object' && allocation.project_id !== null
    ? allocation.project_id.color ?? null
    : null
  const projectHoursType = typeof allocation.project_id === 'object' && allocation.project_id !== null
    ? allocation.project_id.hours_type ?? null
    : null

  return { projectId, projectName, projectColor, projectHoursType }
}

export function buildResourceWorkloadReport(resources, allocations, selectedStartDateInput, selectedEndDateInput) {
  const selectedStartDate = normalizeUtcDate(selectedStartDateInput)
  const selectedEndDate = normalizeUtcDate(selectedEndDateInput)

  if (selectedStartDate > selectedEndDate) {
    throw new Error('start must be on or before end.')
  }

  const weekdays = expandDateRangeToWeekdays(selectedStartDate, selectedEndDate)
  const resourcesById = new Map()

  for (const resource of resources) {
    const resourceId = getResourceId(resource)

    if (!resourceId) {
      continue
    }

    resourcesById.set(resourceId, {
      resource_id: resourceId,
      resource_name: resource.name ?? null,
      capacity_hours: Number(resource.capacity_hours),
      daily_workload: weekdays.map((date) => ({
        date,
        planned_hours: 0,
        workload_status: 'empty',
        project_breakdown: []
      }))
    })
  }

  const dailyMapsByResource = new Map()

  for (const [resourceId] of resourcesById) {
    const map = new Map()

    for (const day of resourcesById.get(resourceId).daily_workload) {
      map.set(day.date, day)
    }

    dailyMapsByResource.set(resourceId, map)
  }

  for (const allocation of allocations) {
    const resourceId = getAllocationResourceId(allocation)

    if (!resourceId || !resourcesById.has(resourceId)) {
      continue
    }

    const allocationStartDate = normalizeUtcDate(allocation.start_date)
    const allocationEndDate = normalizeUtcDate(allocation.end_date)

    if (allocationEndDate < selectedStartDate || allocationStartDate > selectedEndDate) {
      continue
    }

    const effectiveStartDate = allocationStartDate > selectedStartDate ? allocationStartDate : selectedStartDate
    const effectiveEndDate = allocationEndDate < selectedEndDate ? allocationEndDate : selectedEndDate
    const applicableWeekdays = expandDateRangeToWeekdays(effectiveStartDate, effectiveEndDate)
    const hoursPerDay = Number(allocation.hours_per_day)

    if (!Number.isFinite(hoursPerDay)) {
      continue
    }

    const projectEntry = getProjectBreakdownEntry(allocation)

    if (!projectEntry) {
      continue
    }

    const resourceDailyMap = dailyMapsByResource.get(resourceId)

    for (const date of applicableWeekdays) {
      const day = resourceDailyMap.get(date)

      if (!day) {
        continue
      }

      day.planned_hours += hoursPerDay

      const existingProject = day.project_breakdown.find((item) => item.project_id === projectEntry.projectId)

      if (existingProject) {
        existingProject.hours += hoursPerDay

        if (!existingProject.project_name && projectEntry.projectName) {
          existingProject.project_name = projectEntry.projectName
        }

        if (!existingProject.project_color && projectEntry.projectColor) {
          existingProject.project_color = projectEntry.projectColor
        }

        if (!existingProject.project_hours_type && projectEntry.projectHoursType) {
          existingProject.project_hours_type = projectEntry.projectHoursType
        }
      } else {
        const breakdownEntry = {
          project_id: projectEntry.projectId,
          project_name: projectEntry.projectName,
          hours: hoursPerDay
        }

        if (projectEntry.projectColor) {
          breakdownEntry.project_color = projectEntry.projectColor
        }

        if (projectEntry.projectHoursType) {
          breakdownEntry.project_hours_type = projectEntry.projectHoursType
        }

        day.project_breakdown.push(breakdownEntry)
      }
    }
  }

  const serializedResources = Array.from(resourcesById.values())
    .sort((resourceA, resourceB) => resourceA.resource_name?.localeCompare(resourceB.resource_name ?? '') || resourceA.resource_id.localeCompare(resourceB.resource_id))
    .map((resource) => ({
      ...resource,
      daily_workload: resource.daily_workload.map((day) => ({
        ...day,
        workload_status: getDailyWorkloadStatus(day.planned_hours),
        project_breakdown: day.project_breakdown.sort((projectA, projectB) => projectA.project_id.localeCompare(projectB.project_id))
      }))
    }))

  return {
    start_date: weekdays.at(0) ?? null,
    end_date: weekdays.at(-1) ?? null,
    weekdays,
    resources: serializedResources
  }
}
