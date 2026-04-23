const MS_PER_DAY = 24 * 60 * 60 * 1000

function normalizeDateInput(dateInput) {
  const date = dateInput instanceof Date ? new Date(dateInput.getTime()) : new Date(dateInput)

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date input.')
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function isWeekday(utcDate) {
  const dayOfWeek = utcDate.getUTCDay()
  return dayOfWeek >= 1 && dayOfWeek <= 5
}

export function expandDateRangeToWeekdays(startDateInput, endDateInput) {
  const startDate = normalizeDateInput(startDateInput)
  const endDate = normalizeDateInput(endDateInput)

  if (startDate > endDate) {
    throw new Error('Start date must be on or before end date.')
  }

  const weekdays = []

  for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate = new Date(currentDate.getTime() + MS_PER_DAY)) {
    if (isWeekday(currentDate)) {
      weekdays.push(currentDate.toISOString().slice(0, 10))
    }
  }

  return weekdays
}
