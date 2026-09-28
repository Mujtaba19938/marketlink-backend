const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

// dateStr = 'YYYY-MM-DD', no timezone suffix -> parsed as LOCAL midnight.
// getDay() (not getUTCDay) is used on purpose so this matches how the date was parsed.
// Assumption: server runs in the market's own timezone (fine for one-city deployment).
const dayOfWeek = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00')
    return DAY_NAMES[d.getDay()]
}

// combine 'YYYY-MM-DD' + 'HH:MM' into a real local Date
const combineDateTime = (dateStr, timeStr) => {
    return new Date(dateStr + 'T' + timeStr + ':00')
}

const subtractHours = (date, hours) => {
    return new Date(date.getTime() - hours * 60 * 60 * 1000)
}

export { dayOfWeek, combineDateTime, subtractHours }
