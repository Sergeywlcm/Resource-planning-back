import { aggregateResourceDailyWorkload } from './resourceDailyWorkload.util.js'

function toResourceId(value) {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value.toString === 'function') {
    return value.toString()
  }

  return null
}

export function buildResourceWorkloadReport(resources, allocations, startDate, endDate) {
  const aggregatedByResource = aggregateResourceDailyWorkload(allocations, startDate, endDate)
  const aggregatedByResourceId = new Map(aggregatedByResource.map((entry) => [entry.resource_id, entry.daily_workload]))

  return resources.map((resource) => {
    const resourceId = toResourceId(resource.id ?? resource._id)

    return {
      resource_id: resourceId,
      resource_name: resource.name,
      daily_workload: aggregatedByResourceId.get(resourceId) ?? []
    }
  })
}
